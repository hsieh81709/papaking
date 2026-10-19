#!/usr/bin/env node
// Produce inspectable offline artifacts from ONE four-sheet XLSX import.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [input,outputDir,expectedArg='635']=process.argv.slice(2);
if(!input||!outputDir)throw new Error('Usage: node tools/park-verify-export.mjs IMPORT.json NEW_OUTPUT_DIR [EXPECTED_COUNT=635]');
const expected=Number(expectedArg);
if(!Number.isInteger(expected)||expected<1)throw new Error('Expected count must be a positive integer');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bytes=fs.readFileSync(input),data=JSON.parse(bytes),evidence=data.exportEvidence;
if(evidence?.format!=='papaking-workbook-export-v1'||!/^[a-f0-9]{64}$/.test(evidence.sourceSha256))throw new Error('Import the complete XLSX with import-park-workbook.py first');
for(const key of ['parks','candidates','facilities','reviews']) {
 if(!Array.isArray(data[key])||evidence.inventory?.[key]?.dataRows!==data[key].length)throw new Error('Four-sheet inventory missing or inconsistent: '+key);
}
fs.mkdirSync(outputDir,{mode:0o700}); // Never reuse or overwrite an evidence directory.
const out=file=>path.join(outputDir,file);
execFileSync(process.execPath,[path.join(root,'tools/park-audit.mjs'),input,out('quality-report.json')],{stdio:'pipe'});
const report=JSON.parse(fs.readFileSync(out('quality-report.json'),'utf8'));
if(report.evidence.inputJsonSha256!==crypto.createHash('sha256').update(bytes).digest('hex'))throw new Error('Input JSON changed during audit; no complete verification claimed');
const summary=report.summary;
const coverage={
 expectedFormalCount:expected,actualFormalCount:summary.formalRows,actualCandidateCount:summary.candidateRows,
 formalRowCountMatches:summary.formalRows===expected,
 candidateRowCountMatches:summary.candidateRows===expected,
 formalUniqueCountMatches:summary.uniqueFormalIds===expected,
 candidateUniqueCountMatches:summary.uniqueCandidateIds===expected,
 noMissingIds:report.integrity.formalMissingIdRows.length===0&&report.integrity.candidateMissingIdRows.length===0,
 sameParkIdSet:report.integrity.missingCandidateIds.length===0&&!report.records.some(r=>r.reasons.includes('候選找不到正式公園')),
 noDuplicateIds:report.integrity.duplicateFormalIds.length===0&&report.integrity.duplicateCandidateIds.length===0,
};
coverage.historicalPopulationCoveragePassed=Object.entries(coverage).filter(([k])=>!k.startsWith('actual')&&k!=='expectedFormalCount').every(([,v])=>v===true);
const excluded=new Set(report.scopeSelection.excludedKnownNonNtpcFormalIds),parkRows=data.parks.filter(p=>!excluded.has(String(p['公園ID']??'').trim()));
const parksById=new Map();
for(const p of parkRows) {const id=String(p['公園ID']??'').trim();if(!parksById.has(id))parksById.set(id,p);}
const all=[];
for(const [id,p] of parksById) {
 const candidates=report.records.filter(r=>r.id===id);
 if(candidates.length)all.push(...candidates);
 else all.push({id,name:p['公園名稱'],officialAddress:p['地址'],officialDistrict:p['行政區'],officialSourceUrl:p['來源網址'],googleFormattedAddress:'',grade:'C',reasons:['正式公園缺少候選紀錄'],candidateLatitude:null,candidateLongitude:null,officialLatitude:p['緯度'],officialLongitude:p['經度'],distanceFromOfficialMeters:null,reviewStatus:null});
}
const writeJson=(file,value)=>fs.writeFileSync(out(file),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
const columns=['id','name','officialDistrict','officialAddress','googleFormattedAddress','officialSourceUrl','grade','reasons','reviewStatus','locationType','candidateLatitude','candidateLongitude','officialLatitude','officialLongitude','distanceFromOfficialMeters','candidateRow'];
function csvCell(value) {
 let str=Array.isArray(value)?value.join('；'):String(value??'');
 if(/^[\s\u0000-\u001f]*[=+@-]/.test(str))str="'"+str;
 return '"'+str.replaceAll('"','""')+'"';
}
function writeCsv(file,rows) {fs.writeFileSync(out(file),'\ufeff'+[columns,...rows.map(r=>columns.map(c=>r[c]))].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n',{flag:'wx',mode:0o600});}
writeCsv('parks-all.csv',all);
writeCsv('manual-review.csv',all.filter(r=>!report.approved.some(a=>a.id===r.id)));
writeCsv('high-risk.csv',report.records.filter(r=>r.grade==='C'));
writeCsv('failed-location.csv',report.failedLocation);
writeCsv('district-conflicts.csv',report.records.filter(r=>r.reasons.some(s=>/行政區|縣市/.test(s))));
writeCsv('unmatched-candidates.csv',report.records.filter(r=>!parksById.has(r.id)));
const groups=new Map();
function addCoordinate(id,lat,lng,source) {
 const strict=v=>(typeof v==='number'||typeof v==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v.trim()))&&Number.isFinite(Number(v));
 if(!strict(lat)||!strict(lng)||Number(lat)<24.7||Number(lat)>25.4||Number(lng)<121.2||Number(lng)>122.1)return;
 const key=Number(lat).toFixed(6)+','+Number(lng).toFixed(6);
 if(!groups.has(key))groups.set(key,[]);groups.get(key).push({id,source});
}
for(const r of report.records)addCoordinate(r.id,r.candidateLatitude,r.candidateLongitude,'candidate');
for(const [id,p] of parksById)addCoordinate(id,p['緯度'],p['經度'],'official');
writeJson('duplicate-coordinates.json',Array.from(groups,([coordinate,records])=>({coordinate,records})).filter(g=>new Set(g.records.map(r=>r.id)).size>1));
const inventory=Object.values(evidence.inventory);
const formulaCells=inventory.flatMap(i=>i.formulaCells.map(c=>({sheet:i.sheet,...c})));
const copyPlan={
 status:'OFFLINE_PLAN_ONLY',readyForCopyExecution:false,productionWritesAuthorized:false,
 sourceWorkbookSha256:evidence.sourceSha256,inputJsonSha256:crypto.createHash('sha256').update(bytes).digest('hex'),
 populationCoverage:coverage,formulaCells,
 eligibleByExportedReviewValues:report.approved,approvalRejected:report.approvalRejected||[],
 protectedValidOfficialCoordinateCount:summary.validFormalCoordinates,
 rule:'A/B/C grading never grants approval; preserve every existing nonempty official coordinate and pending review status.',
 steps:['Verify expected population and every anomaly against original public sources; preserve source URLs and timestamps.',
 'Create a separate Sheets copy; verify a different spreadsheet ID and access scope before any copy write.',
 'Read back the copy, inspect formulas and raw schema, and compare it to the imported file fingerprint.',
 'Use only explicitly reviewed IDs in B4-5 preview; keep all pending IDs unchanged.',
 'Back up the copy and journal before/after values; exercise idempotence, fault recovery and search regressions in the copy.',
 'Read back the copy through Google API. Offline tests cannot validate actual Sheets writes.',
 'Keep production disconnected. Production sync requires a separate concrete diff and explicit user confirmation.'],
};
writeJson('copy-sync-plan.json',copyPlan);
writeJson('public-crosscheck-pending.json',all.map(r=>({id:r.id,name:r.name,officialAddress:r.officialAddress||'',googleFormattedAddress:r.googleFormattedAddress||'',officialSourceUrl:r.officialSourceUrl||'',status:'PENDING_PUBLIC_SOURCE_CHECK',evidence:[],entranceConfirmed:false})));
const uniqueFailureVerified=coverage.historicalPopulationCoveragePassed && report.failedLocation.length===1 && Boolean(report.failedLocation[0].id);
const receipt={source:evidence,coverage,summary,locationFailureCount:report.failedLocation.length,
 uniqueInvalidCandidateId:uniqueFailureVerified?report.failedLocation[0].id:null,
 invalidCandidateUniquenessVerified:uniqueFailureVerified,
 crossValidationStatus:'not_performed_by_this_offline_tool; public-source review must be completed by the agent after records are received',
 actualGoogleSheetsWriteVerified:false};
writeJson('verification-receipt.json',receipt);
fs.writeFileSync(out('README.md'),`# 公園匯出資料稽核\n\n來源 XLSX SHA-256：${evidence.sourceSha256}\n\n正式列 ${summary.formalRows}，候選列 ${summary.candidateRows}；A/B/C：${summary.grades.A}/${summary.grades.B}/${summary.grades.C}。\n\n歷史 ${expected} 筆母體覆蓋檢查：${coverage.historicalPopulationCoveragePassed?'通過':'未通過，先調查差異'}。定位失敗 ${report.failedLocation.length} 筆；${uniqueFailureVerified?'完整母體中唯一失敗 ID：'+report.failedLocation[0].id:'尚不能確認完整母體中唯一失敗，不指定唯一 ID'}。\n\n逐筆結果見 parks-all.csv，人工與高風險清單另列。可信公開來源交叉驗證尚須由代理繼續執行，不能以 Google 定位類型當作入口驗收。\n\n本報告只驗證使用者匯出檔；來源匯出時間與 Google revision 未經 API 證實，Google Sheets 實際寫入未驗證，正式資料寫入未授權。\n`,{flag:'wx',mode:0o600});
console.log(JSON.stringify({coverage,summary,uniqueInvalidCandidateId:receipt.uniqueInvalidCandidateId,artifacts:fs.readdirSync(outputDir)},null,2));
