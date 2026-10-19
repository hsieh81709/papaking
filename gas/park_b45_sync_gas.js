/** Guarded promotion. Preview is read-only. Never call Sync without user approval
 * of the EXACT preview fingerprint and IDs. No status derived from audit grade.
 * Shared script lock serializes cooperating writers, not humans/other projects.
 */
var PAPAKING_B45_IDS_ = ['NP-9', 'NP-12', 'NP-112', 'NP-333'];
var PAPAKING_B45_REVIEW_HEADERS_ = ['公園ID','公園名稱','檢核分級','檢核原因','候選緯度','候選經度','原始定位類型','人工審核結果','修正地址／地點','Google 地圖參考連結','人工審核備註','修正後緯度','修正後經度','修正座標來源','修正座標驗收'];
var PAPAKING_B45_PROD_HEADERS_ = ['公園ID','縣市','行政區','公園名稱','地址','緯度','經度','管理單位','資料來源ID','原始資料ID','來源網址','資料更新日期','同步時間','資料狀態','備註'];
var PAPAKING_B45_LOG_HEADERS_ = ['批次ID','時間','備份分頁','公園ID','正式列','修改前JSON','修改後JSON','狀態'];
var PAPAKING_B45_COLS_ = [6, 7, 13, 14, 15];
function papaKingParkB45CheckHeaders_(sheet, expected) {
  var actual = sheet.getRange(1, 1, 1, expected.length).getDisplayValues()[0];
  if (actual.join('|') !== expected.join('|')) throw new Error(sheet.getName() + ' 欄位名稱或順序不符，停止');
}
function papaKingParkB45Index_(rows) {
  var map = Object.create(null);
  rows.forEach(function(values, i) {
    if (values.every(function(v) { return v === ''; })) return;
    var id = String(values[0] == null ? '' : values[0]).trim();
    if (!id) throw new Error('公園 ID 缺漏：row ' + (i+2));
    if (map[id]) throw new Error('公園 ID 重複：' + id);
    map[id] = {row:i+2, values:values};
  });
  return map;
}
function papaKingParkB45Rows_(sheet) {
  return sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow()-1, 15).getValues();
}
function papaKingParkB45Open_() {
  var id = PropertiesService.getScriptProperties().getProperty('PARK_SHEET_ID');
  if (!id) throw new Error('PARK_SHEET_ID 未設定');
  var ss = SpreadsheetApp.openById(id), prod = ss.getSheetByName('公園資料'), review = ss.getSheetByName('公園座標品質檢核');
  if (!prod || !review) throw new Error('缺少公園資料或公園座標品質檢核工作表');
  papaKingParkB45CheckHeaders_(prod, PAPAKING_B45_PROD_HEADERS_);
  papaKingParkB45CheckHeaders_(review, PAPAKING_B45_REVIEW_HEADERS_);
  return {ss:ss, prod:prod, review:review};
}
function papaKingParkB45Pack_(value) {
  return Object.prototype.toString.call(value) === '[object Date]' ? {date:value.toISOString()} : value;
}
function papaKingParkB45Unpack_(value) { return value && typeof value === 'object' && value.date ? new Date(value.date) : value; }
function papaKingParkB45Equal_(a, b) { return JSON.stringify(papaKingParkB45Pack_(a)) === JSON.stringify(papaKingParkB45Pack_(b)); }
function papaKingParkB45Fingerprint_(data) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(data), Utilities.Charset.UTF_8);
  return bytes.map(function(b) { return ('0'+(b&255).toString(16)).slice(-2); }).join('');
}
function papaKingParkB45Plan_(prodRows, reviewRows, ids) {
  if (!Array.isArray(ids) || !ids.length || ids.some(function(id, i) { return typeof id !== 'string' || !/^NP-\d+$/.test(id) || id !== id.trim() || ids.indexOf(id) !== i; })) throw new Error('必須提供不重複的明確核准 ID');
  var pm = papaKingParkB45Index_(prodRows), rm = papaKingParkB45Index_(reviewRows), changes = [], unchanged = [], evidence = [];
  ids.slice().sort().forEach(function(id) {
    var p = pm[id], r = rm[id];
    if (!p || !r) throw new Error(id + ' 缺少正式資料或人工審核列');
    var pv = p.values, rv = r.values;
    if (String(rv[14]).trim() !== '已確認' || ['需要修正','核准'].indexOf(String(rv[7]).trim()) < 0) throw new Error(id + ' 尚未通過人工核准與座標驗收');
    if (!parkAuditCoordinate_(rv[11],rv[12])) throw new Error(id + ' 修正座標無效');
    if (!String(rv[13] || '').trim()) throw new Error(id + ' 缺少修正座標來源');
    if (String(rv[1]).trim() !== String(pv[3]).trim() || String(pv[1]).trim() !== '新北市' || String(pv[8]).trim() !== 'NTPC_PARK') throw new Error(id + ' 名稱、來源或縣市不符');
    var lat = Number(rv[11]), lng = Number(rv[12]);
    var marker = 'B4-5人工驗收座標：' + lat + ',' + lng + '；來源：' + String(rv[13]).trim() + '；品質檢核公園ID：' + id;
    evidence.push({id:id, official:pv.map(papaKingParkB45Pack_), review:rv.map(papaKingParkB45Pack_)});
    if (papaKingParkB45Equal_(pv[5],lat) && papaKingParkB45Equal_(pv[6],lng) && pv[13] === '可用' && String(pv[14]).split('；B4-5人工驗收座標：').some(function(s) { return s === marker || 'B4-5人工驗收座標：' + s === marker; })) {
      unchanged.push(id); return;
    }
    // Includes invalid nonempty coordinates: their repair requires a separate explicit review.
    if (pv[5] !== '' || pv[6] !== '' || pv[13] !== '待定位') throw new Error(id + ' 正式資料已有座標或狀態非待定位，拒絕覆寫');
    var before = PAPAKING_B45_COLS_.map(function(c) { return papaKingParkB45Pack_(pv[c-1]); });
    changes.push({id:id, row:p.row, before:before, after:[lat,lng,null,'可用',pv[14] ? String(pv[14])+'；'+marker : marker]});
  });
  return {schemaVersion:2, ids:ids.slice().sort(), fingerprint:papaKingParkB45Fingerprint_(evidence), changes:changes, unchanged:unchanged};
}
function papaKingParkB45ReadPlan_(ctx, ids) {
  var plan = papaKingParkB45Plan_(papaKingParkB45Rows_(ctx.prod), papaKingParkB45Rows_(ctx.review), ids);
  plan.changes.forEach(function(change) {
    var formulas = ctx.prod.getRange(change.row,1,1,15).getFormulas()[0];
    if (formulas.some(Boolean)) throw new Error(change.id + ' 正式列包含公式，拒絕覆寫');
    var reviewRow = papaKingParkB45Index_(papaKingParkB45Rows_(ctx.review))[change.id].row;
    if (ctx.review.getRange(reviewRow,1,1,15).getFormulas()[0].some(Boolean)) throw new Error(change.id + ' 人工核准列包含公式，必須使用明確值');
  });
  return plan;
}
function runPapaKingParkB45Preview(ids) {
  var ctx = papaKingParkB45Open_(), plan = papaKingParkB45ReadPlan_(ctx, ids || PAPAKING_B45_IDS_);
  Logger.log(JSON.stringify(plan));
  return plan;
}
function papaKingParkB45Confirm_(approval, phrase) {
  if (!approval || approval.confirmation !== phrase || !approval.fingerprint || !Array.isArray(approval.ids)) throw new Error('必須先取得使用者對本次預覽的明確確認，並傳入 fingerprint、ids、confirmation');
}
function papaKingParkB45WriteCell_(cell, value) {
  value = papaKingParkB45Unpack_(value);
  if (typeof value === 'string' && /^\s*[=+@]/.test(value)) throw new Error('拒絕可能的試算表公式');
  cell.setValue(value);
}
function runPapaKingParkB45Sync(approval) {
  papaKingParkB45Confirm_(approval, '確認寫入正式公園資料');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('其他作業正在執行');
  try {
    var ctx = papaKingParkB45Open_(), plan = papaKingParkB45ReadPlan_(ctx, approval.ids);
    if (plan.fingerprint !== approval.fingerprint) throw new Error('預覽已過期，正式資料或審核資料已變更');
    if (!plan.changes.length) return {state:'NOOP', unchanged:plan.unchanged};
    var runId = Utilities.getUuid(), time = new Date().toISOString();
    plan.changes.forEach(function(c) {
      c.after[2] = time;
      if (JSON.stringify(c).length > 45000) throw new Error('變更紀錄過長');
    });
    // Full backup and persistent before/after journal must complete BEFORE production writes.
    var backup = ctx.prod.copyTo(ctx.ss).setName('公園備份_' + runId);
    papaKingParkB45Verify_(backup,plan.changes,'before');
    var log = ctx.ss.getSheetByName('公園座標同步紀錄');
    if (!log) { log = ctx.ss.insertSheet('公園座標同步紀錄'); log.appendRow(PAPAKING_B45_LOG_HEADERS_); }
    papaKingParkB45CheckHeaders_(log, PAPAKING_B45_LOG_HEADERS_);
    var firstLogRow = log.getLastRow() + 1;
    var journal = plan.changes.map(function(c) { return [runId,time,backup.getName(),c.id,c.row,JSON.stringify(c.before),JSON.stringify(c.after),'PREPARED']; });
    log.getRange(firstLogRow,1,journal.length,8).setValues(journal);
    SpreadsheetApp.flush();
    Logger.log('B4-5批次 '+runId+' 已備份並記錄PREPARED；正式寫入開始前再次驗證');
    // Revalidate after backup: helpers in other projects/manual edits do not share our lock.
    if (papaKingParkB45ReadPlan_(ctx, approval.ids).fingerprint !== plan.fingerprint) throw new Error('備份期間資料已變更，未寫入正式資料；保留PREPARED紀錄');
    try {
      plan.changes.forEach(function(c) {
        PAPAKING_B45_COLS_.forEach(function(col,i) {
          if (String(ctx.prod.getRange(c.row,1).getValue()).trim() !== c.id) throw new Error(c.id + ' 列位置變更');
          var cell = ctx.prod.getRange(c.row,col);
          if (!papaKingParkB45Equal_(cell.getValue(),papaKingParkB45Unpack_(c.before[i]))) throw new Error(c.id + ' 寫入前資料衝突');
          papaKingParkB45WriteCell_(cell,c.after[i]);
        });
      });
      SpreadsheetApp.flush();
      papaKingParkB45Verify_(ctx.prod, plan.changes, 'after');
      log.getRange(firstLogRow,8,journal.length,1).setValues(journal.map(function() { return ['COMMITTED']; }));
      SpreadsheetApp.flush();
      return {runId:runId, state:'COMMITTED', backup:backup.getName(), changes:plan.changes};
    } catch (error) {
      try {
        papaKingParkB45Restore_(ctx.prod,plan.changes);
        log.getRange(firstLogRow,8,journal.length,1).setValues(journal.map(function() { return ['ROLLED_BACK']; }));
        SpreadsheetApp.flush();
      } catch (restoreError) {
        throw new Error('批次 '+runId+' 需要人工回復；原始錯誤：'+error.message+'；回復錯誤：'+restoreError.message);
      }
      throw new Error('批次 '+runId+' 已回復：'+error.message);
    }
  } finally { lock.releaseLock(); }
}
function papaKingParkB45Verify_(prod, changes, key) {
  changes.forEach(function(c) {
    if (String(prod.getRange(c.row,1).getValue()).trim() !== c.id) throw new Error(c.id + ' 列位置變更');
    PAPAKING_B45_COLS_.forEach(function(col,i) {
      var cell = prod.getRange(c.row,col);
      if (cell.getFormulas()[0][0] || !papaKingParkB45Equal_(cell.getValue(),papaKingParkB45Unpack_(c[key][i]))) throw new Error(c.id + ' 寫入後驗證失敗');
    });
  });
}
function papaKingParkB45Restore_(prod, changes) {
  // Preflight the WHOLE batch; never clobber a value written by another editor.
  changes.forEach(function(c) {
    if (String(prod.getRange(c.row,1).getValue()).trim() !== c.id) throw new Error(c.id + ' 列位置變更');
    PAPAKING_B45_COLS_.forEach(function(col,i) {
      var cell = prod.getRange(c.row,col), v = cell.getValue();
      if (cell.getFormulas()[0][0] || !papaKingParkB45Equal_(v,papaKingParkB45Unpack_(c.before[i])) && !papaKingParkB45Equal_(v,papaKingParkB45Unpack_(c.after[i]))) throw new Error(c.id + ' 外部修改衝突，停止回復');
    });
  });
  changes.forEach(function(c) { PAPAKING_B45_COLS_.forEach(function(col,i) { papaKingParkB45WriteCell_(prod.getRange(c.row,col),c.before[i]); }); });
  SpreadsheetApp.flush();
  papaKingParkB45Verify_(prod,changes,'before');
}
/** Manual recovery after timeout/crash. First call preview; obtain approval of
 * its fingerprint before calling rollback. Backup/journal never deleted. */
function runPapaKingParkB45RecoveryPreview(runId) {
  var ctx = papaKingParkB45Open_(), log = ctx.ss.getSheetByName('公園座標同步紀錄');
  if (!log) throw new Error('缺少同步紀錄');
  papaKingParkB45CheckHeaders_(log,PAPAKING_B45_LOG_HEADERS_);
  var records = log.getDataRange().getValues().slice(1).map(function(r,i) { return {values:r,row:i+2}; }).filter(function(r) { return r.values[0] === runId; });
  if (!records.length) throw new Error('找不到批次');
  var changes = records.map(function(r) {
    var v = r.values;
    if (!ctx.ss.getSheetByName(v[2])) throw new Error('備份分頁遺失');
    var before = JSON.parse(v[5]), after = JSON.parse(v[6]);
    if (!Array.isArray(before) || !Array.isArray(after) || before.length !== 5 || after.length !== 5) throw new Error('同步紀錄格式錯誤');
    return {id:v[3],row:v[4],before:before,after:after};
  });
  if (changes.some(function(c,i) { return !Number.isInteger(c.row) || c.row<2 || changes.some(function(other,j) { return i!==j && (other.id===c.id || other.row===c.row); }); })) throw new Error('同步紀錄ID或列位置重複／無效');
  var current = changes.map(function(c) { return {id:c.id,row:c.row,values:ctx.prod.getRange(c.row,1,1,15).getValues()[0].map(papaKingParkB45Pack_)}; });
  var preview = {runId:runId, ids:changes.map(function(c) { return c.id; }), fingerprint:papaKingParkB45Fingerprint_({records:records,current:current}), changes:changes, logRows:records.map(function(r) { return r.row; })};
  Logger.log(JSON.stringify(preview)); return preview;
}
function runPapaKingParkB45Rollback(approval) {
  papaKingParkB45Confirm_(approval,'確認回復正式公園資料');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('其他作業正在執行');
  try {
    var ctx = papaKingParkB45Open_(), p = runPapaKingParkB45RecoveryPreview(approval.runId);
    if (p.fingerprint !== approval.fingerprint || JSON.stringify(p.ids) !== JSON.stringify(approval.ids)) throw new Error('回復預覽已過期或ID不符');
    papaKingParkB45Restore_(ctx.prod,p.changes);
    var log = ctx.ss.getSheetByName('公園座標同步紀錄');
    p.logRows.forEach(function(row) { log.getRange(row,8).setValue('ROLLED_BACK'); });
    SpreadsheetApp.flush();
    return {state:'ROLLED_BACK',runId:p.runId};
  } finally { lock.releaseLock(); }
}
