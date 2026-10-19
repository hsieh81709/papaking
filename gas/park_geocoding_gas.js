/** Read-only coordinate audit. New module: not a reconstruction of the missing geocoder.
 * A = review priority only; no classification grants publication approval.
 * Input objects use canonical Chinese headers. Sheet aliases must be mapped explicitly.
 */
var PARK_AUDIT_CANDIDATE_HEADERS_ = ['公園ID', '候選緯度', '候選經度', 'Google回傳地址', '定位類型', '審核狀態'];
function parkAuditText_(value) { return String(value == null ? '' : value).trim(); }
function parkAuditNumber_(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return NaN;
  if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return NaN;
  return Number(value);
}
function parkAuditCoordinate_(lat, lng) {
  lat = parkAuditNumber_(lat); lng = parkAuditNumber_(lng);
  return isFinite(lat) && isFinite(lng) && lat >= 24.7 && lat <= 25.4 && lng >= 121.2 && lng <= 122.1;
}
function parkAuditIndex_(rows) {
  var index = Object.create(null), missing = [];
  rows.forEach(function(row, i) {
    var id = parkAuditText_(row['公園ID']);
    if (!id) { missing.push(row.__sheetRow || i + 2); return; }
    if (!index[id]) index[id] = [];
    index[id].push(row);
  });
  return { byId: index, missingRows: missing,
    duplicateIds: Object.keys(index).filter(function(id) { return index[id].length > 1; }) };
}
function parkAuditNormalize_(value) { return parkAuditText_(value).replace(/臺/g, '台').replace(/区/g, '區').replace(/\s/g, ''); }
function parkAuditDistance_(a, b, c, d) {
  var r = Math.PI / 180, h = Math.pow(Math.sin((c-a)*r/2),2) + Math.cos(a*r)*Math.cos(c*r)*Math.pow(Math.sin((d-b)*r/2),2);
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
function parkAuditData_(parks, candidates, facilities) {
  var pi = parkAuditIndex_(parks), ci = parkAuditIndex_(candidates), coordinates = Object.create(null);
  candidates.forEach(function(c) {
    if (!parkAuditCoordinate_(c['候選緯度'], c['候選經度'])) return;
    var key = Number(c['候選緯度']).toFixed(6) + ',' + Number(c['候選經度']).toFixed(6);
    if (!coordinates[key]) coordinates[key] = [];
    coordinates[key].push(parkAuditText_(c['公園ID']));
  });
  parks.forEach(function(p) {
    if (!parkAuditCoordinate_(p['緯度'],p['經度'])) return;
    var key=Number(p['緯度']).toFixed(6)+','+Number(p['經度']).toFixed(6);
    if(!coordinates[key]) coordinates[key]=[];
    coordinates[key].push(parkAuditText_(p['公園ID']));
  });
  var types = Object.create(null), statuses = Object.create(null);
  candidates.forEach(function(c) {
    var type = parkAuditText_(c['定位類型']) || '未提供', status = parkAuditText_(c['審核狀態']) || '未提供';
    types[type] = (types[type] || 0) + 1; statuses[status] = (statuses[status] || 0) + 1;
  });
  var records = candidates.map(function(c, index) {
    var id = parkAuditText_(c['公園ID']), p = (pi.byId[id] || [])[0], severe = [], warnings = [];
    if (!id) severe.push('候選公園ID缺漏');
    if ((ci.byId[id] || []).length > 1) severe.push('候選公園ID重複');
    if ((pi.byId[id] || []).length > 1) severe.push('正式公園ID重複');
    if (!p) severe.push('候選找不到正式公園');
    var valid = parkAuditCoordinate_(c['候選緯度'], c['候選經度']);
    if (!valid) severe.push('候選座標格式錯誤或超出新北範圍');
    if (valid) {
      var key = Number(c['候選緯度']).toFixed(6) + ',' + Number(c['候選經度']).toFixed(6);
      if (coordinates[key].some(function(other) { return other !== id; })) severe.push('相同座標對應不同公園');
    }
    var formatted = parkAuditNormalize_(c['Google回傳地址']), address = parkAuditNormalize_(p && p['地址']);
    var district = parkAuditNormalize_(p && p['行政區']);
    if (!district) warnings.push('行政區缺漏');
    if (!address) warnings.push('正式地址缺漏');
    if (!formatted) warnings.push('Google回傳地址缺漏');
    if (p && parkAuditText_(p['縣市']) !== '新北市') severe.push('正式資料縣市不是新北市');
    if (formatted && formatted.indexOf('新北市') < 0) severe.push('Google回傳縣市不符或無法確認');
    if (district && address && address.indexOf(district) < 0) severe.push('正式地址與行政區不符或無法確認');
    if (district && formatted && formatted.indexOf(district) < 0) severe.push('Google回傳地址與行政區不符');
    var road = address.match(/[^市區里鄰\d]+(?:路|街)(?:[一二三四五六七八九十\d]+段)?/);
    if (road && formatted && formatted.indexOf(road[0]) < 0) warnings.push('Google回傳道路與正式地址不一致');
    if (road && district && formatted && address.indexOf(district)>=0 && formatted.indexOf(address.slice(address.indexOf(district)))<0) warnings.push('Google回傳地址與正式門牌、巷弄或路段未完全一致');
    if (/route|intersection|political|administrative_area/.test(parkAuditText_(c['Google地點類型']))) warnings.push('Google地點為道路、路口或行政區，非入口證據');
    if (address && formatted && !road && formatted.indexOf(address.replace(/^.*?新北市/, '')) < 0) warnings.push('地址一致性證據不足');
    if (/地號|地段|小段|交叉|路口|附近|對面|旁|交會/.test(address + ' ' + formatted)) warnings.push('疑似地號、路口或相對位置定位');
    var type = parkAuditText_(c['定位類型']);
    if (type === 'GEOMETRIC_CENTER') warnings.push('幾何中心不等於公園入口');
    else if (type === 'RANGE_INTERPOLATED') warnings.push('道路門牌內插定位');
    else if (type === 'APPROXIMATE') warnings.push('概略定位');
    else if (type !== 'ROOFTOP') warnings.push('定位類型未知');
    var delta = null;
    if (p && parkAuditCoordinate_(p['緯度'], p['經度']) && valid) {
      delta = parkAuditDistance_(Number(p['緯度']), Number(p['經度']), Number(c['候選緯度']), Number(c['候選經度']));
      if (delta > 100) warnings.push('候選與正式座標差距超過100公尺');
    }
    return { id: id, candidateRow: c.__sheetRow || index + 2, name: parkAuditText_(p && p['公園名稱']),
      officialAddress:parkAuditText_(p && p['地址']),officialDistrict:parkAuditText_(p && p['行政區']),googleFormattedAddress:parkAuditText_(c['Google回傳地址']),officialSourceUrl:parkAuditText_(p && p['來源網址']),
      grade: severe.length ? 'C' : warnings.length ? 'B' : 'A', reasons: severe.length || warnings.length ? severe.concat(warnings) : ['格式、ID與地址交叉檢查通過；仍需人工比對公園入口'],
      candidateValid: valid, locationType: type, reviewStatus: parkAuditText_(c['審核狀態']),
      formallyApproved: false, distanceFromOfficialMeters: delta,
      candidateLatitude: c['候選緯度'], candidateLongitude: c['候選經度'],
      officialLatitude: p ? p['緯度'] : null, officialLongitude: p ? p['經度'] : null,
      officialStatus: p ? p['資料狀態'] : null };
  });
  var missingCandidates = Object.keys(pi.byId).filter(function(id) { return !ci.byId[id]; });
  var facilityOrphans = (facilities || []).filter(function(f) { return !pi.byId[parkAuditText_(f['公園ID'])]; });
  return { schemaVersion: 1, scope: '新北市候選座標；矩形範圍僅為初篩，不代表行政界線或入口驗證',
    summary: { formalRows: parks.length, uniqueFormalIds: Object.keys(pi.byId).length,
      validFormalCoordinates: parks.filter(function(p) { return parkAuditCoordinate_(p['緯度'], p['經度']); }).length,
      invalidOrMissingFormalCoordinates: parks.filter(function(p) { return !parkAuditCoordinate_(p['緯度'], p['經度']); }).length,
      candidateRows: candidates.length, uniqueCandidateIds: Object.keys(ci.byId).length,
      validCandidateCoordinates: records.filter(function(r) { return r.candidateValid; }).length,
      grades: { A: records.filter(function(r) { return r.grade === 'A'; }).length,
        B: records.filter(function(r) { return r.grade === 'B'; }).length,
        C: records.filter(function(r) { return r.grade === 'C'; }).length }, locationTypes: types, reviewStatuses: statuses },
    integrity: { formalMissingIdRows: pi.missingRows, candidateMissingIdRows: ci.missingRows,
      duplicateFormalIds: pi.duplicateIds, duplicateCandidateIds: ci.duplicateIds,
      missingCandidateIds: missingCandidates, orphanFacilityRows: facilityOrphans.length },
    records: records, approvalEvaluation: 'not_evaluated', approved: [], // Actual approval is exclusively determined by the separately validated B4-5 plan.
    pendingReview: records.filter(function(r) { return r.candidateValid; }),
    failedLocation: records.filter(function(r) { return !r.candidateValid; }),
    columnTypes: {parks:parkAuditColumnTypes_(parks),candidates:parkAuditColumnTypes_(candidates),facilities:parkAuditColumnTypes_(facilities||[])},
    notice: 'A級僅為優先人工審核；審核狀態不會因品質分級改寫。核准同步清單須以B4-5預覽為準。approved空陣列在not_evaluated時代表尚未取得核准證據，而非已驗證零筆核准。' };
}
/** The shared workbook may contain Taipei parks. Keep unknown/orphan records
 * visible, exclude only known non-NTPC rows, and disclose every exclusion. */
function parkAuditNewTaipeiScope_(parks,candidates,facilities,reviews) {
  var all=parkAuditIndex_(parks).byId, target=Object.create(null);
  parks.forEach(function(p) {
    var keep=parkAuditText_(p['縣市'])==='新北市' || parkAuditText_(p['資料來源ID'])==='NTPC_PARK' || !parkAuditText_(p['縣市']);
    if(keep) target[parkAuditText_(p['公園ID'])]=true;
  });
  // Keep every row sharing a target ID so cross-city duplicates remain visible.
  var selected=parks.filter(function(p) { return Boolean(target[parkAuditText_(p['公園ID'])]); });
  function relevant(row) { var id=parkAuditText_(row['公園ID']);return Boolean(target[id] || !all[id]); }
  return {parks:selected,candidates:candidates.filter(relevant),facilities:facilities.filter(relevant),reviews:reviews?reviews.filter(relevant):null,
    selection:{inputFormalRows:parks.length,excludedKnownNonNtpcFormalIds:parks.filter(function(p){return selected.indexOf(p)<0;}).map(function(p){return parkAuditText_(p['公園ID']);}),
      excludedCandidateRows:candidates.filter(function(c){return !relevant(c);}).length,
      notice:'缺少縣市或找不到正式ID的資料保留檢核，不會靜默排除。'}};
}
function parkAuditColumnTypes_(rows) {
  var counts=Object.create(null);
  rows.forEach(function(row) { Object.keys(row).forEach(function(k) {
    if (!counts[k]) counts[k]=Object.create(null);
    var v=row[k], type=v==='' ? 'blank' : v===null ? 'null' : Object.prototype.toString.call(v)==='[object Date]' ? 'date' : typeof v;
    counts[k][type]=(counts[k][type]||0)+1;
  }); });
  return counts;
}
function parkAuditReviewApprovals_(report, parks, reviews) {
  if (!reviews) return report;
  report.approvalEvaluation='validated_offline_preflight_only';
  report.approvalRejected=[];
  var prodKeys=PAPAKING_B45_PROD_HEADERS_, reviewKeys=PAPAKING_B45_REVIEW_HEADERS_;
  var rows=parks.map(function(p) { return prodKeys.map(function(k) { return p[k]; }); });
  var reviewRows=reviews.map(function(r) { return reviewKeys.map(function(k) { return r[k]; }); });
  var ids=reviews.filter(function(r) { return parkAuditText_(r['修正座標驗收'])==='已確認'; }).map(function(r) { return parkAuditText_(r['公園ID']); });
  ids.filter(function(id,i,a) { return a.indexOf(id)===i; }).forEach(function(id) {
    try {
      if (parks.some(function(p) { return prodKeys.some(function(k) { return !Object.prototype.hasOwnProperty.call(p,k); }); }) || reviews.some(function(r) { return reviewKeys.some(function(k) { return !Object.prototype.hasOwnProperty.call(r,k); }); })) throw new Error('正式或審核匯出缺少完整欄位');
      var plan=papaKingParkB45Plan_(rows,reviewRows,[id]);
      var sourcePark=parks.filter(function(p) { return parkAuditText_(p['公園ID'])===id; })[0];
      if(plan.changes.length && sourcePark.__sheetRow) plan.changes[0].row=sourcePark.__sheetRow;
      report.approved.push({id:id,change:plan.changes[0]||null,alreadySynced:plan.unchanged.length>0});
    } catch(e) { report.approvalRejected.push({id:id,reason:e.message}); }
  });
  report.pendingReview=report.pendingReview.filter(function(r) { return !report.approved.some(function(a) { return a.id===r.id; }); });
  report.notice+=' 核准清單僅通過匯出值預檢，不含線上公式、即時版本與使用者本次寫入授權。';
  return report;
}
function parkAuditSheetObjects_(sheet, required, mapping) {
  if (!sheet) throw new Error('缺少必要分頁');
  var values = sheet.getDataRange().getValues(), headers = values.shift().map(parkAuditText_);
  if (headers.some(function(h, i) { return !h || headers.indexOf(h) !== i; })) throw new Error(sheet.getName() + ' 欄名空白或重複');
  mapping = mapping || {};
  required.forEach(function(key) { if (headers.indexOf(mapping[key] || key) < 0) throw new Error(sheet.getName() + ' 缺少欄位 ' + key + '，請明確提供欄位對照'); });
  return values.map(function(row,index) {
    if (!row.some(function(v) { return v !== ''; })) return null;
    var obj = {};
    Object.defineProperty(obj,'__sheetRow',{value:index+2,enumerable:false});
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    Object.keys(mapping).forEach(function(k) { obj[k] = obj[mapping[k]]; });
    return obj;
  }).filter(Boolean);
}
/** Read-only; does not create sheets, modify candidates, or invoke geocoding services. */
function runPapaKingParkQualityAudit(candidateColumnMapping) {
  var id = PropertiesService.getScriptProperties().getProperty('PARK_SHEET_ID');
  if (!id) throw new Error('PARK_SHEET_ID 未設定');
  var ss = SpreadsheetApp.openById(id);
  var parks = parkAuditSheetObjects_(ss.getSheetByName('公園資料'), ['公園ID','縣市','行政區','公園名稱','地址','緯度','經度','資料狀態']);
  var candidates = parkAuditSheetObjects_(ss.getSheetByName('公園座標候選'), PARK_AUDIT_CANDIDATE_HEADERS_, candidateColumnMapping);
  var facilities = parkAuditSheetObjects_(ss.getSheetByName('公園設施'), ['公園ID','可查詢遊具類別（依休憩設施）','遊戲場名稱']);
  var reviewSheet=ss.getSheetByName('公園座標品質檢核');
  var reviews=reviewSheet?parkAuditSheetObjects_(reviewSheet,PAPAKING_B45_REVIEW_HEADERS_):null;
  var scope=parkAuditNewTaipeiScope_(parks,candidates,facilities,reviews);
  var report = parkAuditData_(scope.parks, scope.candidates, scope.facilities);
  report.scopeSelection=scope.selection;
  parkAuditReviewApprovals_(report,scope.parks,scope.reviews);
  Logger.log(JSON.stringify({summary: report.summary, integrity: report.integrity, approvalEvaluation:report.approvalEvaluation, approved:report.approved}));
  return report;
}
/** Schema discovery before choosing aliases. Read-only; no assumed candidate schema. */
function runPapaKingParkInventory() {
  var id=PropertiesService.getScriptProperties().getProperty('PARK_SHEET_ID');
  if (!id) throw new Error('PARK_SHEET_ID 未設定');
  var ss=SpreadsheetApp.openById(id);
  return ['公園資料','公園設施','公園座標候選','公園座標品質檢核'].map(function(name) {
    var sheet=ss.getSheetByName(name);
    if (!sheet) return {sheet:name,exists:false};
    var values=sheet.getDataRange().getValues(),headers=values.shift().map(parkAuditText_);
    var rows=values.filter(function(r) { return r.some(function(v) { return v!==''; }); });
    var idColumn=headers.indexOf('公園ID'),idRows=values.map(function(r,i) { return {'公園ID':idColumn<0?'':r[idColumn],__sheetRow:i+2,__nonempty:r.some(function(v){return v!=='';})}; }).filter(function(r){return r.__nonempty;});
    var index=parkAuditIndex_(idRows);
    return {sheet:name,exists:true,rows:rows.length,headers:headers,
      duplicateHeaders:headers.filter(function(h,i) { return headers.indexOf(h)!==i; }),
      blankHeaderColumns:headers.map(function(h,i) { return h?null:i+1; }).filter(function(i) { return i!==null; }),
      uniqueIds:Object.keys(index.byId).length,duplicateIds:index.duplicateIds,missingIdRows:index.missingRows};
  });
}
