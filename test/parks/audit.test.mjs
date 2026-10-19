import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {harness,fixture,objectRow,plain,root} from './helpers.mjs';
function sample() {
 const h=harness(), {ps}=fixture(h,['NP-9']);
 return {h,p:objectRow(ps),c:{公園ID:'NP-9',候選緯度:'25.01',候選經度:'121.46',Google回傳地址:'220新北市板橋區測試路1號',定位類型:'ROOFTOP',審核狀態:'待確認'}};
}
test('A is address-consistent review priority, never approval or sheet mutation',()=>{
 const {h,p,c}=sample(), before=JSON.stringify([p,c]);
 const r=h.context.parkAuditData_([p],[c],[]);
 assert.equal(r.records[0].grade,'A');assert.equal(r.approved.length,0);assert.equal(r.records[0].formallyApproved,false);
 assert.equal(JSON.stringify([p,c]),before);assert.equal(h.events.length,0);
});
for(const [value,valid] of [['',false],[' ',false],[null,false],[true,false],[[],false],['NaN',false],['Infinity',false],['0x19',false],['25N',false],['25,01',false],[24.7,true],['25.01',true],[25.4,true],[25.400001,false]]) {
 test(`strict coordinate ${JSON.stringify(value)}`,()=>assert.equal(harness().context.parkAuditCoordinate_(value,121.46),valid));
}
for(const [type,reason] of [['GEOMETRIC_CENTER','幾何中心'],['RANGE_INTERPOLATED','內插'],['APPROXIMATE','概略'],['UNKNOWN','未知']]) {
 test(`${type} carries explicit uncertainty`,()=>{
  const {h,p,c}=sample();c.定位類型=type;
  const row=h.context.parkAuditData_([p],[c],[]).records[0];
  assert.equal(row.grade,'B');assert.ok(row.reasons.some(r=>r.includes(reason)));
 });
}
for(const [label,edit,grade,reason] of [
 ['missing id',(p,c)=>{c.公園ID='';},'C','ID缺漏'],
 ['wrong district',(p,c)=>{c.Google回傳地址='新北市中和區測試路1號';},'C','行政區不符'],
 ['wrong city',(p,c)=>{c.Google回傳地址='台北市板橋區測試路1號';},'C','縣市不符'],
 ['source district mismatch',(p,c)=>{p.地址='新北市土城區測試路1號';},'C','正式地址與行政區'],
 ['vague lot',(p,c)=>{p.地址='新北市板橋區測試段99地號';},'B','地號'],
 ['intersection',(p,c)=>{p.地址='新北市板橋區測試路路口';},'B','路口'],
 ['road mismatch',(p,c)=>{c.Google回傳地址='新北市板橋區其他路1號';},'B','道路'],
 ['missing address',(p,c)=>{p.地址='';},'B','地址缺漏'],
 ['missing Google address',(p,c)=>{c.Google回傳地址='';},'B','Google回傳地址缺漏'],
 ['large coordinate difference',(p,c)=>{p.緯度=25.1;p.經度=121.6;},'B','100公尺']
])test(label,()=>{
 const {h,p,c}=sample();edit(p,c);const r=h.context.parkAuditData_([p],[c],[]).records[0];
 assert.equal(r.grade,grade);assert.ok(r.reasons.some(r=>r.includes(reason)));
});
test('duplicate IDs, coordinate collisions, missing candidates, orphan facilities',()=>{
 const {h,p,c}=sample();const other={...p,公園ID:'NP-12'};
 const r=h.context.parkAuditData_([p,p,other,{...p,公園ID:'NP-99'},{...p,公園ID:''}],[c,c,{...c,公園ID:'NP-12'}],[{公園ID:'absent'}]);
 assert.deepEqual(plain(r.integrity.duplicateFormalIds),['NP-9']);
 assert.deepEqual(plain(r.integrity.duplicateCandidateIds),['NP-9']);
 assert.deepEqual(plain(r.integrity.missingCandidateIds),['NP-99']);
 assert.equal(r.integrity.orphanFacilityRows,1);assert.deepEqual(plain(r.integrity.formalMissingIdRows),[6]);
 assert.ok(r.records.every(row=>row.grade==='C'));
 assert.ok(r.records[2].reasons.includes('相同座標對應不同公園'));
});
test('invalid candidate is in location failures and no candidate is silently approved',()=>{
 const {h,p,c}=sample();c.候選緯度='';c.審核狀態='已確認';
 const r=h.context.parkAuditData_([p],[c],[]);assert.equal(r.failedLocation.length,1);assert.equal(r.pendingReview.length,0);assert.equal(r.approved.length,0);
});
test('empty datasets produce honest zero counts',()=>{
 const r=harness().context.parkAuditData_([],[],[]);assert.equal(r.summary.formalRows,0);assert.equal(r.summary.candidateRows,0);
});
test('Sheets audit validates actual headers and is read-only; explicit mapping supported',()=>{
 const {h,p,c}=sample();h.addSheet('公園資料',[Object.keys(p),Object.values(p)]);
 h.addSheet('公園設施',[['公園ID','可查詢遊具類別（依休憩設施）','遊戲場名稱']]);
 h.addSheet('公園座標候選',[['公園ID','候選緯度','候選經度','回傳地址','定位類型','審核狀態'],Object.values(c)]);
 assert.throws(()=>h.context.runPapaKingParkQualityAudit(),/缺少欄位/);
 assert.equal(h.context.runPapaKingParkQualityAudit({'Google回傳地址':'回傳地址'}).summary.candidateRows,1);
 assert.equal(h.events.length,0);
});
test('CLI runs offline, rejects missing schema, refuses overwriting an existing output',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'papaking-audit-'));
 try {
  const {p,c}=sample(), input=path.join(dir,'input.json'), output=path.join(dir,'report.json');
  fs.writeFileSync(input,JSON.stringify({parks:[p],candidates:[c],facilities:[]}));
  let run=spawnSync(process.execPath,['tools/park-audit.mjs',input,output],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(fs.readFileSync(output)).summary.candidateRows,1);
  run=spawnSync(process.execPath,['tools/park-audit.mjs',input,output],{cwd:root,encoding:'utf8'});assert.notEqual(run.status,0);
  fs.writeFileSync(input,JSON.stringify({parks:[{}],candidates:[],facilities:[]}));
  run=spawnSync(process.execPath,['tools/park-audit.mjs',input,path.join(dir,'bad.json')],{cwd:root,encoding:'utf8'});assert.notEqual(run.status,0);assert.match(run.stderr,/missing canonical fields/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('same road but different house number is not A grade',()=>{
 const {h,p,c}=sample();c.Google回傳地址='新北市板橋區測試路99號';
 assert.equal(h.context.parkAuditData_([p],[c],[]).records[0].grade,'B');
});
test('Google route result is flagged even when reported as ROOFTOP',()=>{
 const {h,p,c}=sample();c.Google地點類型='route';
 assert.ok(h.context.parkAuditData_([p],[c],[]).records[0].reasons.some(r=>r.includes('非入口證據')));
});
test('review approval inventory is independent of grades and rejects duplicate review IDs',()=>{
 const {h,p,c}=sample(),{rs}=fixture(h,['NP-9']);
 let report=h.context.parkAuditData_([p],[c],[]);
 h.context.parkAuditReviewApprovals_(report,[p],[objectRow(rs)]);
 assert.equal(report.approvalEvaluation,'validated_offline_preflight_only');assert.equal(report.approved.length,1);assert.equal(report.pendingReview.length,0);
 report=h.context.parkAuditData_([p],[c],[]);
 h.context.parkAuditReviewApprovals_(report,[p],[objectRow(rs),objectRow(rs)]);
 assert.equal(report.approved.length,0);assert.match(report.approvalRejected[0].reason,/ID 重複/);
});
test('schema discovery works with unknown candidate columns without modifying Sheets',()=>{
 const h=harness();h.addSheet('公園座標候選',[['公園ID','未知緯度欄位'],['NP-1',25],['NP-1',25]]);
 const inventory=h.context.runPapaKingParkInventory();
 assert.equal(inventory.find(s=>s.sheet==='公園座標候選').uniqueIds,1);
 assert.deepEqual(plain(inventory.find(s=>s.sheet==='公園座標候選').duplicateIds),['NP-1']);
 assert.equal(inventory.find(s=>s.sheet==='公園資料').exists,false);assert.equal(h.events.length,0);
});
test('New Taipei scope excludes known Taipei records explicitly, retaining orphan and unknown-city rows',()=>{
 const {h,p,c}=sample();
 const scope=h.context.parkAuditNewTaipeiScope_([p,{...p,公園ID:'TP-1',縣市:'台北市',資料來源ID:'TPE_PARK'},{...p,公園ID:'NP-2',縣市:'',資料來源ID:''}],[c,{...c,公園ID:'TP-1'},{...c,公園ID:'UNKNOWN'}],[],null);
 assert.equal(scope.parks.length,2);assert.equal(scope.candidates.length,2);assert.deepEqual(plain(scope.selection.excludedKnownNonNtpcFormalIds),['TP-1']);
 assert.ok(scope.candidates.some(c=>c.公園ID==='UNKNOWN'));
});
test('candidate colliding with another park official coordinate is flagged',()=>{
 const {h,p,c}=sample();const other={...p,公園ID:'NP-12',緯度:25.01,經度:121.46};
 assert.ok(h.context.parkAuditData_([p,other],[c],[]).records[0].reasons.includes('相同座標對應不同公園'));
});
test('cross-city duplicate target ID cannot disappear during scope filtering',()=>{
 const {h,p,c}=sample();const scope=h.context.parkAuditNewTaipeiScope_([p,{...p,縣市:'台北市',資料來源ID:'TPE_PARK'}],[c],[],null);
 assert.equal(scope.parks.length,2);assert.deepEqual(plain(h.context.parkAuditData_(scope.parks,scope.candidates,[]).integrity.duplicateFormalIds),['NP-9']);
});
test('inventory and audit retain physical row numbers across blank rows',()=>{
 const h=harness();const sheet=h.addSheet('公園資料',[['公園ID','緯度'],['NP-1',25],['',''],['',25]]);
 assert.deepEqual(plain(h.context.runPapaKingParkInventory()[0].missingIdRows),[4]);
 const rows=h.context.parkAuditSheetObjects_(sheet,['公園ID','緯度']);
 assert.deepEqual(plain(h.context.parkAuditIndex_(rows).missingRows),[4]);
});
