/** Offline adapter audit of typed ODS tables.json; no production API or writes.
 * Input: {sheetName:{headers:[...],data:[[...]]}} from the read-only ODS importer.
 * Usage: node tools/audit-toilet-source-release.mjs tables.json > report.json
 */
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {harness,root,plain} from '../test/parks/helpers.mjs';
const filename=process.argv[2];if(!filename)throw Error('Specify typed ODS tables.json');
const raw=fs.readFileSync(filename),tables=JSON.parse(raw),source=tables['公廁資料'];
if(!source||!Array.isArray(source.headers)||!Array.isArray(source.data))throw Error('Missing 公廁資料 typed table');
function load(previous){
 const h=harness([]),c=h.context;
 for(const file of ['park_search_gas.js','facility_search_gas.js']){
  const code=previous&&file==='facility_search_gas.js'?execFileSync('git',['show','ee61939:gas/'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(root+'/gas/'+file,'utf8');vm.runInContext(code,c,{filename:file});
 }
 for(const name of ['公廁資料','設施發布核准'])if(tables[name])h.addSheet(name,[tables[name].headers,...tables[name].data]);
 c.UrlFetchApp={fetch(){throw Error('Network prohibited');}};
 return h;
}
const before=load(true),after=load(false),rows=source.data.map(r=>Object.fromEntries(source.headers.map((k,i)=>[k,r[i]])));
const old=plain(before.context.getFacilityData_('toilet')),current=plain(after.context.getFacilityData_('toilet'));
const released=new Map(current.map(r=>[r.id,r])),oldIds=new Set(old.map(r=>r.id));
const counts=new Map();for(const r of rows){const id=String(r['公廁ID']??'').trim();counts.set(id,(counts.get(id)||0)+1);}
const byCity={},reasons={};
const perRow=rows.map((row,index)=>{
 const id=String(row['公廁ID']??'').trim(),city=String(row['縣市']??''),r=released.get(id),c=after.context;
 byCity[city]??={source:0,before:0,after:0,excluded:0,latitudeInputTypes:{},longitudeInputTypes:{}};
 const g=byCity[city];g.source++;if(oldIds.has(id))g.before++;if(r)g.after++;else g.excluded++;
 for(const [key,field] of [['latitudeInputTypes','緯度'],['longitudeInputTypes','經度']]){const type=typeof row[field];g[key][type]=(g[key][type]||0)+1;}
 let reason='';
 if(!r){
  if(!c.facilityRequiredText_(row['公廁ID'])||counts.get(id)!==1)reason='ID缺漏、無效或重複';
  else if(!c.facilityToiletCity_(row))reason='縣市或來源不符合適配';
  else if(!['待驗收','可用'].includes(row['資料狀態']))reason='資料狀態不允許';
  else if(!['公廁名稱','地址','資料來源ID'].every(k=>c.facilityRequiredText_(row[k])))reason='必要文字資料缺漏或無效';
  else if(!c.facilityTwinCityPosition_(row['緯度'],row['經度']))reason='座標格式或範圍異常';
  else if(!['保留獨立','自動整併'].includes(row['整併狀態']))reason='整併待確認或不允許';
  else reason='既有審核紀錄阻擋或缺乏合格發布依據';
  reasons[reason]=(reasons[reason]||0)+1;
 }
 return {sheetRow:index+2,id,city,before:oldIds.has(id),after:!!r,publicationSource:r?.publicationSource??null,reason,
  mergeStatus:row['整併狀態'],sourceStatus:row['資料狀態'],latitude:r?.lat??null,longitude:r?.lon??null};
});
for(const r of current){const url=new URL(after.context.facilityNavigationUrl_(r));if(url.searchParams.get('destination')!==r.lat+','+r.lon||!Number.isFinite(r.lat)||!Number.isFinite(r.lon))throw Error('Invalid projected navigation');}
if(before.events.length||after.events.length)throw Error('Unexpected mock Sheet writes');
console.log(JSON.stringify({baseCommit:'ee61939',inputSha256:crypto.createHash('sha256').update(raw).digest('hex'),
 releaseSheetPresent:!!tables['設施發布核准'],sourceRows:rows.length,before:old.length,after:current.length,excluded:rows.length-current.length,
 navigationValidatedCount:current.length,byCity,exclusiveExclusionReasons:reasons,perRow,limitation:'User export snapshot only, not latest live Sheets or deployed GAS verification; no human approvals inferred or changed.'},null,2));
