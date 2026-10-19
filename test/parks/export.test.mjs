import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {root} from './helpers.mjs';
function urlTool() {
 const html=fs.readFileSync(path.join(root,'tools/park-export-readonly.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const elements={'export-form':{addEventListener(){}},'error':{},'sheet-url':{value:''}},c=vm.createContext({URL,document:{getElementById:id=>elements[id]},window:{location:{assign(){throw new Error('no network in tests');}}}});
 vm.runInContext(script,c);return c;
}
test('one-download tool accepts only Google spreadsheet URLs and removes existing gid/query',()=>{
 const c=urlTool(),id='a'.repeat(44);
 assert.equal(c.parkWorkbookExportUrl(`https://docs.google.com/spreadsheets/d/${id}/edit?gid=123#gid=456`),`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
 assert.equal(c.parkWorkbookExportUrl(`https://docs.google.com/spreadsheets/u/1/d/${id}/edit`),`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
 for(const url of [`https://script.google.com/home/projects/${id}/edit`,`http://docs.google.com/spreadsheets/d/${id}`,`https://docs.google.com.evil.test/spreadsheets/d/${id}`,`https://user@docs.google.com/spreadsheets/d/${id}`,`https://docs.google.com:8443/spreadsheets/d/${id}`,id])assert.throws(()=>c.parkWorkbookExportUrl(url));
});
function python(code,args=[]) {
 const run=spawnSync('python',['-c',code,...args],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);return run;
}
function runImport(input,output,...args) {return spawnSync('python',['tools/import-park-workbook.py',input,output,...args],{cwd:root,encoding:'utf8'});}
function withWorkbook(fn,variant='normal') {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'park-workbook-'));
 try {
  const input=path.join(dir,'fixture.xlsx');
  python(`import openpyxl,sys,datetime
w=openpyxl.Workbook();w.remove(w.active)
prod=['公園ID','縣市','行政區','公園名稱','地址','緯度','經度','管理單位','資料來源ID','原始資料ID','來源網址','資料更新日期','同步時間','資料狀態','備註']
review=['公園ID','公園名稱','檢核分級','檢核原因','候選緯度','候選經度','原始定位類型','人工審核結果','修正地址／地點','Google 地圖參考連結','人工審核備註','修正後緯度','修正後經度','修正座標來源','修正座標驗收']
s=w.create_sheet('公園資料');s.append(prod)
s.append(['NP-1','新北市','板橋區','合成測試公園','新北市板橋區測試路1號','','','','NTPC_PARK','','',datetime.date(2026,10,19),'','待定位',''])
s.append(['NP-2','新北市','板橋區','另一合成公園','新北市板橋區測試路2號','','','','NTPC_PARK','','','','','待定位',''])
s=w.create_sheet('公園座標候選');s.append(['公園ID','候選緯度','候選經度','Google回傳地址','定位類型','審核狀態'])
s.append(['NP-1',25.01,121.46,'新北市板橋區測試路1號','ROOFTOP','待確認']);s.append(['NP-2','','121.46','新北市板橋區測試路2號','APPROXIMATE','待確認'])
s=w.create_sheet('公園設施');s.append(['公園ID','可查詢遊具類別（依休憩設施）','遊戲場名稱']);s.append(['NP-1','鞦韆','一般遊戲場']);s.append(['NP-1','溜滑梯','共融遊戲場'])
s=w.create_sheet('公園座標品質檢核');s.append(review)
w.create_sheet('unrelated').append(['excluded private tab'])
variant=sys.argv[2]
if variant=='missing': del w['公園設施']
if variant=='duplicate': w['公園設施'].cell(1,2,'公園ID')
if variant=='blank': w['公園設施'].cell(1,2,' ')
if variant=='formula': w['公園資料'].cell(2,6,'=1+24')
if variant=='gap': w['公園座標候選'].insert_rows(2)
if variant=='alias': w['公園座標候選'].cell(1,2,'實際緯度')
if variant=='missing_candidate': w['公園座標候選'].delete_rows(3)
if variant=='csv_text': w['公園資料'].cell(2,4,'+SYNTHETIC')
if variant=='population635':
 p=w['公園資料'];p.delete_rows(2,p.max_row)
 c=w['公園座標候選'];c.delete_rows(2,c.max_row)
 for i in range(1,636):
  address='新北市板橋區測試路'+str(i)+'號'
  p.append(['NP-'+str(i),'新北市','板橋區','合成公園'+str(i),address,'','','','NTPC_PARK','','','','','待定位',''])
  lat=24.85+(i%30)*.001;lng=121.3+(i//30)*.002
  if i==2: lat,lng=24.851,121.3
  if i==3: address='新北市土城區測試路3號'
  c.append(['NP-'+str(i),lat if i!=635 else '',lng,address,'ROOFTOP','待確認'])
w.save(sys.argv[1])`,[input,variant]);
  fn({dir,input});
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
test('XLSX importer preserves four complete tables, types, date, row numbers and SHA without source writes',()=>withWorkbook(({dir,input})=>{
 const before=fs.readFileSync(input),output=path.join(dir,'export.json'),run=runImport(input,output);assert.equal(run.status,0,run.stderr);
 const data=JSON.parse(fs.readFileSync(output));assert.equal(data.parks.length,2);assert.equal(data.facilities.length,2);assert.equal(data.reviews.length,0);
 assert.equal(data.candidates[0]['候選緯度'],25.01);assert.equal(data.candidates[1]['候選經度'],'121.46');assert.equal(data.parks[0]['資料更新日期'],'2026-10-19T00:00:00');
 assert.equal(data.parks[0].__sheetRow,2);assert.equal(data.exportEvidence.extraSheetsExcluded,1);assert.match(data.exportEvidence.sourceSha256,/^[0-9a-f]{64}$/);
 assert.equal(data.exportEvidence.googleExportedAt,null);assert.equal(fs.statSync(output).mode&0o777,0o600);assert.deepEqual(fs.readFileSync(input),before);
 assert.notEqual(runImport(input,output).status,0);
}));
for(const variant of ['missing','duplicate','blank'])test(`XLSX importer rejects ${variant} schema without a partial export`,()=>withWorkbook(({dir,input})=>{
 const output=path.join(dir,'bad.json'),run=runImport(input,output);assert.notEqual(run.status,0);assert.equal(fs.existsSync(output),false);
},variant));
test('formula inventory retains missing cached-value evidence and never evaluates formulas',()=>withWorkbook(({dir,input})=>{
 const output=path.join(dir,'export.json');assert.equal(runImport(input,output).status,0);
 const data=JSON.parse(fs.readFileSync(output));assert.equal(data.parks[0]['緯度'],'');
 assert.deepEqual(data.exportEvidence.inventory.parks.formulaCells,[{row:2,column:'緯度',cachedValuePresent:false}]);
},'formula'));
test('XLSX row numbers survive intermediate blank rows',()=>withWorkbook(({dir,input})=>{
 const output=path.join(dir,'export.json');assert.equal(runImport(input,output).status,0);assert.equal(JSON.parse(fs.readFileSync(output)).candidates[0].__sheetRow,3);
},'gap'));
test('explicit column mapping preserves the original header/value with an audited alias',()=>withWorkbook(({dir,input})=>{
 const mapping=path.join(dir,'mapping.json');fs.writeFileSync(mapping,JSON.stringify({candidates:{候選緯度:'實際緯度'}}));
 const output=path.join(dir,'export.json');assert.equal(runImport(input,output,'--mapping',mapping).status,0);
 const data=JSON.parse(fs.readFileSync(output));assert.equal(data.candidates[0]['候選緯度'],25.01);assert.equal(data.candidates[0]['實際緯度'],25.01);
 assert.deepEqual(data.exportEvidence.inventory.candidates.columnMapping,{候選緯度:'實際緯度'});
},'alias'));
test('complete offline pipeline identifies the sole invalid fixture, writes lists/copy plan, and makes no live-write claim',()=>withWorkbook(({dir,input})=>{
 const json=path.join(dir,'export.json');assert.equal(runImport(input,json).status,0);
 const out=path.join(dir,'report'),run=spawnSync(process.execPath,['tools/park-verify-export.mjs',json,out,'2'],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const receipt=JSON.parse(fs.readFileSync(path.join(out,'verification-receipt.json')));assert.equal(receipt.coverage.historicalPopulationCoveragePassed,true);assert.equal(receipt.uniqueInvalidCandidateId,'NP-2');assert.equal(receipt.actualGoogleSheetsWriteVerified,false);
 const plan=JSON.parse(fs.readFileSync(path.join(out,'copy-sync-plan.json')));assert.equal(plan.productionWritesAuthorized,false);assert.equal(plan.readyForCopyExecution,false);assert.equal(plan.eligibleByExportedReviewValues.length,0);
 const csv=fs.readFileSync(path.join(out,'parks-all.csv'),'utf8');assert.match(csv,/NP-1/);assert.match(csv,/NP-2/);
 assert.notEqual(spawnSync(process.execPath,['tools/park-verify-export.mjs',json,out,'2'],{cwd:root}).status,0);
}));
test('a partial population cannot be called the complete 635 or prove the unique invalid ID',()=>withWorkbook(({dir,input})=>{
 const json=path.join(dir,'export.json');assert.equal(runImport(input,json).status,0);
 const out=path.join(dir,'report'),run=spawnSync(process.execPath,['tools/park-verify-export.mjs',json,out],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const receipt=JSON.parse(fs.readFileSync(path.join(out,'verification-receipt.json')));assert.equal(receipt.coverage.historicalPopulationCoveragePassed,false);assert.equal(receipt.uniqueInvalidCandidateId,null);assert.equal(receipt.invalidCandidateUniquenessVerified,false);
}));
test('635-row SYNTHETIC export end-to-end catches its one invalid row, duplicate coordinates and district conflict',()=>withWorkbook(({dir,input})=>{
 const json=path.join(dir,'export.json');assert.equal(runImport(input,json).status,0);
 const out=path.join(dir,'report'),run=spawnSync(process.execPath,['tools/park-verify-export.mjs',json,out],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const receipt=JSON.parse(fs.readFileSync(path.join(out,'verification-receipt.json')));assert.equal(receipt.coverage.historicalPopulationCoveragePassed,true);assert.equal(receipt.uniqueInvalidCandidateId,'NP-635');assert.equal(receipt.summary.validCandidateCoordinates,634);
 assert.equal(receipt.summary.grades.C,4);assert.equal(fs.readFileSync(path.join(out,'parks-all.csv'),'utf8').trim().split('\r\n').length,636);
 const duplicates=JSON.parse(fs.readFileSync(path.join(out,'duplicate-coordinates.json')));assert.equal(duplicates.length,1);assert.deepEqual(duplicates[0].records.map(r=>r.id).sort(),['NP-1','NP-2']);
 assert.match(fs.readFileSync(path.join(out,'district-conflicts.csv'),'utf8'),/NP-3/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(out,'copy-sync-plan.json'))).eligibleByExportedReviewValues.length,0);
},'population635'));
test('missing candidate remains visible in per-park report and blocks coverage acceptance',()=>withWorkbook(({dir,input})=>{
 const json=path.join(dir,'export.json');assert.equal(runImport(input,json).status,0);
 const out=path.join(dir,'report'),run=spawnSync(process.execPath,['tools/park-verify-export.mjs',json,out,'2'],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 assert.equal(JSON.parse(fs.readFileSync(path.join(out,'verification-receipt.json'))).coverage.historicalPopulationCoveragePassed,false);
 assert.match(fs.readFileSync(path.join(out,'parks-all.csv'),'utf8'),/正式公園缺少候選紀錄/);
},'missing_candidate'));
test('CSV reports quote formula-like text while JSON retains the original value',()=>withWorkbook(({dir,input})=>{
 const json=path.join(dir,'export.json');assert.equal(runImport(input,json).status,0);
 const out=path.join(dir,'report'),run=spawnSync(process.execPath,['tools/park-verify-export.mjs',json,out,'2'],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 assert.match(fs.readFileSync(path.join(out,'parks-all.csv'),'utf8'),/'\+SYNTHETIC/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(out,'quality-report.json'))).records[0].name,'+SYNTHETIC');
},'csv_text'));
