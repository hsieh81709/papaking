import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,fixture,plain,approve} from './helpers.mjs';
const ids=['NP-9','NP-12'];
test('preview includes exact before/after and fingerprint without writing or creating backup',()=>{
 const h=harness();fixture(h);const p=h.context.runPapaKingParkB45Preview(ids);
 assert.equal(p.changes.length,2);assert.match(p.fingerprint,/^[0-9a-f]{64}$/);assert.equal(p.changes[0].before[0],'');assert.equal(h.events.length,0);assert.equal(h.sheets.size,2);
});
test('missing confirmation and stale data refuse writes',()=>{
 const h=harness(),{rs}=fixture(h);const p=h.context.runPapaKingParkB45Preview(ids);
 assert.throws(()=>h.context.runPapaKingParkB45Sync(),/明確確認/);
 rs.data[1][13]='different source';assert.throws(()=>h.context.runPapaKingParkB45Sync(approve(p)),/預覽已過期/);assert.equal(h.events.length,0);
});
test('changed approved IDs cannot reuse an earlier fingerprint',()=>{
 const h=harness();fixture(h);const p=h.context.runPapaKingParkB45Preview(ids),a=approve(p);a.ids=['NP-9'];assert.throws(()=>h.context.runPapaKingParkB45Sync(a),/預覽已過期/);
});
for(const [name,modify,pattern] of [
 ['pending review',({rs})=>{rs.data[1][14]='待確認';},/人工核准/],
 ['grade A alone',({rs})=>{rs.data[1][7]='待確認';},/人工核准/],
 ['missing source',({rs})=>{rs.data[1][13]='';},/來源/],
 ['blank coordinate',({rs})=>{rs.data[1][11]=' ';},/座標無效/],
 ['boolean coordinate',({rs})=>{rs.data[1][11]=true;},/座標無效/],
 ['out of range',({rs})=>{rs.data[1][12]=119;},/座標無效/],
 ['existing confirmed coordinates',({ps})=>{ps.data[1][5]=25.02;ps.data[1][6]=121.46;ps.data[1][13]='已確認';},/拒絕覆寫/],
 ['partial invalid existing coordinates',({ps})=>{ps.data[1][5]='bad';},/拒絕覆寫/],
 ['wrong city',({ps})=>{ps.data[1][1]='台北市';},/縣市/],
 ['wrong source',({ps})=>{ps.data[1][8]='UNKNOWN';},/來源/],
 ['wrong name',({rs})=>{rs.data[1][1]='其他公園';},/名稱/],
 ['duplicate prod ID',({ps})=>{ps.data.push([...ps.data[1]]);},/ID 重複/],
 ['duplicate review ID',({rs})=>{rs.data.push([...rs.data[1]]);},/ID 重複/],
 ['missing ID',({ps})=>{ps.data[1][0]='';},/ID 缺漏/],
 ['header drift',({ps})=>{ps.data[0][5]='緯度_changed';},/欄位名稱/],
 ['production formula',({ps})=>{ps.formulas.set('2,6','=IMPORTDATA("example")');},/包含公式/],
 ['approval formula',({rs})=>{rs.formulas.set('2,15','="已確認"');},/包含公式/]
])test(`reject ${name} without touching sheets`,()=>{
 const h=harness(),f=fixture(h);modify(f);assert.throws(()=>h.context.runPapaKingParkB45Preview(ids),pattern);assert.equal(h.events.length,0);
});
test('empty sheets fail on missing IDs, not a zero-height range',()=>{
 const h=harness(),{ps,rs}=fixture(h);ps.data.length=1;rs.data.length=1;assert.throws(()=>h.context.runPapaKingParkB45Preview(ids),/缺少正式資料/);
});
test('backup and durable journal precede production; unrelated cells survive; rerun is NOOP',()=>{
 const h=harness(),{ps}=fixture(h),before=structuredClone(ps.data);
 const result=h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids)));
 assert.equal(result.state,'COMMITTED');assert.ok(h.sheets.has(result.backup));assert.deepEqual(h.sheets.get(result.backup).data,before);
 const prodWrite=h.events.findIndex(e=>e.type==='write'&&e.sheet==='公園資料');
 assert.ok(h.events.findIndex(e=>e.type==='backup')<prodWrite);
 assert.ok(h.events.slice(0,prodWrite).some(e=>e.sheet==='公園座標同步紀錄'&&e.value==='PREPARED'));
 for(let r=1;r<ps.data.length;r++) {
  assert.equal(ps.data[r][13],'可用');assert.ok(ps.data[r][12]);
  for(const c of [0,1,2,3,4,7,8,9,10,11])assert.equal(ps.data[r][c],before[r][c]);
 }
 const count=h.events.length;
 const again=h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids)));
 assert.equal(again.state,'NOOP');assert.equal(h.events.length,count);
});
for(let fail=1;fail<=10;fail++)test(`production write failure ${fail}/10 restores entire batch`,()=>{
 const h=harness(),{ps}=fixture(h),before=structuredClone(ps.data);let n=0;
 h.failWhen(e=>e.sheet==='公園資料'&&++n===fail);
 assert.throws(()=>h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids))),/已回復/);
 assert.deepEqual(ps.data,before);
 assert.ok(h.sheets.get('公園座標同步紀錄').data.slice(1).every(r=>r[7]==='ROLLED_BACK'));
});
test('journal failure blocks all production writes',()=>{
 const h=harness(),{ps}=fixture(h),before=structuredClone(ps.data);
 h.failWhen(e=>e.sheet==='公園座標同步紀錄'&&e.row===3);
 assert.throws(()=>h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids))),/injected/);assert.deepEqual(ps.data,before);
});
test('backup failure blocks all production writes',()=>{
 const h=harness(),{ps}=fixture(h),before=structuredClone(ps.data);ps.copyTo=()=>{throw new Error('backup denied');};
 assert.throws(()=>h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids))),/backup denied/);assert.deepEqual(ps.data,before);
});
test('data changed during backup is caught before production writes',()=>{
 const h=harness(),{ps}=fixture(h),copy=ps.copyTo.bind(ps);
 ps.copyTo=()=>{const result=copy();ps.data[1][4]='concurrent address';return result;};
 assert.throws(()=>h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids))),/備份期間資料已變更/);
 assert.equal(h.events.filter(e=>e.sheet==='公園資料'&&e.type==='write').length,0);
});
test('explicit recovery preview and rollback restore original types including Date',()=>{
 const h=harness(),{ps}=fixture(h);ps.data[1][12]=new Date('2026-01-01T00:00:00Z');const before=structuredClone(ps.data);
 const result=h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids)));
 const preview=h.context.runPapaKingParkB45RecoveryPreview(result.runId);
 const approval={...approve(preview),runId:result.runId,confirmation:'確認回復正式公園資料'};
 assert.equal(h.context.runPapaKingParkB45Rollback(approval).state,'ROLLED_BACK');
 assert.equal(ps.data[1][12].toISOString(),before[1][12].toISOString());assert.deepEqual(plain(ps.data),plain(before));
});
test('recovery refuses to overwrite an external edit and stale preview',()=>{
 const h=harness(),{ps}=fixture(h);const result=h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids)));
 const preview=h.context.runPapaKingParkB45RecoveryPreview(result.runId);ps.data[1][5]=25.2;
 assert.throws(()=>h.context.runPapaKingParkB45Rollback({...approve(preview),runId:result.runId,confirmation:'確認回復正式公園資料'}),/預覽已過期/);
 const current=h.context.runPapaKingParkB45RecoveryPreview(result.runId);
 assert.throws(()=>h.context.runPapaKingParkB45Rollback({...approve(current),runId:result.runId,confirmation:'確認回復正式公園資料'}),/外部修改衝突/);assert.equal(ps.data[1][5],25.2);
});
test('crash recovery handles partial cells left in PREPARED journal',()=>{
 const h=harness(),{ps}=fixture(h),before=structuredClone(ps.data);
 const result=h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids)));
 const journal=h.sheets.get('公園座標同步紀錄');journal.data.slice(1).forEach(r=>{r[7]='PREPARED';});
 ps.data[1][6]=before[1][6];ps.data[1][12]=before[1][12];ps.data[2]=structuredClone(before[2]);
 const p=h.context.runPapaKingParkB45RecoveryPreview(result.runId);
 h.context.runPapaKingParkB45Rollback({...approve(p),runId:result.runId,confirmation:'確認回復正式公園資料'});
 assert.deepEqual(ps.data,before);
});
test('lock contention rejects production sync',()=>{
 const h=harness();fixture(h);const approval=approve(h.context.runPapaKingParkB45Preview(ids));h.context.LockService.getScriptLock=()=>({tryLock:()=>false});assert.throws(()=>h.context.runPapaKingParkB45Sync(approval),/其他作業/);
});
test('failure marking COMMITTED restores production and preserves the journal',()=>{
 const h=harness(),{ps}=fixture(h),before=structuredClone(ps.data);
 h.failWhen(e=>e.sheet==='公園座標同步紀錄'&&e.value==='COMMITTED');
 assert.throws(()=>h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids))),/已回復/);assert.deepEqual(ps.data,before);
});
test('invalid or duplicated approval IDs never create a journal',()=>{
 const h=harness();fixture(h);
 for(const bad of [[],['NP-9','NP-9'],['=BAD()'],[' NP-9'],['__proto__']])assert.throws(()=>h.context.runPapaKingParkB45Preview(bad),/核准 ID/);
 assert.equal(h.events.length,0);
});
test('damaged backup is detected before any production write',()=>{
 const h=harness(),{ps}=fixture(h),copy=ps.copyTo.bind(ps);ps.copyTo=()=>{const result=copy();result.data[1][5]='damaged';return result;};
 assert.throws(()=>h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids))),/驗證失敗/);
 assert.equal(h.events.filter(e=>e.type==='write'&&e.sheet==='公園資料').length,0);
});
test('rollback stops on concurrent third-party changes and leaves recoverable PREPARED journal',()=>{
 const h=harness(),{ps}=fixture(h);let n=0;
 h.failWhen(e=>{if(e.sheet==='公園資料'&&++n===2){ps.data[1][5]=25.2;return true;}return false;});
 assert.throws(()=>h.context.runPapaKingParkB45Sync(approve(h.context.runPapaKingParkB45Preview(ids))),/需要人工回復.*外部修改衝突/);
 assert.equal(ps.data[1][5],25.2);assert.equal(h.sheets.get('公園座標同步紀錄').data[1][7],'PREPARED');
});
