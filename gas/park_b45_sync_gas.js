/**
 * PapaKing B4-5: audited park coordinate promotion.
 * Add this file to the SAME existing Apps Script project.
 * 1. runPapaKingParkB45Preview()  -> logs only, no writes.
 * 2. runPapaKingParkB45Sync()     -> writes approved coordinates only.
 * Both functions are restricted to the four reviewed park IDs.
 */
var PAPAKING_B45_IDS_ = ['NP-9', 'NP-12', 'NP-112', 'NP-333'];
var PAPAKING_B45_REVIEW_HEADERS_ = ['公園ID','公園名稱','檢核分級','檢核原因','候選緯度','候選經度','原始定位類型','人工審核結果','修正地址／地點','Google 地圖參考連結','人工審核備註','修正後緯度','修正後經度','修正座標來源','修正座標驗收'];
var PAPAKING_B45_PROD_HEADERS_ = ['公園ID','縣市','行政區','公園名稱','地址','緯度','經度','管理單位','資料來源ID','原始資料ID','來源網址','資料更新日期','同步時間','資料狀態','備註'];

function runPapaKingParkB45Preview() {
  papaKingParkB45Run_(false);
}
function runPapaKingParkB45Sync() {
  papaKingParkB45Run_(true);
}

function papaKingParkB45Run_(write) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('其他作業正在執行，請稍後再試');
  try {
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('PARK_SHEET_ID');
    if (!spreadsheetId) throw new Error('PARK_SHEET_ID 未設定');
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var review = ss.getSheetByName('公園座標品質檢核');
    var prod = ss.getSheetByName('公園資料');
    if (!review || !prod) throw new Error('缺少公園資料或公園座標品質檢核工作表');
    papaKingParkB45CheckHeaders_(review, PAPAKING_B45_REVIEW_HEADERS_);
    papaKingParkB45CheckHeaders_(prod, PAPAKING_B45_PROD_HEADERS_);
    var reviewRows = review.getRange(2, 1, review.getLastRow() - 1, 15).getValues();
    var prodRows = prod.getRange(2, 1, prod.getLastRow() - 1, 15).getValues();
    var reviewMap = papaKingParkB45Index_(reviewRows);
    var prodMap = papaKingParkB45Index_(prodRows);
    var plan = [];
    var errors = [];
    PAPAKING_B45_IDS_.forEach(function(id) {
      var r = reviewMap[id], p = prodMap[id];
      if (!r || !p) { errors.push(id + ': 缺少或重複公園 ID'); return; }
      var rv = r.values, pv = p.values;
      if (String(rv[14]).trim() !== '已確認') { errors.push(id + ': 尚未通過人工驗收'); return; }
      if (String(rv[7]).trim() !== '需要修正') { errors.push(id + ': H 欄不是需要修正，請人工複核'); return; }
      var lat = Number(rv[11]), lng = Number(rv[12]);
      if (rv[11] === '' || rv[12] === '' || !isFinite(lat) || !isFinite(lng) ||
          lat < 24.7 || lat > 25.4 || lng < 121.2 || lng > 122.1) {
        errors.push(id + ': 修正座標缺失或超出新北市檢核範圍'); return;
      }
      if (!String(rv[13]).trim()) { errors.push(id + ': 缺少修正座標來源'); return; }
      if (String(rv[1]).trim() !== String(pv[3]).trim()) {
        errors.push(id + ': 公園名稱不一致'); return;
      }
      if (String(pv[1]).trim() !== '新北市' || String(pv[8]).trim() !== 'NTPC_PARK') {
        errors.push(id + ': 正式資料來源或縣市不符'); return;
      }
      if (pv[5] !== '' || pv[6] !== '' || String(pv[13]).trim() !== '待定位') {
        errors.push(id + ': 正式資料已有座標或狀態不是待定位，拒絕覆寫'); return;
      }
      var memo = String(pv[14] || '');
      var append = 'B4-5人工驗收座標：' + lat + ',' + lng +
        '；來源：' + String(rv[13]).trim() + '；品質檢核公園ID：' + id;
      plan.push({id:id, row:p.row, lat:lat, lng:lng, memo:memo ? memo + '；' + append : append});
    });
    Logger.log('B4-5 ' + (write ? '正式同步' : '預覽') + '：符合 ' + plan.length + '/' + PAPAKING_B45_IDS_.length + ' 筆');
    plan.forEach(function(x) { Logger.log(x.id + ' -> 公園資料 row ' + x.row + ': ' + x.lat + ', ' + x.lng); });
    errors.forEach(function(x) { Logger.log('阻擋：' + x); });
    if (errors.length) throw new Error('驗證未全數通過，未寫入任何資料：' + errors.join(' | '));
    if (!write) { Logger.log('預覽完成，正式公園資料未修改。確認後再執行 runPapaKingParkB45Sync()'); return; }
    // Write each row only after the entire batch has passed preflight.
    // Original address and source fields are not touched.
    plan.forEach(function(x) {
      prod.getRange(x.row, 6, 1, 2).setValues([[x.lat, x.lng]]);
      prod.getRange(x.row, 14).setValue('可用');
      prod.getRange(x.row, 15).setValue(x.memo);
      Logger.log('已同步 ' + x.id);
    });
    SpreadsheetApp.flush();
    plan.forEach(function(x) {
      var v = prod.getRange(x.row, 6, 1, 2).getValues()[0];
      var status = prod.getRange(x.row, 14).getDisplayValue();
      if (Number(v[0]) !== x.lat || Number(v[1]) !== x.lng || status !== '可用') {
        throw new Error('寫入後驗證失敗：' + x.id + '，請立即檢查正式表');
      }
    });
    Logger.log('B4-5 正式同步完成，4/4 筆已重新讀取驗證。');
  } finally {
    lock.releaseLock();
  }
}
function papaKingParkB45CheckHeaders_(sheet, expected) {
  var actual = sheet.getRange(1, 1, 1, expected.length).getDisplayValues()[0];
  if (actual.join('|') !== expected.join('|')) throw new Error(sheet.getName() + ' 欄位名稱或順序不符，停止');
}
function papaKingParkB45Index_(rows) {
  var map = {}, duplicate = {};
  rows.forEach(function(values, i) {
    var id = String(values[0] || '').trim();
    if (!id) return;
    if (map[id]) { duplicate[id] = true; return; }
    map[id] = {row:i+2, values:values};
  });
  Object.keys(duplicate).forEach(function(id) { delete map[id]; });
  return map;
}
