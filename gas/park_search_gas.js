/**
 * PapaKing 雙北公園查詢 MVP (GAS)
 * 資料庫使用現有「公園資料」「公園設施」分頁。
 * 指令碼屬性：PARK_SHEET_ID。只有「可用」且座標有效的公園參與搜尋。
 */
var PARK_RADIUS_KM = 3;
var PARK_TOP_N = 5;
var PARK_INTENT_TTL = 600;

function parkIntentFromText_(text) {
  var s = String(text || '').replace(/\s/g, '');
  if (!/^(附近|周邊|找|查詢|搜尋)/.test(s) || !/公園|遊戲場/.test(s)) return null;
  if (/鞦韆|秋千/.test(s)) return '鞦韆';
  if (/溜滑梯|滑梯/.test(s)) return '溜滑梯';
  if (/共融/.test(s)) return '共融';
  return '全部';
}

function parkIntentKey_(source) {
  source = source || {};
  // Include conversation scope so a user's group search cannot leak into their DM.
  var conversation = source.type === 'group' ? source.groupId : source.type === 'room' ? source.roomId : 'direct';
  var id = source.userId && conversation ? source.type + ':' + conversation + ':' + source.userId : '';
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
function parkSearchCoordinate_(lat,lon) {
  function number(v) {
    return (typeof v==='number' || typeof v==='string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v.trim())) && isFinite(Number(v));
  }
  return number(lat)&&number(lon)&&Number(lat)>=21&&Number(lat)<=26&&Number(lon)>=119&&Number(lon)<=123;
}
function parkDistanceKm_(a,b,c,d) {
  var r=Math.PI/180, x=(c-a)*r, y=(d-b)*r;
  var h=Math.sin(x/2)*Math.sin(x/2)+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)*Math.sin(y/2);
  h=Math.min(1,Math.max(0,h));
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function parkRowsAsObjects_(sheet, required) {
  var rows=sheet.getDataRange().getValues();
  if (!rows.length) return [];
  var headers=rows.shift().map(function(h){return String(h).trim();});
  if (headers.some(function(h,i){return !h||headers.indexOf(h)!==i;})) throw new Error('公園資料欄位空白或重複');
  (required||[]).forEach(function(h){if(headers.indexOf(h)<0) throw new Error('公園分頁缺少欄位：'+h);});
  return rows.map(function(row){var o={};headers.forEach(function(h,i){o[h]=row[i];});return o;});
}
function parkSearch_(lat,lon,intent) {
  if (!parkSearchCoordinate_(lat,lon)) return [];
  lat=Number(lat); lon=Number(lon);
  var sheetId=PropertiesService.getScriptProperties().getProperty('PARK_SHEET_ID');
  if (!sheetId) throw new Error('請先設定 PARK_SHEET_ID 指令碼屬性');
  var ss=SpreadsheetApp.openById(sheetId);
  var ps=ss.getSheetByName('公園資料'),fs=ss.getSheetByName('公園設施');
  if (!ps||!fs) throw new Error('公園資料或公園設施分頁不存在');
  var tags=Object.create(null),types=Object.create(null);
  var parks=parkRowsAsObjects_(ps,['公園ID','公園名稱','縣市','行政區','緯度','經度','資料狀態']), counts=Object.create(null);
  parks.forEach(function(p){var id=String(p['公園ID']||'').trim();counts[id]=(counts[id]||0)+1;});
  parkRowsAsObjects_(fs,['公園ID','可查詢遊具類別（依休憩設施）','遊戲場名稱']).forEach(function(f){
    var id=String(f['公園ID']||'').trim();
    if (!id) return;
    // 僅用「可查詢遊具類別」；禁止用疑似串接的「其他設施」判斷
    var extra=String(f['可查詢遊具類別（依休憩設施）']||'').split(/[、，,；;]/).map(function(v){return v.trim();}).filter(Boolean);
    tags[id]=(tags[id]||[]).concat(extra).filter(function(v,i,a){return a.indexOf(v)===i;});
    var playground=String(f['遊戲場名稱']||'').replace(/\s/g,'');
    types[id]=Boolean(types[id] || /共融/.test(playground) && !/(?:非|無|未設置|不是|不屬於)共融/.test(playground));
  });
  return parks.map(function(p){
    var a=Number(p['緯度']),b=Number(p['經度']);
    if (!parkSearchCoordinate_(p['緯度'],p['經度'])||String(p['資料狀態'])!=='可用') return null;
    var id=String(p['公園ID']||'').trim();
    if (!id || counts[id]!==1) return null;
    if (intent==='共融' && !types[id]) return null;
    if ((intent==='鞦韆'||intent==='溜滑梯') && (tags[id]||[]).indexOf(intent)<0) return null;
    var dist=parkDistanceKm_(lat,lon,a,b);
    // One micrometre tolerance absorbs floating point error at the exact boundary.
    if (dist>PARK_RADIUS_KM+1e-9) return null;
    dist=Math.min(dist,PARK_RADIUS_KM);
    return {name:String(p['公園名稱']||''),city:String(p['縣市']||''),district:String(p['行政區']||''),lat:a,lon:b,km:dist,tags:tags[id]||[],id:id};
  }).filter(Boolean).sort(function(a,b){return a.km-b.km || a.id.localeCompare(b.id);}).slice(0,PARK_TOP_N);
}
function buildParkReply_(lat,lon,intent) {
  if (!parkSearchCoordinate_(lat,lon)) return '位置座標異常，請重新分享台灣的位置。';
  var list=parkSearch_(lat,lon,intent);
  var head='🌳 附近'+(intent==='全部'?'公園':intent==='共融'?'共融遊戲場':'有'+intent+'的公園')+'（'+PARK_RADIUS_KM+' 公里內）';
  if (!list.length) return head+'\n目前沒有符合條件且已定位的資料。尚未完成座標審核的公園不列入搜尋；遊具搜尋僅依官方休憩設施欄位，可能漏列。';
  return head+'\n'+list.map(function(p,i){
    return (i+1)+'. '+p.name+'（'+p.district+'）\n距離約 '+Math.round(p.km*1000)+' 公尺'+(p.tags.filter(Boolean).length?'｜設施：'+p.tags.filter(Boolean).join('、'):'')+'\n地圖：https://www.google.com/maps/search/?api=1&query='+p.lat+','+p.lon;
  }).join('\n\n')+'\n\n※ 直線距離；設施資訊未經現場查核；僅顯示狀態可用且有有效座標的公園。';
}
function testParkSearch_() {
  Logger.log(buildParkReply_(25.136165,121.50155,'全部'));
  Logger.log(buildParkReply_(25.136165,121.50155,'溜滑梯'));
}

function testPapaKingParkConnection() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('PARK_SHEET_ID');
  if (!sheetId) throw new Error('尚未設定 PARK_SHEET_ID');
  var ss = SpreadsheetApp.openById(sheetId);
  var parkSheet = ss.getSheetByName('公園資料');
  var facilitySheet = ss.getSheetByName('公園設施');
  if (!parkSheet || !facilitySheet) throw new Error('找不到公園資料或公園設施分頁');
  Logger.log('資料庫連線成功');
  Logger.log('公園資料筆數：' + (parkSheet.getLastRow() - 1));
  Logger.log('公園設施筆數：' + (facilitySheet.getLastRow() - 1));
  Logger.log('===== 公園搜尋測試 =====');
  Logger.log(buildParkReply_(25.136165, 121.50155, '全部'));
}

function testPapaKingParkMVP() {
  var lat = 25.136165, lon = 121.50155;
  Logger.log('========== PapaKing MVP 測試 ==========');
  var commands = [
    ['附近公園', '全部'],
    ['附近有溜滑梯的公園', '溜滑梯'],
    ['附近有鞦韆的公園', '鞦韆'],
    ['附近共融遊戲場', '共融'],
    ['停車場', null],
    ['id', null]
  ];
  commands.forEach(function(test) {
    var actual = parkIntentFromText_(test[0]);
    var passed = actual === test[1];
    Logger.log((passed ? 'PASS' : 'FAIL') + ' 指令：' + test[0] + '｜結果：' + actual);
    if (!passed) throw new Error('指令辨識失敗：' + test[0]);
  });
  var distance = parkDistanceKm_(lat, lon, lat, lon);
  if (Math.abs(distance) > 0.000001) throw new Error('相同座標的距離應為 0');
  Logger.log('PASS 距離計算');
  ['全部', '溜滑梯', '鞦韆', '共融'].forEach(function(intent) {
    var results = parkSearch_(lat, lon, intent);
    if (!Array.isArray(results)) throw new Error(intent + ' 查詢結果不是陣列');
    if (results.length > PARK_TOP_N) throw new Error(intent + ' 回傳筆數超過上限');
    results.forEach(function(park, index) {
      if (park.km > PARK_RADIUS_KM) throw new Error('公園超出搜尋半徑');
      if (index > 0 && park.km < results[index - 1].km) throw new Error('公園距離排序錯誤');
      if ((intent === '溜滑梯' || intent === '鞦韆') && park.tags.indexOf(intent) < 0) {
        throw new Error('遊具分類不符合條件');
      }
    });
    Logger.log('PASS ' + intent + ' 查詢｜回傳 ' + results.length + ' 筆');
    results.forEach(function(park) {
      Logger.log(park.name + '｜' + Math.round(park.km * 1000) + ' 公尺');
    });
  });
  var reply = buildParkReply_(lat, lon, '全部');
  if (typeof reply !== 'string' || reply.indexOf('附近公園') < 0) throw new Error('公園回覆格式錯誤');
  Logger.log('PASS 公園回覆文字');
  Logger.log('========== 測試完成 ==========');
}

function testPapaKingRouting() {
  var source = { type: 'user', userId: 'TEST_PAPAKING_PARK_USER' };
  takeParkIntent_(source);
  var initial = takeParkIntent_(source);
  if (initial !== null) throw new Error('直接分享位置應走停車查詢');
  Logger.log('PASS 直接分享位置 → 停車查詢');
  var intent = parkIntentFromText_('附近有溜滑梯的公園');
  rememberParkIntent_(source, intent);
  var first = takeParkIntent_(source);
  if (first !== '溜滑梯') throw new Error('公園查詢條件未正確取出');
  Logger.log('PASS 公園指令 → 分享位置');
  var second = takeParkIntent_(source);
  if (second !== null) throw new Error('公園查詢條件未清除');
  Logger.log('PASS 公園查詢完成後恢復停車模式');
  Logger.log('========== 分流測試完成 ==========');
}

/** V0.3.1 公園搜尋 Flex Carousel；既有文字版仍作為備援。 */
function buildParkFlexReply_(lat, lon, intent) {
  if (!parkSearchCoordinate_(lat,lon)) {
    return buildParkReply_(lat, lon, intent);
  }
  var parks = parkSearch_(lat, lon, intent);
  if (!parks.length) return buildParkReply_(lat, lon, intent);
  var cards = parks.map(function(p) {
    var facilities = (p.tags || []).filter(Boolean).join('、');
    var mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.lat + ',' + p.lon);
    return {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: p.name || '未命名公園', weight: 'bold', size: 'lg', wrap: true },
          { type: 'text', text: [p.city, p.district].filter(Boolean).join(' ') || '行政區未提供', size: 'sm', color: '#666666', wrap: true },
          { type: 'text', text: '距離約 ' + Math.round(p.km * 1000) + ' 公尺（直線）', size: 'md', weight: 'bold', color: '#227A4C' },
          { type: 'text', text: facilities ? '設施：' + facilities : '設施資訊待確認', size: 'sm', color: '#555555', wrap: true },
          { type: 'text', text: '設施資訊未經現場查核', size: 'xs', color: '#888888', wrap: true }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'button', style: 'primary', color: '#227A4C',
          action: { type: 'uri', label: '開啟 Google 地圖', uri: mapUrl } }]
      }
    };
  });
  return {
    type: 'flex',
    altText: '附近公園搜尋：找到 ' + cards.length + ' 筆，請滑動查看。',
    contents: { type: 'carousel', contents: cards }
  };
}

function testPapaKingParkFlex_() {
  ['全部', '溜滑梯', '鞦韆', '共融'].forEach(function(intent) {
    var result = buildParkFlexReply_(25.136165, 121.50155, intent);
    if (typeof result === 'string') {
      if (!result) throw new Error('空白文字備援：' + intent);
      Logger.log('PASS 文字備援：' + intent);
      return;
    }
    if (result.type !== 'flex' || result.contents.type !== 'carousel') throw new Error('Flex 結構異常：' + intent);
    if (!result.contents.contents.length || result.contents.contents.length > PARK_TOP_N) throw new Error('卡片數量異常：' + intent);
    result.contents.contents.forEach(function(card) {
      if (card.footer.contents[0].action.uri.indexOf('https://www.google.com/maps/search/') !== 0) throw new Error('地圖連結異常');
    });
    Logger.log('PASS Flex：' + intent + '，卡片 ' + result.contents.contents.length + ' 張');
  });
}
