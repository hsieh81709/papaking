/**
 * PapaKing B4-3: four park re-geocoding candidates.
 * Default is read-only geocoding preview (consumes Maps quota).
 * Candidate writes require runPapaKingParkB43Regeocode('確認寫入待審候選').
 * Writes ONLY L:O of 公園座標品質檢核; never changes 公園資料 or 公園座標候選.
 */
function runPapaKingParkB43Regeocode(confirmation) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('其他作業正在執行');
  try { return papaKingParkB43Regeocode_(confirmation === '確認寫入待審候選'); }
  finally { lock.releaseLock(); }
}
function papaKingParkB43Regeocode_(write) {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('PARK_SHEET_ID');
  if (!spreadsheetId) throw new Error('PARK_SHEET_ID 未設定');
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName('公園座標品質檢核');
  if (!sheet) throw new Error('找不到公園座標品質檢核');
  var expected = ['修正後緯度', '修正後經度', '修正座標來源', '修正座標驗收'];
  var headers = sheet.getRange(1, 12, 1, 4).getDisplayValues()[0];
  if (headers.join('|') !== expected.join('|')) throw new Error('L:O 欄位名稱不符，停止寫入');
  var jobs = {
    'NP-9':   {query: '新北市八里區片仔溝公園', source: '公園名稱定位；Google 地圖連結待人工比對'},
    'NP-12':  {query: '新北市八里區八里商港公園', source: '公園名稱定位；Google 地圖連結待人工比對'},
    'NP-112': {query: '新北市土城區廣福街68巷18弄', source: '使用者修正地址定位'},
    'NP-333': {query: '220新北市板橋區長壽里長壽街27號', source: '使用者修正地址定位'}
  };
  papaKingParkB45CheckHeaders_(sheet, PAPAKING_B45_REVIEW_HEADERS_);
  var rows = papaKingParkB45Rows_(sheet);
  var indexed = papaKingParkB45Index_(rows);
  Object.keys(jobs).forEach(function(id) { if (!indexed[id]) throw new Error('找不到 ' + id); });
  var preview = [];
  var geocoder = Maps.newGeocoder().setLanguage('zh-TW').setRegion('tw');
  Object.keys(jobs).forEach(function(id) {
    var index = indexed[id].row - 2;
    var row = rows[index];
    var protectedReview = String(row[14]).trim() === '已確認' || ['核准','已確認'].indexOf(String(row[7]).trim()) >= 0;
    if (row.slice(11,15).some(function(v) { return v !== ''; }) || protectedReview || sheet.getRange(index+2,12,1,4).getFormulas()[0].some(Boolean)) {
      Logger.log(id + ' 已有修正座標，跳過避免覆寫');
      return;
    }
    var job = jobs[id];
    try {
      var response = geocoder.geocode(job.query);
      if (response.status !== 'OK' || !response.results || !response.results.length) {
        Logger.log(id + ' 查詢未成功: ' + response.status);
        return;
      }
      var first = response.results[0];
      var location = first.geometry && first.geometry.location;
      if (!location) { Logger.log(id + ' 無座標'); return; }
      var lat = parkAuditNumber_(location.lat), lng = parkAuditNumber_(location.lng);
      var inNewTaipeiBounds = parkAuditCoordinate_(lat,lng);
      var district = id === 'NP-112' ? '土城區' : id === 'NP-333' ? '板橋區' : '八里區';
      var formatted = String(first.formatted_address || '');
      var districtMatches = formatted.replace(/区/g, '區').indexOf(district) !== -1 && formatted.indexOf('新北市') !== -1;
      if (!inNewTaipeiBounds || !districtMatches) {
        Logger.log(id + ' 區域檢核未通過，未寫入: ' + formatted + ' (' + lat + ',' + lng + ')');
        return;
      }
      var source = job.source + '；Google回傳：' + formatted +
        '；類型：' + String(first.geometry.location_type || '未知');
      preview.push({id:id,lat:lat,lng:lng,source:source,status:'待人工確認'});
      if (write) {
        var current = sheet.getRange(index+2,1,1,15);
        if (JSON.stringify(current.getValues()[0]) !== JSON.stringify(row) || current.getFormulas()[0].some(Boolean)) throw new Error('審核列已變更或包含公式，拒絕覆寫');
        sheet.getRange(index + 2, 12, 1, 4).setValues([[lat, lng, source, '待人工確認']]);
      }
      Logger.log(id + ' 候選座標：' + lat + ', ' + lng + ' | ' + source);
    } catch (e) {
      Logger.log(id + ' 查詢失敗：' + String(e));
    }
    Utilities.sleep(300);
  });
  Logger.log('B4-3 ' + (write ? '候選寫入' : '唯讀預覽') + '完成；所有新座標仍須人工確認，正式公園資料未修改');
  return preview;
}
