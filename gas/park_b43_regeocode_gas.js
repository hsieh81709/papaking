/**
 * PapaKing B4-3: four park re-geocoding candidates.
 * Run manually in Apps Script: runPapaKingParkB43Regeocode()
 * Writes ONLY L:O of 公園座標品質檢核; never changes 公園資料 or 公園座標候選.
 */
function runPapaKingParkB43Regeocode() {
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
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues();
  var found = {};
  var geocoder = Maps.newGeocoder().setLanguage('zh-TW').setRegion('tw');
  Object.keys(jobs).forEach(function(id) {
    var index = rows.findIndex(function(row) { return String(row[0]) === id; });
    if (index < 0) throw new Error('找不到 ' + id);
    if (found[id]) throw new Error('重複 ID ' + id);
    found[id] = true;
    var row = rows[index];
    if (row[11] !== '' || row[12] !== '') {
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
      var lat = Number(location.lat), lng = Number(location.lng);
      var inNewTaipeiBounds = isFinite(lat) && isFinite(lng) &&
        lat >= 24.7 && lat <= 25.4 && lng >= 121.2 && lng <= 122.1;
      var district = id === 'NP-112' ? '土城區' : id === 'NP-333' ? '板橋區' : '八里區';
      var formatted = String(first.formatted_address || '');
      var districtMatches = formatted.replace(/区/g, '區').indexOf(district) !== -1;
      if (!inNewTaipeiBounds || !districtMatches) {
        Logger.log(id + ' 區域檢核未通過，未寫入: ' + formatted + ' (' + lat + ',' + lng + ')');
        return;
      }
      var source = job.source + '；Google回傳：' + formatted +
        '；類型：' + String(first.geometry.location_type || '未知');
      sheet.getRange(index + 2, 12, 1, 4).setValues([[lat, lng, source, '待人工確認']]);
      Logger.log(id + ' 候選座標：' + lat + ', ' + lng + ' | ' + source);
    } catch (e) {
      Logger.log(id + ' 查詢失敗：' + String(e));
    }
    Utilities.sleep(300);
  });
  Logger.log('B4-3 完成；所有新座標仍須人工確認，正式公園資料未修改');
}
