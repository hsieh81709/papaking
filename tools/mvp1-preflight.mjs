/** Generate auditable OFFLINE P0-3 evidence, never reads credentials or calls APIs. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {validateMessages} from './line-preflight.mjs';
import {router,fixture} from '../test/line/helpers.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(root,process.argv[2]||'.local/mvp1-p03-20261021');
fs.mkdirSync(out,{recursive:true});
const candidate=execFileSync('git',['rev-parse','855f5f2'],{cwd:root,encoding:'utf8'}).trim();
const names=['line_webhook_gas.js','park_search_gas.js','facility_search_gas.js','facility_line_gas.js','appsscript.json'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=names.map(n=>{const p='gas/'+n,b=fs.readFileSync(path.join(root,p));const committed=execFileSync('git',['show',`${candidate}:${p}`],{cwd:root});return {path:p,bytes:b.length,sha256:hash(b),matchesCandidate:b.equals(committed)};});
const h=router({realPark:true}),messages={};
h.text('選單');messages.menu=h.sent.at(-1).messages;
for(const [kind,t] of [['parking','停車'],['park','附近公園'],['toilet','附近公廁']]){
 h.text(t);messages[kind+'Prompt']=h.sent.at(-1).messages;h.location();
 // Parking router is a delegate stub; use the actual renderer independently.
 messages[kind]=kind==='parking'?[h.c.buildFlexCarousel([{kind:'停車場',title:'合成停車場',lines:['直線距離約500公尺'],lat:25,lon:121.46}])]:h.sent.at(-1).messages;
}
const five=router({rows:Array.from({length:6},(_,i)=>({...fixture.record,'公廁ID':`SYNTHETIC-${i}`,'緯度':25+i*.0001}))});five.text('附近公廁');five.location();messages.fiveToilets=five.sent.at(-1).messages;
const empty=router({releases:[]});empty.text('附近公廁');empty.location();messages.noApprovedToilets=empty.sent.at(-1).messages;
const validation=Object.entries(messages).map(([name,batch])=>({name,bytes:Buffer.byteLength(JSON.stringify(batch)),errors:validateMessages(batch)}));
const receipt={generatedAt:new Date().toISOString(),candidate,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),mode:'OFFLINE_SYNTHETIC_ONLY',officialLineValidation:'NOT_EXERCISED',liveGasComparison:'NOT_EXERCISED',files,validation};
for(const [name,value] of [['SOURCE_MANIFEST.json',receipt],['LINE_MESSAGES.json',{notice:'合成資料；停車只執行renderer；不是官方schema或投遞驗收。',messages}]])fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({out,candidate,files:files.length,batches:validation.length,errors:validation.reduce((s,v)=>s+v.errors.length,0)}));
if(files.some(f=>!f.matchesCandidate)||validation.some(v=>v.errors.length))process.exitCode=1;
