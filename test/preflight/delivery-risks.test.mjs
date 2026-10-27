/** P09 safety assertions; original risk baseline retained in P03/P04 evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {router,direct} from '../line/helpers.mjs';
const message=(type,value)=>type==='text'?{type,text:value}:{type,latitude:25,longitude:121.46};
function event(h,id,msg,redelivery=false){return h.c.doPost({postData:{contents:JSON.stringify({events:[{type:'message',webhookEventId:id,deliveryContext:{isRedelivery:redelivery},source:direct,replyToken:'SYNTHETIC',message:msg}]})}});}
test('SAFETY: sequential duplicate parking location does not query parking twice without new selection',()=>{
 const h=router();event(h,'S1',message('text','停車'));event(h,'L1',message('location'));event(h,'L1',message('location'),true);assert.deepEqual(h.routes,['parking']);
});
test('R1 FIXED: replayed selection + location queries parking once',()=>{
 const h=router();for(const replay of [false,true]){event(h,'S1',message('text','停車'),replay);event(h,'L1',message('location'),replay);}assert.deepEqual(h.routes,['parking']);
});
test('R2 FIXED: old location cannot consume newer category',()=>{
 const h=router();event(h,'S1',message('text','停車'));event(h,'L1',message('location'));h.text('附近公廁');event(h,'L1',message('location'),true);assert.deepEqual(h.routes,['parking']);assert.equal(h.c.peekFacilityIntent_(direct).kind,'toilet');
});
test('R3 FIXED: failed same event never reexecutes query',()=>{
 const h=router();let calls=0;h.c.toiletSearch_=()=>{calls++;throw new Error('SYNTHETIC');};h.text('附近公廁');for(const replay of [false,true]){const result=event(h,'L1',message('location'),replay);assert.equal(result.value,'OK');}assert.equal(calls,1);assert.match(h.lastText(),/系統.*暫時/);
});
test('R4 FIXED: duplicate in-flight toilet event runs only once',()=>{
 const h=router(),original=h.c.toiletSearch_;let nested=false;h.c.toiletSearch_=(...args)=>{if(!nested){nested=true;event(h,'L1',message('location'),true);}return original(...args);};h.text('附近公廁');event(h,'L1',message('location'));assert.deepEqual(h.routes,['toilet']);
});
test('R5 FIXED: atomic take plus event claim prevents duplicate parking',()=>{
 const h=router(),original=h.c.takeFacilityIntent_;let nested=false;
 h.c.takeFacilityIntent_=(...a)=>{if(!nested){nested=true;event(h,'L1',message('location'),true);}return original(...a);};
 h.text('停車');event(h,'L1',message('location'));assert.deepEqual(h.routes,['parking']);
});
test('R6 FIXED: stale completion cannot remove newer intent',()=>{
 const h=router();h.text('附近公廁');const state=h.c.peekFacilityIntent_(direct);h.text('附近公園');
 assert.equal(h.c.clearFacilityIntent_(direct,state.snapshot),false);assert.equal(h.c.peekFacilityIntent_(direct).kind,'park');
});
test('R7 FIXED: a selection is a complete single durable value',()=>{
 const h=router();h.text('附近公廁');h.clockCache.clear();assert.equal(h.c.peekFacilityIntent_(direct).kind,'toilet');
 h.text('附近公園');assert.equal(h.c.peekFacilityIntent_(direct).kind,'park');
});
test('R8 FIXED: unsigned direct origin cannot query or send LINE',()=>{
 const h=router();h.c.originDoPost({postData:{contents:JSON.stringify({events:[{type:'message',source:direct,replyToken:'SYNTHETIC',message:message('text','停車')}]})}});
 assert.deepEqual(h.routes,[]);assert.equal(h.sent.length,0);
});
test('R9 FIXED: admitted monthly queries all have reservations',()=>{
 const h=router();h.c.MONTHLY_BUDGET=100;h.c.MONTHLY_QUOTA=0;h.c.Utilities.formatDate=()=> '202610';
 const base=h.c.PROPS,key='quota_202610_total';let nested=false,inner;
 h.c.PROPS={...base,getProperties:()=>({...h.props}),deleteProperty:k=>delete h.props[k],getProperty:k=>{
  const value=base.getProperty(k);if(k===key&&!nested){nested=true;inner=h.c.consumeQuota(direct);}return value;
 }};
 assert.equal(h.c.consumeQuota(direct),null);assert.notEqual(inner,null);assert.equal(h.props[key],'1');
});
test('R10 FIXED: eleven-event batch accounts for all eleven',()=>{
 const h=router(),events=Array.from({length:11},(_,i)=>({type:'message',webhookEventId:`S${i}`,source:direct,replyToken:'SYNTHETIC',message:message('text','選單')}));
 const result=h.c.doPost({postData:{contents:JSON.stringify({events})}});assert.equal(result.value,'OK');assert.equal(h.sent.length,11);
});
test('SAFETY: 599 seconds valid and 600 seconds expired with no implicit parking',()=>{
 const h=router();h.text('附近公廁');h.advance(599);assert.equal(h.c.peekFacilityIntent_(direct).kind,'toilet');h.advance(1);h.location();assert.deepEqual(h.routes,[]);assert.match(h.lastText(),/逾時/);
});
test('SAFETY: absent release ledger excludes NTPC parks and uncertain toilets, no navigation',()=>{
 const h=router({realPark:true});const p=h.sheets.get('公園資料');p.data[1][0]='NP-SYNTHETIC';p.data[1][1]='新北市';p.data[1][2]='板橋區';h.sheets.delete('設施發布核准');h.sheets.get('公廁資料').data[1][18]='待確認';
 for(const t of ['附近公園','附近公廁']){h.text(t);h.location();assert.match(h.lastText(),t==='附近公園'?/尚無已核准發布/:/尚無符合發布條件/);assert.ok(!JSON.stringify(h.sent.at(-1)).includes('maps/dir'));}assert.deepEqual(h.events,[]);
});
test('SAFETY: HTTP400 fallback does not requery or invoke parking',()=>{
 const h=router();h.text('附近公廁');h.codes.push(400,200);h.location();assert.deepEqual(h.routes,['toilet']);assert.deepEqual(h.sent.slice(-2).map(b=>b.messages[0].type),['flex','text']);
});
