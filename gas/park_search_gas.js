/**
 * PapaKing 雙北公園查詢 MVP (GAS)
 * 資料庫使用現有「公園資料」「公園設施」分頁。
 * 指令碼屬性：PARK_SHEET_ID = 17nfC94YMVlHyC8dvWF67nwfd6a_uFr46gHY-F_PbjvY
 * 目前新北公園無座標，暫不參與距離搜尋。
 */
var PARK_RADIUS_KM = 3;
var PARK_TOP_N = 5;
var PARK_INTENT_TTL = 600;

function parkIntentFromText_(text) {
  var s = String(text || '').replace(/\\s/g, '');
  if (!/^(附近|周邊|找|查詢|搜尋)/.test(s) || !/公園|遊戲場/.test(s)) return null;
  if (/鞦韆|秋千/.test(s)) return '鞦韆';
  if (/溜滑梯|滑梯/.test(s)) return '溜滑梯';
  if (/共融/.test(s)) return '共融';
  return '全部';
}

function parkIntentKey_(source) {
  var id = source.userId || (source.type === 'group' ? source.groupId : '') || (source.type === 'room' ? source.roomId : '');
  if (!id) return null;
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id, Utilities.Charset.UTF_8);
  return 'park_intent_' + bytes.map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('').slice(0,32);
}

function rememberParkIntent_(source, intent) {
  var key = parkIntentKey_(source);
  if (!key) return false;
  CacheService.getScriptCache().put(key, intent, PARK_INTENT_TTL);
  return true;
}
function takeParkIntent_(source) {
  var key = parkIntentKey_(source);
  if (!key) return null;
  var cache = CacheService.getScriptCache();
  var intent = cache.get(key);
  if (intent) cache.remove(key);
  return intent;
}
function parkDistanceKm_(a,b,c,d) {
  var r=Math.PI/180, x=(c-a)*r, y=(d-b)*r;
  var h=Math.sin(x/2)*Math.sin(x/2)+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)*Math.sin(y/2);
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function parkRowsAsObjects_(sheet) {
  var rows=sheet.getDataRange().getValues();
  if (!rows.length) return [];
  var headers=rows.shift().map(String);
  return rows.map(function(row){var o={};headers.forEach(function(h,i){o[h]=row[i];});return o;});
}
function parkSearch_(lat,lon,intent) {
  var sheetId=PropertiesService.getScriptProperties().getProperty('PARK_SHEET_ID');
  if (!sheetId) throw new Error('請先設定 PARK_SHEET_ID 指令碼屬性');
  var ss=SpreadsheetApp.openById(sheetId);
  var ps=ss.getSheetByName('公園資料'),fs=ss.getSheetByName('公園設施');
  if (!ps||!fs) throw new Error('公園資料或公園設施分頁不存在');
  var tags={},types={};
  parkRowsAsObjects_(fs).forEach(function(f){
    var id=String(f['公園ID']||'');
    if (!id) return;
    // 僅用「可查詢遊具類別」；禁止用疑似串接的「其他設施」判斷
    tags[id]=String(f['可查詢遊具類別（依休憩設施）']||'').split('、');
    types[id]=String(f['遊戲場名稱']||'');
  });
  return parkRowsAsObjects_(ps).map(function(p){
    var a=Number(p['緯度']),b=Number(p['經度']);
    if (!a||!b||a<21||a>26||b<119||b>123||String(p['資料狀態'])!=='可用') return null;
    var id=String(p['公園ID']||'');
    if (intent==='共融' && (types[id]||'').indexOf('共融')<0) return null;
    if ((intent==='鞦韆'||intent==='溜滑梯') && (tags[id]||[]).indexOf(intent)<0) return null;
    var dist=parkDistanceKm_(lat,lon,a,b);
    if (dist>PARK_RADIUS_KM) return null;
    return {name:String(p['公園名稱']||''),city:String(p['縣市']||''),district:String(p['行政區']||''),lat:a,lon:b,km:dist,tags:tags[id]||[],id:id};
  }).filter(Boolean).sort(function(a,b){return a.km-b.km;}).slice(0,PARK_TOP_N);
}
function buildParkReply_(lat,lon,intent) {
  if (!isFinite(lat)||!isFinite(lon)||lat<21||lat>26||lon<119||lon>123) return '位置座標異常，請重新分享台灣的位置。';
  var list=parkSearch_(lat,lon,intent);
  var head='🌳 附近'+(intent==='全部'?'公園':intent==='共融'?'共融遊戲場':'有'+intent+'的公園')+'（'+PARK_RADIUS_KM+' 公里內）';
  if (!list.length) return head+'\\n目前沒有符合條件且已定位的資料。新北市公園仍待補座標；遊具搜尋僅依官方休憩設施欄位，可能漏列。';
  return head+'\\n'+list.map(function(p,i){
    return (i+1)+'. '+p.name+'（'+p.district+'）\\n距離約 '+Math.round(p.km*1000)+' 公尺'+(p.tags.filter(Boolean).length?'｜設施：'+p.tags.filter(Boolean).join('、'):'')+'\\n地圖：https://www.google.com/maps/search/?api=1&query='+p.lat+','+p.lon;
  }).join('\\n\\n')+'\\n\\n※ 直線距離；設施資訊未經現場查核，新北市尚未納入定位搜尋。';
}
function testParkSearch_() {
  Logger.log(buildParkReply_(25.136165,121.50155,'全部'));
  Logger.log(buildParkReply_(25.136165,121.50155,'溜滑梯'));
}
