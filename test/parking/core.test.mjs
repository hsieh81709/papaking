import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture as f,harness,plain,response as r} from './helpers.mjs';
const {lat,lon}=f.origin;
const entry=()=>({lat:25.001,lon:121.461,name:'合成場'});
const rank=(h,es=[entry()])=>h.c.rankSections(lat,lon,[{entries:es,driveCount:2}])[0];

test('TDX road grouping counts only cars within 1km',()=>{const h=harness();assert.deepEqual(plain(h.c.parseOnStreet(lat,lon,r(200,f.spots)).entries),[{segId:'S1',spotCount:2,lat:25.001,lon:121.461}]);});
test('car filtering precedes nearest-ten truncation',()=>{const h=harness();const moto=Array.from({length:12},()=>f.spots[2]);assert.equal(h.c.parseOnStreet(lat,lon,r(200,[...moto,f.spots[0]])).entries?.[0].segId,'S1');});
test('TDX offstreet parse orders by actual distance and excludes outside radius',()=>{const h=harness();const es=h.c.parseParking(lat,lon,null,r(200,[...f.parks].reverse())).entries;assert.deepEqual(plain(es).map(e=>e.name),['合成近場','合成遠場']);});
for(const code of [404,429,500])for(const name of ['parseOnStreet','parseParking'])test(`${name} ${code} has explicit result`,()=>{const h=harness();const out=name==='parseParking'?h.c[name](lat,lon,null,r(code)):h.c[name](lat,lon,r(code));assert.match(out.error,code===429?/一分鐘/:code===500?/錯誤/:/沒有/);});
for(const body of ['<html>error</html>','null','{}'])test(`malformed TDX ${body} yields explicit failure or empty`,()=>{const h=harness();assert.ok(h.c.parseOnStreet(lat,lon,r(200,body)).error);assert.ok(h.c.parseParking(lat,lon,null,r(200,body)).error);});
test('unknown or nonfinite coordinates cannot claim within 1km',()=>{const h=harness();const bad=[{}, {PositionLat:NaN,PositionLon:121}, {PositionLat:91,PositionLon:121}];assert.equal(h.c.nearestWithin(lat,lon,bad,x=>x,5).length,0);});
test('1km API query uses actual origin; grid shift must not omit edge candidate',()=>{const h=harness();const n=h.c.nearbyCached(lat,lon);for(const url of n.missUrls){const filter=new URL(url).searchParams.get('$spatialFilter');assert.equal(filter,`nearby(${lat},${lon},1000)`);} const edge={PositionLat:lat+0.0089,PositionLon:lon};assert.equal(h.c.nearestWithin(lat,lon,[edge],x=>x,5).length,1);assert.ok(h.c.calculateDistance(25,121.46,edge.PositionLat,edge.PositionLon)>1);});
test('nearby cache isolates different actual origins inside same old grid',()=>{const h=harness();const a=h.c.nearbyCached(lat,lon),b=h.c.nearbyCached(lat+.000001,lon);assert.notEqual(a.keys[0],b.keys[0]);});
for(const code of [429,401,403])test(`TDX ${code} rotates to next key and preserves success`,()=>{const h=harness();h.c.getTDXToken=i=>'fixture-token-'+i;h.fetch=(_u,o)=>r(o.headers.authorization.endsWith('0')?code:200,['ok']);assert.equal(h.c.tdxFetch('https://fixture.invalid/tdx').getResponseCode(),200);assert.equal(h.calls.length,2);assert.equal(h.cache.get(h.c.tdxRateKey(0)),'5');});
test('401 invalidates cached auth token so next minute can reauthenticate',()=>{const h=harness();h.cache.put('tdx_token_fixture-a','expired',21600);h.cache.put('tdx_token_fixture-b','valid',21600);h.fetch=(_u,o)=>r(o.headers.authorization==='Bearer expired'?401:200,[]);h.c.tdxFetch('https://fixture.invalid/tdx');assert.equal(h.cache.get('tdx_token_fixture-a'),null);});
test('TDX auth transport failure rotates instead of aborting reply',()=>{const h=harness();h.fetch=(u,o)=>{if(u===h.c.AUTH_URL){if(o.payload.client_id==='fixture-a')throw new Error('offline');return r(200,{access_token:'fixture-token'});}return r(200,[]);};assert.equal(h.c.tdxFetch('https://fixture.invalid/tdx').getResponseCode(),200);});
test('TDX auth HTML failure rotates',()=>{const h=harness();h.fetch=(u,o)=>u===h.c.AUTH_URL?r(o.payload.client_id==='fixture-a'?503:200,o.payload.client_id==='fixture-a'?'<html>failure</html>':{access_token:'fixture-token'}):r(200,[]);assert.equal(h.c.tdxFetch('https://fixture.invalid/tdx').getResponseCode(),200);});
test('all keys exhausted returns bounded 429 with no network',()=>{const h=harness();[0,1].forEach(i=>h.c.markTDXKeyExhausted(i));assert.equal(h.c.tdxFetch('https://fixture.invalid/tdx').getResponseCode(),429);assert.equal(h.calls.length,0);h.advance(61000);assert.equal(h.c.pickTDXKey(),0);});
test('TDX batch retries only failing slot and preserves extras alignment',()=>{const h=harness();h.c.getTDXToken=i=>'token-'+i;let first=true;h.fetch=(u)=>{if(u.endsWith('/bad')&&first){first=false;return r(401);}return r(200,[u]);};const out=h.c.tdxFetchAll(['https://fixture.invalid/bad','https://fixture.invalid/good'],[{url:'https://fixture.invalid/extra'}]);assert.deepEqual(plain(out.map(x=>JSON.parse(x.getContentText()))),[['https://fixture.invalid/bad'],['https://fixture.invalid/good'],['https://fixture.invalid/extra']]);assert.equal(h.calls.length,4);});
for(const [code,body,stored,ttl] of [[200,[],true,21600],[404,[],true,1800],[200,{},false],[200,'bad',false],[429,[],false],[500,[],false]])test(`nearby cache acceptance ${code} ${JSON.stringify(body)}`,()=>{const h=harness();const n=h.c.nearbyCached(lat,lon);h.c.nearbyStore(n,[r(code,body),r(code,body)]);assert.equal(h.cache.get(n.keys[0])!==null,stored);if(stored){assert.equal(h.writes[0].ttl,ttl);assert.equal(h.c.nearbyCached(lat,lon).missUrls.length,0);h.advance(ttl*1000);assert.equal(h.c.nearbyCached(lat,lon).missUrls.length,2);}});
test('chunk cache misses if any piece evicted',()=>{const h=harness();h.c.cachePutChunked(h.cache,'chunks','字'.repeat(60001),60);assert.equal(h.c.cacheGetChunked(h.cache,'chunks').length,60001);h.cache.remove('chunks_1');assert.equal(h.c.cacheGetChunked(h.cache,'chunks'),null);});
test('NTPC reads full three pages and tail in order',()=>{const h=harness();h.c.NTPC_PAGE_SIZE=2;h.fetch=()=>r(200,[{ID:'tail'}]);assert.deepEqual(plain(h.c.ntpcRowsFromPages('synthetic',[r(200,[1,2]),r(200,[3,4]),r(200,[5,6])])),[1,2,3,4,5,6,{ID:'tail'}]);assert.match(h.calls[0].url,/page=3&size=2/);});
for(const code of [500,429])test(`NTPC page ${code} never caches half static list`,()=>{const h=harness();h.c.NTPC_PAGE_SIZE=1;h.fetch=u=>r(new URL(u).searchParams.get('page')==='1'?code:200,f.ntpcStatic);assert.equal(h.c.getNtpcCarparks().length,0);assert.equal(h.cache.get('ntpc_carparks'),null);});
test('NTPC full page at safety cap is incomplete, not a complete snapshot',()=>{const h=harness();h.c.NTPC_PAGE_SIZE=1;h.fetch=()=>r(200,f.ntpcStatic);assert.equal(h.c.ntpcFetchAllPages('synthetic'),null);});
test('NTPC non-array page is rejected rather than concatenated',()=>{const h=harness();assert.equal(h.c.ntpcRowsFromPages('synthetic',[r(200,{error:'failed'})]),null);});
test('TWD97 independent projection reference within 1m',()=>{const h=harness(),p=f.projection;const actual=h.c.twd97ToWgs84(p.x,p.y);assert.ok(Math.abs(actual.lat-p.lat)<.00001);assert.ok(Math.abs(actual.lon-p.lon)<.00001);});
test('NTPC static cache excludes live data and live refreshes between events',()=>{const h=harness();h.fetch=()=>r(200,f.ntpcStatic);const list=h.c.getNtpcCarparks();assert.equal(list.length,1);const staticCalls=h.calls.length;h.c.parseNtpcLive(f.ntpcLive);let e=h.c.ntpcCarparksNear(25,121.4588,1)[0];assert.equal(e.available,7);h.c.LIVE={};h.fetch=()=>r(200,[{ID:'N1',AVAILABLECAR:'2'}]);e=h.c.ntpcCarparksNear(25,121.4588,1)[0];assert.equal(e.available,2);assert.equal(h.calls.length,staticCalls+3);assert.ok(!h.c.cacheGetChunked(h.cache,'ntpc_carparks').includes('AVAILABLECAR'));});
test('NTPC missing availability is unknown, real zero retained',()=>{const h=harness();const out=h.c.parseNtpcLive([...f.ntpcLive,{ID:'NULL',AVAILABLECAR:null},{ID:'EMPTY',AVAILABLECAR:''}]);assert.deepEqual(plain(out),{N1:7,N2:0});});
test('NTPC failed live leaves explicit unknown and short retry marker',()=>{const h=harness();assert.deepEqual(plain(h.c.parseNtpcLive(null)),{});assert.equal(h.cache.get('ntpc_live_failed'),'1');h.advance(60000);assert.equal(h.cache.get('ntpc_live_failed'),null);});
test('Keelung stale data excluded; recent minute timestamp retained',()=>{const h=harness(),live=h.c.parseKlcgLive(f.klcgHtml);assert.equal(live[h.c.klcgNormalizeName('合成新場')],7);assert.equal(live[h.c.klcgNormalizeName('合成舊場')],undefined);});
test('Keelung future timestamp cannot claim fresh availability',()=>{const h=harness();assert.equal(h.c.parseKlcgLive(f.klcgHtml)[h.c.klcgNormalizeName('合成未來場')],undefined);});
test('Keelung supports seconds timestamp without appending duplicate seconds',()=>{const h=harness();assert.equal(h.c.parseKlcgLive(f.klcgHtml)[h.c.klcgNormalizeName('合成秒數場')],3);});
test('expired geocode refreshes after 30 days, fresh entry does not call Maps',()=>{const h=harness();h.props['geo_fixture']='25,121.46,'+(h.c.Date.now()-1000);assert.equal(h.c.geocodeCached('fixture').lat,25);h.advance(h.c.GEOCODE_TTL_MS);h.geocode=()=>({results:[{geometry:{location:{lat:25.1,lng:121.5}}}]});assert.equal(h.c.geocodeCached('fixture').lat,25.1);});
test('Google drive RPC fixed nested response parses driving mode and meters',()=>{const h=harness();const d=[];d[1]=f.driveRpc;d[20]=[[[0],null,[120,'2分']]];assert.deepEqual(plain(h.c.parseGoogleDrive(")]}'\n"+JSON.stringify([d]))),{seconds:120,meters:500});assert.equal(h.c.parseGoogleDrive('<html>failure</html>'),null);});
test('Google total failure uses Maps, Maps failure uses straight distance',()=>{const h=harness();h.c.driveTimesBatch=()=>null;h.directions=()=>f.directions;assert.equal(rank(h)[0].drive.seconds,120);h.cache.remove(h.c.driveCacheKey(lat,lon,entry()));h.directions=()=>{throw new Error('quota exhausted');};const e=rank(h)[0];assert.equal(e.drive,null);assert.match(h.c.travelLine(e),/📍.*km/);assert.ok(!h.c.travelLine(e).includes('分鐘'));});
test('drive cache avoids network until TTL expires',()=>{const h=harness();h.c.driveTimesBatch=()=>[{seconds:90,meters:600}];rank(h);h.c.driveTimesBatch=()=>{throw new Error('must not fetch cached route');};assert.equal(rank(h)[0].drive.seconds,90);h.advance(1800000);h.c.driveTimesBatch=()=>null;assert.equal(rank(h)[0].drive,null);});
test('invalid cached drive duration cannot render negative travel time',()=>{const h=harness();h.cache.put(h.c.driveCacheKey(lat,lon,entry()),JSON.stringify({seconds:-60,meters:-1}),1800);h.c.driveTimesBatch=()=>null;assert.equal(rank(h)[0].drive,null);});
test('NaN coordinates removed before ranking',()=>{const h=harness();assert.equal(rank(h,[{lat:NaN,lon:121}]).length,0);});
test('drive budget capped across sections and exhausted uses distance',()=>{const h=harness();h.c.driveTimeCallsLeft=1;h.c.driveTimesBatch=()=>null;let maps=0;h.directions=()=>{maps++;return f.directions;};const es=rank(h,[entry(),{lat:25.002,lon:121.462}]);assert.equal(maps,1);assert.equal(es.filter(e=>e.drive).length,1);assert.equal(h.c.driveTimeCallsLeft,0);});
test('monthly personal cap, hashed keys and next Taipei month reset',()=>{const h=harness({MONTHLY_QUOTA:'1'});assert.equal(h.c.consumeQuota({userId:'fixture-user'}),null);assert.equal(h.c.consumeQuota({userId:'fixture-user'}),h.c.QUOTA_USER_TEXT);assert.ok(!Object.keys(h.props).some(k=>k.includes('fixture-user')));h.setTime('2026-10-31T16:00:00Z');assert.equal(h.c.consumeQuota({userId:'fixture-user'}),null);});
test('public 85 percent budget and whitelist reserve',()=>{const h=harness({MONTHLY_QUOTA:'1',MONTHLY_BUDGET:'20',QUOTA_WHITELIST:'fixture-admin'});h.props[h.c.quotaPrefix()+'total']='17';assert.equal(h.c.consumeQuota({userId:'fixture-public'}),h.c.QUOTA_BUDGET_TEXT);assert.equal(h.c.consumeQuota({userId:'fixture-admin'}),null);h.props[h.c.quotaPrefix()+'total']='20';assert.equal(h.c.consumeQuota({userId:'fixture-admin'}),h.c.QUOTA_BUDGET_TEXT);});
for(const type of ['group','room'])test(`${type} without userId shares global budget only`,()=>{const h=harness({MONTHLY_QUOTA:'1',MONTHLY_BUDGET:'20'});const source={type,[type+'Id']:'fixture-group'};assert.equal(h.c.consumeQuota(source),null);assert.equal(h.c.consumeQuota(source),null);assert.equal(h.props[h.c.quotaPrefix()+'total'],'2');});
test('identified group user shares personal cap across groups',()=>{const h=harness({MONTHLY_QUOTA:'1'});assert.equal(h.c.consumeQuota({type:'group',userId:'fixture-user',groupId:'g1'}),null);assert.equal(h.c.consumeQuota({type:'group',userId:'fixture-user',groupId:'g2'}),h.c.QUOTA_USER_TEXT);});
test('new user storage failure refuses query without logging identity',()=>{const h=harness({MONTHLY_QUOTA:'1'});h.propertyService.setProperty=()=>{throw new Error('storage full');};assert.equal(h.c.consumeQuota({userId:'fixture-private-user'}),h.c.QUOTA_STORE_FULL_TEXT);assert.ok(!h.logs.join('').includes('fixture-private-user'));});
test('group and room id command never broadcasts userId',()=>{for(const type of ['group','room']){const h=harness();let sent=0;h.c.replyLine=()=>sent++;h.c.doPost({postData:{contents:JSON.stringify({events:[{type:'message',source:{type,userId:'fixture-private-user'},message:{type:'text',text:'id'}}]})}});assert.equal(sent,0);}});
test('parking diagnostics never log origin or echoed user identifiers',()=>{const h=harness();h.c.nearbyCached(lat,lon);h.c.logTDXRequest('https://fixture.invalid/?nearby='+lat+','+lon);h.c.logTDXResponse('https://fixture.invalid',r(400,{origin:lat,userId:'fixture-private-user'}));const log=h.logs.join('\n');assert.ok(!log.includes(String(lat)));assert.ok(!log.includes('fixture-private-user'));});

test('full buildReply reuses static cache but refreshes live between two events',()=>{
 const h=harness();h.c.DRIVE_TIME_RPC_ENABLED=false;h.geocode=()=>({results:[{address_components:[{types:['administrative_area_level_1'],long_name:'新北市'}]}]});let remaining=7;
 h.fetch=(url)=>{
  if(url===h.c.AUTH_URL)return r(200,{access_token:'fixture-token'});
  if(url.includes('/Parking/OnStreet/ParkingSpot/NearBy'))return r(200,f.spots);
  if(url.includes('/Parking/OffStreet/CarPark/NearBy'))return r(200,[]);
  if(url.includes(h.c.NTPC_CARPARK_STATIC))return r(200,f.ntpcStatic);
  if(url.includes(h.c.NTPC_CARPARK_LIVE))return r(200,[{ID:'N1',AVAILABLECAR:String(remaining)}]);
  if(url.includes('/ParkingSegment/City/'))return r(200,[{ParkingSegmentID:'S1',ParkingSegmentName:{Zh_tw:'合成路段'}}]);
  throw new Error('Unexpected route');
 };
 const first=h.c.buildReply(lat,lon);assert.match(first[1],/剩餘 7 \/ 20/);assert.equal(first[2].type,'flex');const before=h.calls.length;
 remaining=2;const second=h.c.buildReply(lat,lon);assert.match(second[1],/剩餘 2 \/ 20/);assert.equal(h.calls.length-before,3);assert.ok(!h.logs.join('').includes(String(lat)));
});

for(const code of [401,429,500])test(`full buildReply upstream ${code} has explicit text without phantom cards`,()=>{
 const h=harness();h.c.DRIVE_TIME_RPC_ENABLED=false;h.fetch=u=>u===h.c.AUTH_URL?r(200,{access_token:'fixture-token'}):r(code,{error:'synthetic failure'});
 const messages=h.c.buildReply(lat,lon);assert.equal(messages.length,2);assert.ok(messages.every(m=>typeof m==='string'&&/錯誤|一分鐘/.test(m)));assert.equal(h.cache.get(h.c.nearbyCached(lat,lon).keys[0]),null);
});
test('NTPC tail HTTP failure does not cache prior successful pages',()=>{
 const h=harness();h.c.NTPC_PAGE_SIZE=1;h.fetch=u=>r(new URL(u).searchParams.get('page')==='3'?503:200,f.ntpcStatic);assert.equal(h.c.getNtpcCarparks().length,0);assert.equal(h.cache.get('ntpc_carparks'),null);
});
test('NTPC malformed JSON or transport failure does not cache static list',()=>{
 for(const mode of ['html','network']){const h=harness();h.fetch=()=>{if(mode==='network')throw new Error('synthetic failure');return r(200,'<html>failure</html>');};assert.equal(h.c.getNtpcCarparks().length,0);assert.equal(h.cache.get('ntpc_carparks'),null);}
});
test('drive corrupt cache falls back to distance without losing reply',()=>{
 const h=harness();h.cache.put(h.c.driveCacheKey(lat,lon,entry()),'malformed',1800);const es=rank(h);assert.equal(es.length,1);assert.ok(!es[0].drive);assert.match(h.c.travelLine(es[0]),/📍/);
});
test('drive RPC partial success leaves failed target at straight distance',()=>{
 const h=harness();h.c.driveTimesBatch=()=>[{seconds:90,meters:null},null];const es=rank(h,[entry(),{lat:25.002,lon:121.462}]);assert.equal(es[0].drive.seconds,90);assert.ok(es[0].drive.meters>0);assert.equal(es[1].drive,null);assert.match(h.c.travelLine(es[1]),/📍/);
});
test('nearby cache write failure still returns fetched responses',()=>{
 const h=harness(),n=h.c.nearbyCached(lat,lon);h.cache.put=()=>{throw new Error('cache quota');};const out=h.c.nearbyStore(n,[r(200,f.spots),r(200,f.parks)]);assert.equal(h.c.parseOnStreet(lat,lon,out[0]).entries.length,1);assert.equal(h.c.parseParking(lat,lon,null,out[1]).entries.length,2);
});
test('TDX keys are limited to five calls each within one minute',()=>{
 const h=harness();const indexes=Array.from({length:10},()=>h.c.pickTDXKey());assert.equal(indexes.filter(i=>i===0).length,5);assert.equal(indexes.filter(i=>i===1).length,5);assert.equal(h.c.pickTDXKey(),-1);
});
test('quota denial prevents data fetch and sends explanation only',()=>{
 const h=harness({MONTHLY_QUOTA:'1'});h.c.consumeQuota({userId:'fixture-user'});let sent;h.c.replyLine=(_t,text)=>{sent=text;};h.c.buildReply=()=>assert.fail('quota-denied request must not query parking');h.c.handleLocation({source:{userId:'fixture-user'},message:{latitude:lat,longitude:lon}});assert.equal(sent,h.c.QUOTA_USER_TEXT);
});
test('disabled quotas leave no persisted counters',()=>{const h=harness();assert.equal(h.c.consumeQuota({userId:'fixture-user'}),null);assert.ok(!Object.keys(h.props).some(k=>k.startsWith('quota_')));});
test('new month purges previous counters even if six-hour marker survives midnight',()=>{
 const h=harness({MONTHLY_QUOTA:'2'});h.setTime('2026-10-31T15:59:00Z');h.c.consumeQuota({userId:'fixture-user'});const old=h.c.quotaPrefix();h.advance(120000);h.c.consumeQuota({userId:'fixture-user'});assert.ok(!Object.keys(h.props).some(k=>k.startsWith(old)));
});
test('existing user counter write failure cannot bypass personal cap',()=>{
 const h=harness({MONTHLY_QUOTA:'2'});h.c.consumeQuota({userId:'fixture-user'});h.propertyService.setProperty=()=>{throw new Error('storage full');};assert.equal(h.c.consumeQuota({userId:'fixture-user'}),h.c.QUOTA_STORE_FULL_TEXT);
});
test('Google lookup and directions transport errors do not echo origin in logs',()=>{
 const h=harness();h.geocode=()=>{throw new Error(`private origin ${lat},${lon}`);};h.c.resolveTDXCity(lat,lon);h.directions=()=>{throw new Error(`private origin ${lat},${lon}`);};h.c.driveTime(lat,lon,25.001,121.461);assert.ok(!h.logs.join('').includes(String(lat)));
});
