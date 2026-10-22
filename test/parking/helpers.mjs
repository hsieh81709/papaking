import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {trustedDriver} from '../p09/helpers.mjs';
export const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/core.json', import.meta.url)));
export const plain = value => JSON.parse(JSON.stringify(value));
export const response = (code, body = []) => ({getResponseCode:()=>code,getContentText:()=>typeof body==='string'?body:JSON.stringify(body)});
// Every external call is intercepted. No real credentials, network, Sheets or LINE.
export function harness(properties={}) {
  let now=Date.parse('2026-10-20T04:00:00Z');
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const props={TDX_KEYS:JSON.stringify([{id:'fixture-a',secret:'synthetic'},{id:'fixture-b',secret:'synthetic'}]),QUOTA_SALT:'fixture-salt',...properties};
  const entries=new Map(),logs=[],calls=[],writes=[];
  const cache={
    get(k){const e=entries.get(k);return e&&e.until>now?e.value:null;},
    getAll(keys){return Object.fromEntries(keys.map(k=>[k,this.get(k)]).filter(([,v])=>v!==null));},
    put(k,v,ttl=600){entries.set(k,{value:String(v),until:now+ttl*1000});writes.push({key:k,ttl});},
    putAll(values,ttl){for(const [k,v] of Object.entries(values))this.put(k,v,ttl);},
    remove(k){entries.delete(k);},removeAll(keys){keys.forEach(k=>entries.delete(k));}
  };
  const h={props,logs,calls,cache,writes,advance(ms){now+=ms;},setTime(t){now=Date.parse(t);},
    fetch(){throw new Error('Unmocked request');},directions(){return {routes:[]};},geocode(){return {results:[]};}};
  const fetch=(url,options={})=>{calls.push({url,options});return h.fetch(url,options);};
  const propertyService={getProperty:k=>props[k]??null,getProperties:()=>({...props}),setProperty(k,v){props[k]=String(v);},deleteProperty(k){delete props[k];}};
  function geocoder(){return {setLanguage(){return this;},setRegion(){return this;},reverseGeocode:(...a)=>h.geocode(...a),geocode:(...a)=>h.geocode(...a)};}
  const context=vm.createContext({Date:Clock,Logger:{log:m=>logs.push(String(m))},PropertiesService:{getScriptProperties:()=>propertyService},CacheService:{getScriptCache:()=>cache},
    LockService:{getScriptLock:()=>({tryLock:()=>{if(h.locked)return false;h.locked=true;return true;},releaseLock:()=>{h.locked=false;}})},
    UrlFetchApp:{fetch,fetchAll:rs=>rs.map(r=>fetch(r.url,r))},
    Maps:{newGeocoder:geocoder,DirectionFinder:{Mode:{DRIVING:'driving'}},newDirectionFinder(){const d={setOrigin(){return d;},setDestination(){return d;},setMode(){return d;},getDirections:()=>h.directions()};return d;}},
    Utilities:{formatDate(d){const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit'}).formatToParts(d);return parts.find(p=>p.type==='year').value+parts.find(p=>p.type==='month').value;},getUuid:()=> 'fixture-uuid',DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest()),base64EncodeWebSafe:s=>Buffer.from(s).toString('base64url')},
    ContentService:{MimeType:{TEXT:'text'},createTextOutput:value=>({value,setMimeType(){return this;}})}
  });
  vm.runInContext(fs.readFileSync(new URL('../../gas/line_webhook_gas.js',import.meta.url),'utf8'),context);
  vm.runInContext(fs.readFileSync(new URL('../../gas/webhook_state_gas.js',import.meta.url),'utf8'),context);
  vm.runInContext(fs.readFileSync(new URL('../../gas/webhook_security_gas.js',import.meta.url),'utf8'),context);
  trustedDriver(context,props);
  h.c=context;h.propertyService=propertyService;return h;
}
