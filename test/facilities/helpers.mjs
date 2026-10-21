import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {harness,root,plain} from '../parks/helpers.mjs';
export {plain};
export const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/toilets.json',import.meta.url)));
export const parkHeaders=['公園ID','縣市','行政區','公園名稱','地址','緯度','經度','管理單位','資料來源ID','原始資料ID','來源網址','資料更新日期','同步時間','資料狀態','備註'];
export const releaseHeaders=['設施類別','設施ID','來源資料指紋','緯度','經度','資料驗收','發布決定','核准人','核准日期','證據URL','座標代表類型'];
// Independent serialization contract, not a call to the implementation under test.
export function fingerprint(kind,row){const keys=kind==='park'?parkHeaders:fixture.headers;return crypto.createHash('sha256').update(JSON.stringify([kind,keys.map(k=>[k,['緯度','經度'].includes(k)?Number(row[k]):row[k] instanceof Date?row[k].toISOString():String(row[k]??'').trim()])])).digest('hex');}
export function release(kind,row){return {'設施類別':kind==='park'?'公園':'公廁','設施ID':row[kind==='park'?'公園ID':'公廁ID'],'來源資料指紋':fingerprint(kind,row),'緯度':Number(row['緯度']),'經度':Number(row['經度']),'資料驗收':'已確認','發布決定':'核准發布','核准人':'SYNTHETIC_REVIEWER','核准日期':'2026-10-01','證據URL':'https://example.gov.tw/fixture','座標代表類型':'未知'};}
export function putRelease(h,records){return h.addSheet('設施發布核准',[releaseHeaders,...records.map(r=>releaseHeaders.map(k=>r[k]??''))]);}
export function setup(rows=[structuredClone(fixture.record)],releases=rows.map(r=>release('toilet',r))){
 const h=harness(['park_search_gas.js']);const path=root+'/gas/facility_search_gas.js';
 if(!h.context.toiletSearch_&&fs.existsSync(path))vm.runInContext(fs.readFileSync(path,'utf8'),h.context,{filename:path});
 h.addSheet('公廁資料',[fixture.headers,...rows.map(r=>fixture.headers.map(k=>r[k]??''))]);putRelease(h,releases);
 return {...h,rows};
}
