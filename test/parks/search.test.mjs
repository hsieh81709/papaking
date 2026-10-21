import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,fixture,plain} from './helpers.mjs';
import {putRelease,release} from '../facilities/helpers.mjs';
function setup() {
 const h=harness(), {ps}=fixture(h,['P0']);ps.data.length=1;
 for(let i=8;i>=0;i--)ps.data.push(['P'+i,'臺北市','萬華區','測試公園'+i,'',25+i*.004,121.46,'','','','','','','可用','']);
 const fs=h.addSheet('公園設施',[
  ['公園ID','可查詢遊具類別（依休憩設施）','遊戲場名稱','其他設施'],
  ['P0','溜滑梯','普通遊戲場','鞦韆'],
  ['P0','鞦韆','共融遊戲場',''],
  ['P1','鞦韆、 溜滑梯','普通遊戲場',''],
  ['P2','','普通遊戲場','溜滑梯、鞦韆'],
  ['P3','溜滑梯','普通遊戲場','']]);
 return {h,ps,fs};
}
test('3km inclusive radius, five nearest results, straight-line sort and stable ties',()=>{
 const {h}=setup(),r=h.context.parkSearch_(25,121.46,'全部');
 assert.equal(r.length,5);assert.deepEqual(plain(r.map(p=>p.id)),['P0','P1','P2','P3','P4']);
 assert.ok(r.every(p=>p.km<=3));assert.equal(r[0].km,0);
});
test('exact radius boundary admitted; outside radius excluded',()=>{
 const {h,ps}=setup();ps.data.length=1;
 const d=3/6371*180/Math.PI;
 ps.data.push(['inside','新北市','板橋區','內','','25',121.46,'','','','','','','可用','']);
 ps.data.push(['edge','新北市','板橋區','邊界','',25+d,121.46,'','','','','','','可用','']);
 ps.data.push(['outside','新北市','板橋區','外','',25+d+0.000001,121.46,'','','','','','','可用','']);
 // Boundary fixtures have explicit synthetic publication approvals.
 putRelease(h,ps.data.slice(1).map(r=>release('park',Object.fromEntries(ps.data[0].map((k,i)=>[k,r[i]])))));
 const ids=plain(h.context.parkSearch_(25,121.46,'全部').map(p=>p.id));
 assert.ok(ids.includes('edge'));assert.ok(!ids.includes('outside'));
});
test('multiple facility rows merge; facility filter ignores unreliable other facilities',()=>{
 const {h}=setup();
 assert.deepEqual(plain(h.context.parkSearch_(25,121.46,'鞦韆').map(p=>p.id)),['P0','P1']);
 assert.deepEqual(plain(h.context.parkSearch_(25,121.46,'溜滑梯').map(p=>p.id)),['P0','P1','P3']);
 assert.deepEqual(plain(h.context.parkSearch_(25,121.46,'共融').map(p=>p.id)),['P0']);
});
test('invalid coordinates, duplicate IDs, missing IDs, unreviewed status are excluded',()=>{
 const {h,ps}=setup();
 ps.data[1][5]='bad';ps.data[2][5]=true;ps.data[3][5]='';ps.data[4][0]='';ps.data[5][13]='待確認';
 ps.data.push([...ps.data.find(r=>r[0]==='P1')]);
 const r=h.context.parkSearch_(25,121.46,'全部');
 assert.deepEqual(plain(r.map(p=>p.id)),['P0','P2','P3']);
});
for(const [lat,lon] of [[NaN,121.46],['bad',121.46],[null,121.46],[true,121.46],[25,Infinity],[25,[]],[25,0]])test(`invalid query ${String(lat)}, ${String(lon)} never queries Sheets`,()=>{
 const h=harness();h.context.SpreadsheetApp.openById=()=>{throw new Error('should not read');};
 assert.equal(h.context.parkSearch_(lat,lon,'全部').length,0);assert.match(h.context.buildParkFlexReply_(lat,lon,'全部'),/座標異常/);
});
test('no results uses text fallback; populated result builds up to five Flex cards',()=>{
 const {h,ps}=setup(),flex=h.context.buildParkFlexReply_(25,121.46,'全部');
 assert.equal(flex.type,'flex');assert.equal(flex.contents.contents.length,5);
 assert.match(flex.contents.contents[0].footer.contents[0].action.uri,/query=25%2C121.46/);
 ps.data.length=1;const text=h.context.buildParkFlexReply_(25,121.46,'全部');assert.equal(typeof text,'string');assert.match(text,/尚無已核准發布/);
});
test('intent is one-shot and scoped to conversation plus user, missing group user rejected',()=>{
 const {h:{context:c}}=setup(),a={type:'user',userId:'fixture-user'},b={type:'group',groupId:'fixture-group',userId:'fixture-user'};
 assert.equal(c.rememberParkIntent_(a,'溜滑梯'),true);assert.equal(c.takeParkIntent_(b),null);assert.equal(c.takeParkIntent_(a),'溜滑梯');assert.equal(c.takeParkIntent_(a),null);
 assert.equal(c.rememberParkIntent_({type:'group',groupId:'fixture-group'},'全部'),false);
 c.testPapaKingRouting();
});
test('real Webhook dispatch requires classification, routes park and explicit parking; no LINE API calls',()=>{
 const h=harness(['park_geocoding_gas.js','park_b45_sync_gas.js','park_search_gas.js','line_webhook_gas.js']);
 const c=h.context,replies=[],parking=[];
 c.replyLine=(token,msg)=>replies.push({token,msg});c.buildParkFlexReply_=(lat,lon,intent)=>({type:'flex',lat,lon,intent});
 c.handleLocation=event=>parking.push(event.message); // External parking services separately covered by offline static tests.
 const source={type:'user',userId:'fixture-user'};
 const text=s=>({type:'message',source,replyToken:'fixture-token',message:{type:'text',text:s}});
 const loc={type:'message',source,replyToken:'fixture-token',message:{type:'location',latitude:25,longitude:121.46}};
 const run=events=>c.doPost({postData:{contents:JSON.stringify({events})}});
 assert.equal(run([loc]).value,'OK');assert.equal(parking.length,0);assert.match(replies.at(-1).msg,/選擇.*分類/);
 run([text('附近有溜滑梯的公園'),loc,loc]);assert.ok(replies.some(r=>r.msg.intent==='溜滑梯'));assert.equal(parking.length,0);assert.match(replies.at(-1).msg,/選擇.*分類/);
 run([text('停車查詢'),loc]);assert.equal(parking.length,1);
 run([text('選單')]);assert.equal(replies.at(-1).msg.quickReply.items.length,3);
 assert.equal(run([{type:'follow'}]).value,'OK');assert.equal(c.doPost({}).value,'Invalid request');
});
test('existing parking Flex smoke tests and NTPC Static Fallback regression pass unchanged',()=>{
 const h=harness(['line_webhook_gas.js']);h.context.testPapaKingStaticFallbackV2();h.context.testPapaKingFlexV2_();
 assert.ok(h.logs.some(l=>String(l).includes('NTPC Static fallback')));
});
test('NTPC static road matches exact road/district, excludes motorcycle and alley parent match',()=>{
 const h=harness(['line_webhook_gas.js']),c=h.context;
 c.getNtpcStaticRoads=()=>[
  c.normalizeNtpcStaticRoad({area:'淡水區',road_name:'後洲路1段',rates:'依公告'}),
  c.normalizeNtpcStaticRoad({area:'淡水區',road_name:'機車道'}),
  c.normalizeNtpcStaticRoad({area:'板橋區',road_name:'後洲路一段'})];
 let route='後洲路一段';c.Maps={newGeocoder:()=>({setLanguage(){return this;},reverseGeocode:()=>({results:[{address_components:[{types:['route'],long_name:route},{types:['administrative_area_level_2'],long_name:'淡水區'}]}]})})};
 assert.equal(c.findNtpcStaticRoadMatch(25,121.46).area,'淡水區');
 route='後洲路一段139巷';assert.equal(c.findNtpcStaticRoadMatch(25,121.46),null);
 route='機車道';assert.equal(c.findNtpcStaticRoadMatch(25,121.46),null);
});
test('search fails explicitly on missing facility headers instead of returning false empty results',()=>{
 const {h,fs}=setup();fs.data[0][1]='未知欄位';assert.throws(()=>h.context.parkSearch_(25,121.46,'全部'),/缺少欄位/);
});
test('non-inclusive playground labels never match inclusive filter; positive rows still union',()=>{
 const {h,fs}=setup();fs.data.push(['P1','','非共融遊戲場','']);fs.data.push(['P2','','未設置共融遊戲場','']);
 assert.deepEqual(plain(h.context.parkSearch_(25,121.46,'共融').map(p=>p.id)),['P0']);
 fs.data.push(['P1','','共融遊戲場','']);assert.deepEqual(plain(h.context.parkSearch_(25,121.46,'共融').map(p=>p.id)),['P0','P1']);
});
