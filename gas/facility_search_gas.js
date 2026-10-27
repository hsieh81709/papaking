/**
 * P0-1: read-only park/toilet search primitives. No geocoding, writes or LINE calls.
 * Requires park_search_gas.js (validation, distance and header reader).
 * 設施發布核准 is an operator-maintained approval ledger, NOT inferred from grades.
 * No ledger is shipped, created or populated here. Parks require approval;
 * eligible pending toilets may use the explicit source-unverified lane.
 */
var FACILITY_TOILET_HEADERS_ = ['公廁ID','縣市','行政區','公廁名稱','地址','緯度','經度','公廁類型','無障礙設施','尿布臺','兒童座椅','開放時間','管理單位','資料來源ID','原始資料ID','來源網址','資料更新日期','同步時間','資料狀態','備註','設施紀錄數','整併狀態','進入限制','關聯設施ID'];
var FACILITY_PARK_HEADERS_ = ['公園ID','縣市','行政區','公園名稱','地址','緯度','經度','管理單位','資料來源ID','原始資料ID','來源網址','資料更新日期','同步時間','資料狀態','備註'];
var FACILITY_RELEASE_HEADERS_ = ['設施類別','設施ID','來源資料指紋','緯度','經度','資料驗收','發布決定','核准人','核准日期','證據URL','座標代表類型'];

function facilityDataError_(message) {
  var error = new Error(message);
  error.facilityDataError = true;
  return error;
}

function facilityOpenWorkbook_() {
  var id = PropertiesService.getScriptProperties().getProperty('PARK_SHEET_ID');
  if (!id) throw facilityDataError_('請先設定 PARK_SHEET_ID 指令碼屬性');
  try { return SpreadsheetApp.openById(id); }
  catch (error) { throw facilityDataError_('試算表讀取失敗'); }
}

function facilitySheet_(workbook, name, optional) {
  var sheet;
  try { sheet = workbook.getSheetByName(name); }
  catch (error) { throw facilityDataError_(name + '分頁讀取失敗'); }
  if (!sheet && !optional) throw facilityDataError_(name + '分頁不存在');
  return sheet;
}

function facilityRequiredText_(value) {
  return typeof value === 'string' && value.trim() !== '' && !/[\r\n\x00]/.test(value);
}

function facilityText_(value) {
  return String(value == null ? '' : value).trim();
}

/** Version 1 canonicalization. All source fields are bound, not just ID/name. */
function facilitySourceFingerprint_(kind, row) {
  if (kind !== 'park' && kind !== 'toilet') throw new Error('不支援的設施類別');
  var keys = kind === 'park' ? FACILITY_PARK_HEADERS_ : FACILITY_TOILET_HEADERS_;
  var value = JSON.stringify([kind, keys.map(function(key) {
    var v = row[key];
    if (key === '緯度' || key === '經度') v = Number(v);
    else if (Object.prototype.toString.call(v) === '[object Date]') v = v.toISOString();
    else v = facilityText_(v);
    return [key, v];
  })]);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(function(b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

/** Coarse Taipei/New Taipei envelope, not an administrative or entrance check. */
function facilityTwinCityPosition_(lat, lon) {
  return parkSearchCoordinate_(lat, lon) && Number(lat) >= 24.7 && Number(lat) <= 25.4 &&
    Number(lon) >= 121.2 && Number(lon) <= 122.1;
}

// Keep the existing park/release/navigation contract and its exact bounds.
function facilityNtpcPosition_(lat, lon) {
  return facilityTwinCityPosition_(lat, lon);
}

/** Taipei adapter is backed by the supplied ODS TP_TOILET source contract.
 * Normalize only the projected city; fingerprint the untouched source row.
 * Existing NTPC source eligibility stays compatible.
 */
function facilityToiletCity_(row) {
  var city = facilityText_(row['縣市']).replace(/臺/g, '台');
  if (city === '新北市') return '新北市';
  if (city === '台北市' && facilityText_(row['資料來源ID']) === 'TP_TOILET') return '臺北市';
  return null;
}

function facilityReleaseDate_(value) {
  var text = facilityText_(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  var date = new Date(text + 'T00:00:00.000Z');
  return isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text && date.getTime() <= Date.now();
}

function facilityEvidenceUrl_(value) {
  // HTTPS host, no credentials, whitespace or arbitrary URI schemes. Not a claim
  // that the cited page is official or that the human's evidence is sufficient.
  return /^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:\/[^\s]*)?$/i.test(facilityText_(value));
}

function facilityReleaseIndex_(workbook) {
  var sheet = facilitySheet_(workbook, '設施發布核准', true);
  var index = Object.create(null), counts = Object.create(null);
  if (!sheet) return index;
  var rows = parkRowsAsObjects_(sheet, FACILITY_RELEASE_HEADERS_);
  rows.forEach(function(row) {
    var key = facilityText_(row['設施類別']) + ':' + facilityText_(row['設施ID']);
    counts[key] = (counts[key] || 0) + 1;
    index[key] = row;
  });
  // A second revoked/pending row also invalidates an earlier approval.
  Object.keys(index).forEach(function(key) { if (counts[key] !== 1) delete index[key]; });
  return index;
}

function facilityReleaseFor_(kind, row, index) {
  var id = facilityText_(row[kind === 'park' ? '公園ID' : '公廁ID']);
  var record = index[(kind === 'park' ? '公園' : '公廁') + ':' + id];
  if (!record || !id || !facilityNtpcPosition_(row['緯度'], row['經度'])) return null;
  var type = facilityText_(record['座標代表類型']);
  var types = kind === 'park' ? ['園區代表點','入口','未知'] : ['設施代表點','入口','未知'];
  if (record['資料驗收'] !== '已確認' || record['發布決定'] !== '核准發布' ||
      !facilityRequiredText_(record['核准人']) || !facilityReleaseDate_(record['核准日期']) ||
      !facilityEvidenceUrl_(record['證據URL']) || types.indexOf(type) < 0 ||
      !facilityNtpcPosition_(record['緯度'], record['經度'])) return null;
  if (Number(record['緯度']) !== Number(row['緯度']) || Number(record['經度']) !== Number(row['經度'])) return null;
  var hash = facilitySourceFingerprint_(kind, row);
  if (record['來源資料指紋'] !== hash) return null;
  return { kind: kind, id: id, lat: Number(row['緯度']), lon: Number(row['經度']),
    sourceFingerprint: hash, positionType: type };
}

/** Existing Taipei baseline stays compatible; NTPC requires a value-bound ledger. */
function facilityParkPublication_(row, index) {
  var city = facilityText_(row['縣市']).replace(/臺/g, '台');
  if (row['資料狀態'] !== '可用' || !facilityText_(row['公園ID']) ||
      !parkSearchCoordinate_(row['緯度'], row['經度'])) return null;
  if (city === '台北市') return {kind: 'park', id: facilityText_(row['公園ID']),
    lat: Number(row['緯度']), lon: Number(row['經度']),
    sourceFingerprint: facilitySourceFingerprint_('park', row), positionType: '未知',
    baseline: 'taipei-formal'};
  return city === '新北市' ? facilityReleaseFor_('park', row, index) : null;
}

/** Shared 3km / 5-result kernel. Creates new results, never mutates source rows. */
function facilityRankNearby_(lat, lon, records) {
  if (!parkSearchCoordinate_(lat, lon)) return [];
  lat = Number(lat); lon = Number(lon);
  return records.map(function(record) {
    if (!parkSearchCoordinate_(record.lat, record.lon)) return null;
    var km = parkDistanceKm_(lat, lon, Number(record.lat), Number(record.lon));
    if (km > PARK_RADIUS_KM + 1e-9) return null;
    return Object.assign({}, record, {km: Math.min(km, PARK_RADIUS_KM)});
  }).filter(Boolean).sort(function(a, b) {
    return a.km - b.km || a.id.localeCompare(b.id);
  }).slice(0, PARK_TOP_N);
}

/** Toilet-only index retains a blocking key for every existing review record.
 * Duplicate, revoked, stale or incomplete reviews never fall back to source release.
 * Park index and approval semantics are unchanged.
 */
function facilityToiletReleaseIndex_(workbook) {
  var sheet = facilitySheet_(workbook, '設施發布核准', true), index = Object.create(null);
  if (!sheet) return index;
  parkRowsAsObjects_(sheet, FACILITY_RELEASE_HEADERS_).forEach(function(row) {
    var key = facilityText_(row['設施類別']) + ':' + facilityText_(row['設施ID']);
    index[key] = Object.prototype.hasOwnProperty.call(index, key) ? null : row;
  });
  return index;
}

function facilityToiletSourceValid_(row) {
  return facilityRequiredText_(row['公廁ID']) && facilityToiletCity_(row) &&
    facilityRequiredText_(row['公廁名稱']) &&
    (row['行政區'] === '' || facilityRequiredText_(row['行政區'])) &&
    facilityRequiredText_(row['地址']) && facilityRequiredText_(row['資料來源ID']) &&
    row['資料狀態'] === '待驗收' && ['保留獨立','自動整併'].indexOf(row['整併狀態']) >= 0 &&
    facilityTwinCityPosition_(row['緯度'], row['經度']);
}

/** Read-only source lane, explicitly separate from human approval metadata. */
function facilityToiletSource_(row, releases) {
  var key = '公廁:' + facilityText_(row['公廁ID']);
  if (Object.prototype.hasOwnProperty.call(releases, key) || !facilityToiletSourceValid_(row)) return null;
  var source = {};
  FACILITY_TOILET_HEADERS_.forEach(function(k) { source[k] = row[k]; });
  return {mode:'source-unverified', source:source, sourceFingerprint:facilitySourceFingerprint_('toilet',row)};
}

/** Toilet adapter: no detail join, no candidate coordinates, no status promotion. */
function getFacilityData_(kind, details) {
  if (kind !== 'toilet') throw new Error('此資料適配器僅支援公廁類別');
  var workbook = facilityOpenWorkbook_(), sheet = facilitySheet_(workbook, '公廁資料');
  var rows = parkRowsAsObjects_(sheet, FACILITY_TOILET_HEADERS_);
  var releases = facilityToiletReleaseIndex_(workbook), counts = Object.create(null);
  rows.forEach(function(row) {
    var key = facilityText_(row['公廁ID']);
    counts[key] = (counts[key] || 0) + 1;
  });
  var results = rows.map(function(row) {
    var key = facilityText_(row['公廁ID']), city = facilityToiletCity_(row);
    if (!facilityRequiredText_(row['公廁ID']) || counts[key] !== 1 || !city ||
        ['可用','待驗收'].indexOf(row['資料狀態']) < 0 ||
        ['保留獨立','自動整併'].indexOf(row['整併狀態']) < 0 ||
        !facilityRequiredText_(row['公廁名稱']) ||
        !facilityRequiredText_(row['地址']) || !facilityRequiredText_(row['資料來源ID']) ||
        !facilityTwinCityPosition_(row['緯度'], row['經度'])) return null;
    // Preserve the old human-review adapter contract; source-only rows may lack a district.
    var publication = facilityRequiredText_(row['行政區']) ? facilityReleaseFor_('toilet', row, releases) : null;
    var sourceRelease = publication ? null : facilityToiletSource_(row, releases);
    if (!publication && !sourceRelease) return null;
    return {kind: 'toilet', id: key, name: facilityText_(row['公廁名稱']), city: city,
      district: facilityText_(row['行政區']), address: facilityText_(row['地址']),
      lat: Number(row['緯度']), lon: Number(row['經度']), sourceStatus: row['資料狀態'],
      sourceFingerprint: publication ? publication.sourceFingerprint : sourceRelease.sourceFingerprint,
      positionType: publication ? publication.positionType : '未知',
      publicationSource: publication ? 'human-verified' : 'source-unverified', sourceRelease:sourceRelease,
      openingHours: facilityText_(row['開放時間']) || 'UNKNOWN',
      accessRestrictions: facilityText_(row['進入限制']) || 'UNKNOWN',
      accessibility: facilityText_(row['無障礙設施']) || 'UNKNOWN',
      changingTable: facilityText_(row['尿布臺']) || 'UNKNOWN', publication: publication};
  }).filter(Boolean);
  if (details) details.publishedCount = results.length;
  return results;
}

function searchNearbyFacilities_(kind, lat, lon, details) {
  if (kind !== 'park' && kind !== 'toilet') throw new Error('不支援的設施類別');
  if (!parkSearchCoordinate_(lat, lon)) return [];
  if (kind === 'park') return parkSearch_(lat, lon, '全部', details);
  return facilityRankNearby_(lat, lon, getFacilityData_('toilet', details));
}

function toiletSearch_(lat, lon, details) {
  return searchNearbyFacilities_('toilet', lat, lon, details);
}

function facilityWalkingUrl_(lat, lon) {
  if (!parkSearchCoordinate_(lat, lon)) return null;
  return 'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent(Number(lat) + ',' + Number(lon)) + '&travelmode=walking';
}

/** Use search output, not raw source objects. Guard against changed destinations.
 * Publication metadata is an in-process consistency check, not a signed token;
 * only trusted server-side callers may construct these objects.
 */
function facilityNavigationUrl_(facility) {
  if (facility && facility.kind === 'toilet' && facility.publicationSource === 'source-unverified') {
    var metadata = facility.sourceRelease, row = metadata && metadata.source;
    if (facility.publication || !metadata || metadata.mode !== 'source-unverified' || !row ||
        !facilityToiletSourceValid_(row) || facility.sourceStatus !== '待驗收' || facility.positionType !== '未知' ||
        facility.id !== facilityText_(row['公廁ID']) || facility.name !== facilityText_(row['公廁名稱']) ||
        facility.city !== facilityToiletCity_(row) || facility.district !== facilityText_(row['行政區']) ||
        facility.address !== facilityText_(row['地址']) ||
        facility.lat !== Number(row['緯度']) || facility.lon !== Number(row['經度']) ||
        !facilityTwinCityPosition_(facility.lat,facility.lon) ||
        metadata.sourceFingerprint !== facility.sourceFingerprint ||
        facilitySourceFingerprint_('toilet',row) !== facility.sourceFingerprint) return null;
    return facilityWalkingUrl_(facility.lat,facility.lon);
  }
  var proof = facility && facility.publication;
  if (!proof || ['park','toilet'].indexOf(facility.kind) < 0 || proof.kind !== facility.kind ||
      proof.id !== facility.id || proof.lat !== facility.lat || proof.lon !== facility.lon ||
      proof.sourceFingerprint !== facility.sourceFingerprint ||
      !/^[a-f0-9]{64}$/.test(proof.sourceFingerprint) ||
      !parkSearchCoordinate_(facility.lat, facility.lon) ||
      facility.kind === 'toilet' && !facilityNtpcPosition_(facility.lat, facility.lon)) return null;
  return facilityWalkingUrl_(facility.lat, facility.lon);
}
