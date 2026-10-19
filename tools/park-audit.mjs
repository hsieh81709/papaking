#!/usr/bin/env node
// Offline only: node tools/park-audit.mjs /path/export.json /path/report.json
// No network, credential handling, spreadsheet writes or LINE calls.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node tools/park-audit.mjs INPUT.json NEW_REPORT.json');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const required = {
  parks: ['公園ID','縣市','行政區','公園名稱','地址','緯度','經度','資料狀態'],
  candidates: ['公園ID','候選緯度','候選經度','Google回傳地址','定位類型','審核狀態'],
  facilities: ['公園ID','可查詢遊具類別（依休憩設施）','遊戲場名稱']
};
for (const [key, fields] of Object.entries(required)) {
  if (!Array.isArray(data[key])) throw new Error(`${key} must be an array`);
  for (const [index,row] of data[key].entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || fields.some(f=>!Object.hasOwn(row,f))) throw new Error(`${key}[${index}] missing canonical fields`);
  }
}
const context = vm.createContext({Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(v).digest())}});
for (const file of ['park_geocoding_gas.js','park_b45_sync_gas.js']) vm.runInContext(fs.readFileSync(path.join(root,'gas',file),'utf8'),context,{filename:file});
const scope=context.parkAuditNewTaipeiScope_(data.parks,data.candidates,data.facilities,null);
const report = context.parkAuditData_(scope.parks, scope.candidates, scope.facilities);
report.scopeSelection=scope.selection;
report.evidence = {source:'user-supplied offline export; not a live Sheets verification', generatedAt:new Date().toISOString()};
// No approval list is inferred from grading; reject an ambiguous/invalid review schema.
if (data.reviews !== undefined) {
  if (!Array.isArray(data.reviews)) throw new Error('reviews must be an array');
  const keys = Array.from(context.PAPAKING_B45_REVIEW_HEADERS_);
  if (data.reviews.some(row=>!row || keys.some(k=>!Object.hasOwn(row,k)))) throw new Error('reviews missing canonical fields');
  const reviewedScope=context.parkAuditNewTaipeiScope_(data.parks,data.candidates,data.facilities,data.reviews);
  context.parkAuditReviewApprovals_(report,reviewedScope.parks,reviewedScope.reviews);
}
fs.writeFileSync(output, JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify(report.summary,null,2));
