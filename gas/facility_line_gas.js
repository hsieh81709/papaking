/** P0-9 LINE category state and toilet rendering. No Sheets writes or geocoding.
 * Durable bounded state contains hashed conversation keys, never raw location.
 */
var FACILITY_INTENT_TTL_ = 600;

function facilityIntentKey_(source) {
  source = source || {};
  if (['user','group','room'].indexOf(source.type) < 0 ||
      typeof source.userId !== 'string' || !source.userId.trim()) return null;
  var conversation = source.type === 'group' ? source.groupId : source.type === 'room' ? source.roomId : 'direct';
  if (typeof conversation !== 'string' || !conversation.trim()) return null;
  if (typeof parkIntentKey_ === 'function') return parkIntentKey_(source);
  var text = source.type + ':' + conversation + ':' + source.userId;
  return 'park_intent_' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function(b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('').slice(0,32);
}

function rememberFacilityIntent_(source, kind, intent, selectedAt) {
  var key = facilityIntentKey_(source);
  if (!key) return false;
  if (['parking','park','toilet','unknown'].indexOf(kind) < 0) throw new Error('Unknown category');
  selectedAt = selectedAt === undefined ? Date.now() : selectedAt;
  return papaKingState_(function(s) {
    if(s.intents[key] && s.intents[key].selectedAt > selectedAt) throw new Error('Stale selection');
    s.intents[key] = {v:2,kind:kind,intent:kind === 'park' ? intent || '全部' : null,
      selectedAt:selectedAt,expiresAt:Math.min(Date.now(),selectedAt) + FACILITY_INTENT_TTL_*1000,requestId:Utilities.getUuid()};
    return true;
  });
}
function papaKingIntentValue_(value) {
  if (!value) return {kind:'unset'};
  if (value.v !== 2 || ['parking','park','toilet','unknown','consumed'].indexOf(value.kind) < 0 ||
      typeof value.expiresAt !== 'number' || !isFinite(value.expiresAt) || typeof value.requestId !== 'string' ||
      value.kind === 'park' && ['全部','溜滑梯','鞦韆','共融'].indexOf(value.intent) < 0) throw new Error('Invalid intent');
  if (value.kind === 'consumed') return {kind:'unset'};
  if (value.expiresAt <= Date.now()) return {kind:'expired'};
  var copy=Object.assign({},value);copy.snapshot=JSON.stringify(value);return copy;
}
function peekFacilityIntent_(source) {
  var key=facilityIntentKey_(source);
  if (!key) return {kind:'identity'};
  return papaKingState_(function(s){return papaKingIntentValue_(s.intents[key]);});
}
function clearFacilityIntent_(source, expected, selectedAt) {
  var key=facilityIntentKey_(source);
  if (!key) return false;
  return papaKingState_(function(s){
    if(expected !== undefined && JSON.stringify(s.intents[key]) !== expected) return false;
    selectedAt = selectedAt === undefined ? Date.now() : selectedAt;
    if(s.intents[key] && s.intents[key].selectedAt > selectedAt) throw new Error('Stale cancellation');
    s.intents[key]={v:2,kind:'consumed',intent:null,selectedAt:selectedAt,expiresAt:Math.min(Date.now(),selectedAt)+FACILITY_INTENT_TTL_*1000,requestId:Utilities.getUuid()};
    return true;
  });
}
function takeFacilityIntent_(source, expected) {
  var key=facilityIntentKey_(source);
  if (!key) return {kind:'identity'};
  return papaKingState_(function(s){
    var result=papaKingIntentValue_(s.intents[key]);
    if(expected !== undefined && result.snapshot !== expected) return {kind:'unset'};
    if(result.snapshot) s.intents[key]=Object.assign({},s.intents[key],{kind:'consumed'});
    return result;
  });
}
function restoreFacilityIntent_(source, state) {
  var key=facilityIntentKey_(source);
  if (!key || !state.snapshot || state.expiresAt <= Date.now()) return;
  papaKingState_(function(s){var current=s.intents[key];if(current && current.kind === 'consumed' && current.requestId === state.requestId) s.intents[key]=JSON.parse(state.snapshot);});
}

function facilityCommand_(text) {
  var s = String(text || '').replace(/\s/g, '');
  if (/^(停車|停車查詢|查詢停車|附近停車|停車場|路邊停車)$/i.test(s)) return {kind:'parking'};
  if (/^(公廁|附近公廁|周邊公廁|附近廁所|公廁查詢|查詢公廁)$/.test(s)) return {kind:'toilet'};
  if (s === '公園') return {kind:'park',intent:'全部'};
  // Preserve existing text compatibility; no new equipment filters or menu items.
  var intent = typeof parkIntentFromText_ === 'function' ? parkIntentFromText_(s) : null;
  if (intent && !/公廁|廁所|停車/.test(s)) return {kind:'park',intent:intent};
  return {kind:'unknown'};
}

function facilityLineCoordinate_(lat, lon) {
  if (typeof parkSearchCoordinate_ === 'function') return parkSearchCoordinate_(lat, lon);
  return validParkingPosition(lat, lon) && lat >= 21 && lat <= 26 && lon >= 119 && lon <= 123;
}

function facilityUserError_(kind, error) {
  var name = kind === 'park' ? '公園' : kind === 'toilet' ? '公廁' : kind === 'parking' ? '停車' : '';
  if (error && error.facilityDataError) return name + '資料表格式或讀取失敗，請稍後再試或聯絡管理者。';
  return '系統暫時無法查詢' + name + '，請稍後再試或重新選擇分類。';
}

/** Query errors are handled before a reply attempt. Uncertain delivery never
 * starts a new reply; replyLine owns the single bounded HTTP400 text fallback.
 */
function handlePapaKingMessage_(event) {
  var source = event.source || {}, state, kind, message, fallback = {};
  if (event.message.type === 'text') {
    try {
      var text = String(event.message.text || '').trim();
      if (/^(選單|功能選單|公園選單|主選單|menu)$/i.test(text)) {
        clearFacilityIntent_(source,undefined,event.timestamp);
        message = buildPapaKingQuickMenu_();
      } else {
        var command = facilityCommand_(text);
        if (!rememberFacilityIntent_(source, command.kind, command.intent, event.timestamp)) {
          message = '請在一對一聊天室選擇分類，才能安全保存本次查詢。';
        } else if (command.kind === 'unknown') {
          message = '目前僅支援停車、公園、公廁，請重新選擇查詢分類。';
        } else {
          message = buildPapaKingLocationPrompt_(command.kind);
        }
      }
    } catch (error) { message = facilityUserError_(null, error); }
    replyLine(event.replyToken, message);
    return;
  }
  if (event.message.type !== 'location') return;
  try { state = peekFacilityIntent_(source); }
  catch (error) { replyLine(event.replyToken, facilityUserError_(null, error)); return; }
  if (state.kind === 'identity') { replyLine(event.replyToken, '請在一對一聊天室選擇分類並分享位置。'); return; }
  if (!facilityLineCoordinate_(event.message.latitude, event.message.longitude)) {
    replyLine(event.replyToken, '位置座標異常，請重新分享台灣的位置；若已選擇分類，該分類不會因此清除。');
    return;
  }
  // Normalize the validated coordinate grammar without changing the event input.
  event = Object.assign({}, event, {message:Object.assign({}, event.message, {
    latitude:Number(event.message.latitude),longitude:Number(event.message.longitude)})});
  if (state.kind === 'expired') { replyLine(event.replyToken, '本次查詢分類已逾時，請重新選擇分類後分享位置。'); return; }
  if (state.kind === 'unset' || state.kind === 'unknown') {
    replyLine(event.replyToken, '請先選擇查詢分類：停車、公園或公廁，再分享位置。');
    return;
  }
  if (event.timestamp < state.selectedAt) { replyLine(event.replyToken,'這是較早的位置事件，請重新分享位置。'); return; }
  try {
    state = takeFacilityIntent_(source, state.snapshot);
    if (!state.snapshot) { replyLine(event.replyToken, '分類已變更或正在查詢，請重新選擇分類後分享位置。'); return; }
  } catch (error) { replyLine(event.replyToken, facilityUserError_(null,error)); return; }
  kind = state.kind;
  if (kind === 'parking') {
    try {
      handleLocation(event); // Original quota, TDX, driving rank and rendering stay intact.
    } catch (error) {
      if (error.papaKingReplyAttempted) throw error;
      replyLine(event.replyToken, facilityUserError_(kind, error));
    }
    return;
  }
  try {
    if (kind === 'park') message = buildParkFlexReply_(event.message.latitude, event.message.longitude, state.intent || '全部', fallback);
    else if (kind === 'toilet') message = buildToiletFlexReply_(event.message.latitude, event.message.longitude, fallback);
    else throw new Error('Unknown category');
  } catch (error) {
    // Only fresh location events may retry. Never erase a newer selection.
    try { restoreFacilityIntent_(source,state); } catch (restoreError) { /* fail closed */ }
    // Preserve original expiry, never silently switch services.
    replyLine(event.replyToken, facilityUserError_(kind, error));
    return;
  }
  replyLine(event.replyToken, message, fallback.text);
}

function facilityDisplayValue_(value) {
  var text = String(value == null ? '' : value).trim();
  return !text || /^(UNKNOWN|未知|未確認|未提供|不明)$/i.test(text) ? '未確認' : text.slice(0,120);
}

function toiletResultLines_(result) {
  return ['開放時間：' + facilityDisplayValue_(result.openingHours),
    '無障礙設施：' + facilityDisplayValue_(result.accessibility),
    '尿布臺：' + facilityDisplayValue_(result.changingTable),
    '進入限制：' + facilityDisplayValue_(result.accessRestrictions)];
}

function toiletNavigation_(result) {
  var url = facilityNavigationUrl_(result);
  if (!url || result.kind !== 'toilet' || typeof result.km !== 'number' ||
      !isFinite(result.km) || result.km < 0 || result.km > PARK_RADIUS_KM) throw new Error('Invalid toilet search result');
  return url;
}

function toiletPositionLabel_(result) {
  return result.publicationSource === 'source-unverified' ?
    '位置未經人工驗證，導航點可能不是入口' : '位置已人工確認；入口、樓層與開放狀況依現場標示。';
}

function formatToiletReply_(results) {
  return '🚻 附近公廁（3 公里內）\n' + results.map(function(p, i) {
    var url = toiletNavigation_(p);
    return (i+1) + '. ' + String(p.name).slice(0,60) + '（' + String(p.district || p.address).slice(0,160) + '）\n' +
      '距離約 ' + Math.round(p.km * 1000) + ' 公尺（直線）\n' + toiletResultLines_(p).join('\n') + '\n' + toiletPositionLabel_(p) + '\n導航至公廁位置：' + url;
  }).join('\n\n') + '\n※ 導航至資料記載的座標；入口、樓層與實際開放狀況請依現場標示。';
}

function buildToiletFlexReply_(lat, lon, fallback) {
  if (!parkSearchCoordinate_(lat, lon)) return '位置座標異常，請重新分享台灣的位置。';
  var details = {}, results = toiletSearch_(lat, lon, details);
  if (!Array.isArray(results) || results.length > PARK_TOP_N) throw new Error('Invalid toilet result list');
  if (!results.length) {
    var empty = facilityEmptyMessage_('toilet', lat, lon, details);
    if (fallback) fallback.text = empty;
    return empty;
  }
  var text = formatToiletReply_(results);
  if (fallback) fallback.text = text;
  var theme = papaKingFlexTheme_('公廁');
  var cards = results.map(function(p) {
    var url = toiletNavigation_(p);
    return {type:'bubble',body:{type:'box',layout:'vertical',spacing:'md',contents:[
      {type:'text',text:String(p.name).slice(0,60),weight:'bold',size:'lg',wrap:true},
      {type:'text',text:([p.district,p.address].filter(Boolean).join(' ') || '位置說明未確認').slice(0,160),size:'sm',wrap:true},
      {type:'text',text:'距離約 ' + Math.round(p.km*1000) + ' 公尺（直線）',weight:'bold',color:theme.color,wrap:true}
    ].concat(toiletResultLines_(p).map(function(line) { return {type:'text',text:line,size:'sm',wrap:true}; }))
      .concat([{type:'text',text:toiletPositionLabel_(p),size:'xs',color:'#666666',wrap:true}])},
      footer:{type:'box',layout:'vertical',contents:[{type:'button',style:'primary',color:theme.color,
        action:{type:'uri',label:'Google Maps 導航',uri:url}}]}};
  });
  return {type:'flex',altText:'附近公廁：找到 ' + cards.length + ' 筆，請滑動查看。',contents:{type:'carousel',contents:cards}};
}

/** Declared broad service envelope, padded by search radius for border queries.
 * This is NOT reverse geocoding or an administrative-boundary determination.
 * Evaluate only after a successful read/search, never hide a database error.
 */
function facilityEmptyMessage_(kind, lat, lon, details) {
  var name = kind === 'toilet' ? '公廁' : '公園';
  var scope = kind === 'toilet' ? '符合發布條件資料（含位置未經人工驗證資料）' : '已核准發布資料';
  var padLat = PARK_RADIUS_KM / 111, padLon = PARK_RADIUS_KM / (111 * Math.cos(25 * Math.PI / 180));
  if (Number(lat) < 24.7-padLat || Number(lat) > 25.4+padLat || Number(lon) < 121.2-padLon || Number(lon) > 122.1+padLon) {
    return '該地區的' + name + '資料尚未開放；目前提供雙北（臺北／新北）' + scope + '。';
  }
  if (kind === 'toilet' && details.publishedCount === 0) return '目前尚無符合發布條件的公廁資料，暫不提供導航；待確認或資料不足不代表附近沒有設施。';
  if (details.publishedCount === 0) return '目前尚無已核准發布的' + name + '資料，暫不提供導航；待驗收不代表附近沒有設施。';
  return '附近沒有符合條件的' + name + '資料（3 公里內）；僅搜尋' + scope + '。';
}
