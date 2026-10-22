import {trustedDriver} from '../p09/helpers.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {root} from '../parks/helpers.mjs';
import {setup,fixture,parkHeaders,putRelease,release,plain} from '../facilities/helpers.mjs';
export {fixture,putRelease,release,plain};
export const direct={type:'user',userId:'SYNTHETIC_A'};
export function router({realPark=false,rows,releases}={}) {
 const h=setup(rows,releases),c=h.context,sent=[],routes=[],cache=new Map();let now=Date.parse('2026-10-21T00:00:00Z');
 class Clock extends Date {constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
 c.Date=Clock;
 c.CacheService.getScriptCache=()=>({put:(k,v,ttl)=>cache.set(k,{value:v,until:now+ttl*1000}),get:k=>{const v=cache.get(k);return v&&v.until>now?v.value:null;},remove:k=>cache.delete(k)});
 vm.runInContext(fs.readFileSync(root+'/gas/line_webhook_gas.js','utf8'),c);
 if(typeof c.handlePapaKingMessage_!=='function'&&fs.existsSync(root+'/gas/facility_line_gas.js'))vm.runInContext(fs.readFileSync(root+'/gas/facility_line_gas.js','utf8'),c);
 trustedDriver(c,h.props);
 const p={'公園ID':'TP-1','縣市':'臺北市','行政區':'萬華區','公園名稱':'合成臺北公園','地址':'甲路','緯度':25,'經度':121.46,'資料狀態':'可用'};
 h.addSheet('公園資料',[parkHeaders,parkHeaders.map(k=>p[k]??'')]);h.addSheet('公園設施',[['公園ID','可查詢遊具類別（依休憩設施）','遊戲場名稱']]);
 const codes=[];c.postLineReply=(token,messages)=>{sent.push({token,messages:plain(messages)});return codes.shift()??200;};
 c.handleLocation=()=>{routes.push('parking');c.replyLine('SYNTHETIC','合成停車結果');};
 const park=c.buildParkFlexReply_;c.buildParkFlexReply_=(...a)=>{routes.push('park');return realPark?park(...a):'合成公園結果';};
 const toilet=c.toiletSearch_;c.toiletSearch_=(...a)=>{routes.push('toilet');return toilet(...a);};
 function send(source,message){return c.doPost({postData:{contents:JSON.stringify({events:[{type:'message',source,replyToken:'SYNTHETIC',message}]})}});}
 return {...h,c,sent,routes,clockCache:cache,codes,text:(t,s=direct)=>send(s,{type:'text',text:t}),location:(s=direct,lat=25,lon=121.46)=>send(s,{type:'location',latitude:lat,longitude:lon}),advance:seconds=>{now+=seconds*1000;},lastText:()=>sent.at(-1)?.messages.filter(m=>m.type==='text').map(m=>m.text).join('\n')||''};
}
