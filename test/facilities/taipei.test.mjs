import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setup,fixture,release,plain,fingerprint} from './helpers.mjs';
const tp=JSON.parse(fs.readFileSync(new URL('./fixtures/taipei-toilet.json',import.meta.url))).record;
const row=(changes={})=>({...tp,...changes});
test('Taipei verified-schema fixture has exactly the existing 24 fields and string coordinates',()=>{
 assert.deepEqual(Object.keys(tp).sort(),[...fixture.headers].sort());assert.equal(typeof tp['緯度'],'string');assert.equal(tp['資料來源ID'],'TP_TOILET');
});
for(const city of ['臺北市','台北市'])test(`approved ${city} TP_TOILET uses shared adapter without rewriting source fingerprint`,()=>{
 const input=row({'縣市':city}),before=structuredClone(input),h=setup([input]);
 const results=h.context.toiletSearch_(25,121.46);assert.equal(results.length,1);
 const r=results[0];assert.equal(r.city,'臺北市');assert.equal(r.lat,25.0001);assert.equal(r.lon,121.46);
 assert.equal(r.sourceFingerprint,fingerprint('toilet',input));assert.deepEqual(input,before);assert.equal(h.events.length,0);
 assert.equal(r.openingHours,'UNKNOWN');assert.equal(r.accessibility,'UNKNOWN');assert.equal(r.changingTable,'UNKNOWN');
 const u=new URL(h.context.facilityNavigationUrl_(r));assert.equal(u.searchParams.get('destination'),'25.0001,121.46');assert.equal(u.searchParams.get('travelmode'),'walking');
});
for(const mode of ['no-ledger','empty-ledger','revoked','fingerprint-changed','coordinate-changed','borrow-city-approval'])test(`Taipei ${mode} remains unpublished`,()=>{
 const input=row(),approved=release('toilet',input),h=setup([input],mode==='empty-ledger'?[]:[approved]);
 if(mode==='no-ledger')h.sheets.delete('設施發布核准');
 if(mode==='revoked')h.sheets.get('設施發布核准').data[1][6]='撤銷';
 if(mode==='fingerprint-changed')h.sheets.get('公廁資料').data[1][4]='合成另一地址';
 if(mode==='coordinate-changed')h.sheets.get('公廁資料').data[1][5]='25.001';
 if(mode==='borrow-city-approval')h.sheets.get('公廁資料').data[1][1]='台北市';
 assert.deepEqual(plain(h.context.toiletSearch_(25,121.46)),[]);assert.equal(h.events.length,0);
});
for(const change of [{'資料來源ID':'NTPC_TOILET'},{'資料來源ID':'UNKNOWN'},{'縣市':'桃園市'},{'行政區':''},{'資料狀態':'待確認'},{'整併狀態':'待人工確認'},{'緯度':'NaN'},{'經度':'0x79'},{'緯度':'25,001'},{'緯度':'277000'},{'緯度':'24.6'},{'公廁ID':true}])test(`Taipei quality rejects ${JSON.stringify(change)} even with synthetic approval`,()=>{
 const h=setup([row(change)]);assert.equal(h.context.toiletSearch_(25,121.46).length,0);
});
test('both-city toilets are ranked together near a border, with five-result cap and stable ID ties',()=>{
 const rows=Array.from({length:8},(_,i)=>i%2?{...fixture.record,'公廁ID':`SYNTHETIC-${i}`,'緯度':25+i*.001}:row({'公廁ID':`SYNTHETIC-${i}`,'緯度':String(25+i*.001)}));
 const h=setup(rows.reverse()),r=h.context.toiletSearch_(25,121.46);
 assert.deepEqual(plain(r.map(p=>p.id)),Array.from({length:5},(_,i)=>`SYNTHETIC-${i}`));assert.deepEqual(new Set(r.map(p=>p.city)),new Set(['臺北市','新北市']));
 for(let i=1;i<r.length;i++)assert.ok(r[i-1].km<=r[i].km);
 const tie=setup([row({'公廁ID':'SYNTHETIC-B','緯度':'25'}),{...fixture.record,'公廁ID':'SYNTHETIC-A'}]);
 assert.deepEqual(plain(tie.context.toiletSearch_(25,121.46).map(p=>p.id)),['SYNTHETIC-A','SYNTHETIC-B']);
});
test('Taipei exactly 3km is included and beyond 3km excluded by the shared kernel',()=>{
 const delta=3/6371*180/Math.PI,h=setup([row({'公廁ID':'edge','緯度':String(25+delta)}),row({'公廁ID':'outside','緯度':String(25+delta+.000001)})]);
 assert.deepEqual(plain(h.context.toiletSearch_(25,121.46).map(p=>p.id)),['edge']);
});
test('cross-city duplicate ID is excluded, not namespaced or auto-merged',()=>{
 const h=setup([row(),{...fixture.record,'公廁ID':tp['公廁ID']}]);assert.equal(h.context.toiletSearch_(25,121.46).length,0);
});
test('Taipei columns may be reordered, missing schema remains explicit error',()=>{
 const h=setup([row()]),s=h.sheets.get('公廁資料');s.data=s.data.map(r=>[...r].reverse());assert.equal(h.context.toiletSearch_(25,121.46).length,1);
 s.data[0][0]='缺欄';assert.throws(()=>h.context.toiletSearch_(25,121.46),/缺少欄位/);
});
test('existing NTPC actual ODS provenance remains compatible',()=>{
 const h=setup([{...fixture.record,'資料來源ID':'MOENV_NTPC_TOILET'}]);assert.equal(h.context.toiletSearch_(25,121.46).length,1);
});
