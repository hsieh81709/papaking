import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {trustedDriver} from '../p09/helpers.mjs';
import {fileURLToPath} from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const plain = value => JSON.parse(JSON.stringify(value));
export function harness(files=['park_geocoding_gas.js','park_b45_sync_gas.js','park_b43_regeocode_gas.js','park_search_gas.js']) {
  const events=[], sheets=new Map(), cache=new Map(), props={PARK_SHEET_ID:'fixture-sheet'}, logs=[];
  let failure=null;
  class Range {
    constructor(sheet,row,col,height=1,width=1) {Object.assign(this,{sheet,row,col,height,width});}
    getValues() {return Array.from({length:this.height},(_,i)=>Array.from({length:this.width},(_,j)=>this.sheet.data[this.row+i-1]?.[this.col+j-1]??''));}
    getValue() {return this.getValues()[0][0];}
    getDisplayValues() {return this.getValues().map(r=>r.map(String));}
    getDisplayValue() {return String(this.getValue());}
    getFormulas() {return Array.from({length:this.height},(_,i)=>Array.from({length:this.width},(_,j)=>this.sheet.formulas.get(`${this.row+i},${this.col+j}`)||''));}
    setValues(rows) {
      if(rows.length!==this.height || rows.some(r=>r.length!==this.width)) throw new Error('range shape mismatch');
      for(let i=0;i<this.height;i++) for(let j=0;j<this.width;j++) {
        const entry={type:'write',sheet:this.sheet.name,row:this.row+i,col:this.col+j,value:rows[i][j]};
        if(failure?.(entry)) {failure=null; throw new Error('injected write failure');}
        events.push(entry);
        while(this.sheet.data.length<entry.row)this.sheet.data.push([]);
        this.sheet.data[entry.row-1][entry.col-1]=rows[i][j];
      }
      return this;
    }
    setValue(value) {return this.setValues([[value]]);}
  }
  class Sheet {
    constructor(name,data) {this.name=name;this.data=structuredClone(data);this.formulas=new Map();}
    getName(){return this.name;}
    setName(name){if(sheets.has(name))throw new Error('duplicate sheet');sheets.delete(this.name);this.name=name;sheets.set(name,this);return this;}
    getLastRow(){return this.data.length;}
    getRange(row,col,h=1,w=1){if(row<1||col<1||h<1||w<1)throw new Error('invalid range');return new Range(this,row,col,h,w);}
    getDataRange(){return this.getRange(1,1,Math.max(1,this.data.length),Math.max(1,...this.data.map(r=>r.length)));}
    appendRow(row){this.getRange(this.getLastRow()+1,1,1,row.length).setValues([row]);return this;}
    copyTo(){const copy=new Sheet('Copy '+this.name,this.data);copy.formulas=new Map(this.formulas);sheets.set(copy.name,copy);events.push({type:'backup',sheet:this.name});return copy;}
  }
  const ss={getSheetByName:name=>sheets.get(name)||null,insertSheet(name){const s=new Sheet(name,[]);sheets.set(name,s);return s;}};
  const propertyService={getProperty:key=>props[key]??null,setProperty:(k,v)=>{props[k]=v;},getProperties:()=>({...props}),deleteProperty:k=>{delete props[k];}};
  const scriptCache={get:key=>cache.get(key)??null,put:(key,v)=>cache.set(key,v),remove:key=>cache.delete(key)};
  const context=vm.createContext({
    Logger:{log:v=>logs.push(v)},
    PropertiesService:{getScriptProperties:()=>propertyService},
    CacheService:{getScriptCache:()=>scriptCache},
    SpreadsheetApp:{openById:()=>ss,flush:()=>events.push({type:'flush'})},
    LockService:{getScriptLock:()=>({tryLock:()=>{if(context.__locked)return false;context.__locked=true;return true;},releaseLock:()=>{context.__locked=false;}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(v).digest()),getUuid:()=>crypto.randomUUID(),sleep:()=>{}},
    ContentService:{MimeType:{TEXT:'text'},createTextOutput:value=>({value,setMimeType(){return this;}})}
  });
  const sourceFiles=files.includes('park_search_gas.js')&&!files.includes('facility_search_gas.js')?[...files,'facility_search_gas.js']:files;
  if((files.includes('park_search_gas.js')||files.includes('line_webhook_gas.js'))&&!sourceFiles.includes('facility_line_gas.js')) sourceFiles.push('facility_line_gas.js');
  if(files.includes('park_search_gas.js')||files.includes('line_webhook_gas.js'))for(const file of ['webhook_state_gas.js','webhook_security_gas.js'])if(!sourceFiles.includes(file))sourceFiles.push(file);
  for(const file of sourceFiles)vm.runInContext(fs.readFileSync(path.join(root,'gas',file),'utf8'),context,{filename:file});
  if(files.includes('line_webhook_gas.js'))trustedDriver(context,props);
  return {context,events,sheets,logs,props,cache,ss,addSheet(name,data){const s=new Sheet(name,data);sheets.set(name,s);return s;},failWhen(fn){failure=fn;}};
}
export function fixture(h, ids=['NP-9','NP-12']) {
  const prod=ids.map((id,i)=>[id,'新北市','板橋區','測試公園'+i,'新北市板橋區測試路'+(i+1)+'號','','','','NTPC_PARK','','','','','待定位','']);
  const review=ids.map((id,i)=>[id,'測試公園'+i,'A','','','','ROOFTOP','需要修正','','','','25.01'+i,'121.46'+i,'人工入口比對','已確認']);
  const ps=h.addSheet('公園資料',[Array.from(h.context.PAPAKING_B45_PROD_HEADERS_),...prod]);
  const rs=h.addSheet('公園座標品質檢核',[Array.from(h.context.PAPAKING_B45_REVIEW_HEADERS_),...review]);
  return {ps,rs};
}
export function approve(plan){return {ids:plain(plan.ids),fingerprint:plan.fingerprint,confirmation:'確認寫入正式公園資料'};}
export function objectRow(sheet,row=1){return Object.fromEntries(sheet.data[0].map((h,i)=>[h,sheet.data[row][i]]));}
