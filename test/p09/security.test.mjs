import test from 'node:test';
import assert from 'node:assert/strict';
import {router,direct} from '../line/helpers.mjs';
import {signed} from './helpers.mjs';
function ev(h,id,text='選單'){return {type:'message',webhookEventId:id,timestamp:h.c.Date.now(),source:direct,replyToken:'SYNTHETIC',message:{type:'text',text}};}
function origin(h,b,extra){return h.c.originDoPost(signed(h.c,b,extra));}
test('P09 unsigned public GAS origin cannot query or reply',()=>{const h=router();h.c.originDoPost({postData:{contents:JSON.stringify({events:[ev(h,'x')]})}});assert.equal(h.sent.length,0);});
test('P09 no configured origin secret fails closed',()=>{const h=router();delete h.props.PK_ORIGIN_SECRET;origin(h,{events:[ev(h,'x')]});assert.equal(h.sent.length,0);});
for(const extra of [{aud:'wrong'},{channel:'wrong'},{issuedAt:0}])test('P09 bad audience/channel/expired envelope rejected '+JSON.stringify(extra),()=>{const h=router();origin(h,{events:[ev(h,'x')]},extra);assert.equal(h.sent.length,0);});
test('P09 payload mutation after signing fails MAC',()=>{const h=router(),e=signed(h.c,{events:[ev(h,'x')]});const b=JSON.parse(e.postData.contents);b.payload+=' ';e.postData.contents=JSON.stringify(b);h.c.originDoPost(e);assert.equal(h.sent.length,0);});
test('P09 missing event ID or timestamp rejects entire batch before side effects',()=>{for(const field of ['webhookEventId','timestamp']){const h=router(),a=ev(h,'x');delete a[field];origin(h,{events:[ev(h,'valid'),a]});assert.equal(h.sent.length,0);}});
test('P09 same ID with changed semantics cannot mutate selection',()=>{const h=router();origin(h,{events:[ev(h,'x','停車')]});origin(h,{events:[ev(h,'x','附近公廁')]});assert.equal(h.c.peekFacilityIntent_(direct).kind,'parking');assert.equal(h.sent.length,1);});
test('P09 completed duplicate survives new VM sharing durable properties',()=>{const h=router(),body={events:[ev(h,'x')]};origin(h,body);const other=router();Object.assign(other.props,h.props);origin(other,body);assert.equal(other.sent.length,0);});
test('P09 future/stale LINE events rejected even in fresh envelope',()=>{for(const shift of [-600001,60001]){const h=router(),a=ev(h,'x');a.timestamp+=shift;origin(h,{events:[a]});assert.equal(h.sent.length,0);}});
test('P09 ledger capacity rejects batch without partial query/reply',()=>{const h=router();const events=Array.from({length:33},(_,i)=>ev(h,'e'+i));origin(h,{events});assert.equal(h.sent.length,0);});
test('P09 durable ledger write failure prevents all external effects',()=>{
 for(const afterWrite of [false,true]){
  const h=router(),set=h.c.PROPS.setProperty,body={events:[ev(h,'x')]};
  h.c.PROPS.setProperty=(k,v)=>{if(k==='pk_state_v1'){if(afterWrite)set(k,v);throw Error('SYNTHETIC');}set(k,v);};
  origin(h,body);assert.equal(h.sent.length,0);assert.deepEqual(h.routes,[]);
  if(afterWrite){h.c.PROPS.setProperty=set;origin(h,body);assert.equal(h.sent.length,0);assert.deepEqual(h.routes,[]);}
 }
});
test('P09 cache eviction does not erase durable category',()=>{const h=router();h.text('附近公廁');h.clockCache.clear();h.location();assert.deepEqual(h.routes,['toilet']);});
test('P09 TDX budget cannot reset on cache eviction',()=>{const h=router();h.c.TDX_KEYS=[{id:'synthetic',secret:'synthetic'}];for(let i=0;i<5;i++)assert.equal(h.c.pickTDXKey(),0);h.clockCache.clear();assert.equal(h.c.pickTDXKey(),-1);});
test('P09 pure Flex rejection retries same snapshot once; redelivery never requery',()=>{const h=router();h.text('附近公廁');h.codes.push(400,400);const a={...ev(h,'loc'),message:{type:'location',latitude:25,longitude:121.46}};origin(h,{events:[a]});origin(h,{events:[{...a,replyToken:'NEW',deliveryContext:{isRedelivery:true}}]});assert.deepEqual(h.routes,['toilet']);assert.deepEqual(h.sent.slice(-2).map(x=>x.messages[0].type),['flex','text']);});
test('P09 old failed query cannot restore a category after newer selection was consumed',()=>{
 const h=router();let nested=false;const original=h.c.toiletSearch_;
 h.c.toiletSearch_=(...a)=>{if(!nested){nested=true;h.text('附近公園');h.location();throw Error('old failed');}return original(...a);};
 h.text('附近公廁');h.location();assert.equal(nested,true);assert.equal(h.c.peekFacilityIntent_(direct).kind,'unset');assert.deepEqual(h.routes,['park']);
});
test('P09 menu cancellation fences restoration of an older failed query',()=>{
 const h=router();h.c.toiletSearch_=()=>{h.text('選單');throw Error('old failed');};h.text('附近公廁');h.location();assert.equal(h.c.peekFacilityIntent_(direct).kind,'unset');
});
test('P09 uncertain reply is retained UNKNOWN and never retried after changed token',()=>{
 const h=router();h.text('附近公廁');h.codes.push(500);const body={events:[{...ev(h,'uncertain'),message:{type:'location',latitude:25,longitude:121.46}}]};origin(h,body);
 const state=JSON.parse(h.props.pk_state_v1);const record=Object.values(state.events).find(r=>r.phase==='UNKNOWN_REPLY');assert.equal(record.status,'UNKNOWN');
 const n=h.sent.length;body.events[0].replyToken='NEW';origin(h,body);assert.equal(h.sent.length,n);assert.deepEqual(h.routes,['toilet']);
});
test('P09 failed reservation before reply attempt prevents all LINE sends',()=>{
 const h=router(),set=h.c.PROPS.setProperty;h.c.PROPS.setProperty=(k,v)=>{if(k==='pk_state_v1'&&v.includes('REPLY_STARTED'))throw Error('write failed');set(k,v);};
 h.text('選單');assert.equal(h.sent.length,0);assert.equal(Object.values(JSON.parse(h.props.pk_state_v1).events)[0].status,'UNKNOWN');
});
test('P09 malformed durable state is not reset to an empty ledger',()=>{
 const h=router();h.props.pk_state_v1='{broken';origin(h,{events:[ev(h,'x')]});assert.equal(h.sent.length,0);assert.equal(h.props.pk_state_v1,'{broken');
});
test('P09 stale tombstone GC never drops UNKNOWN records',()=>{
 const h=router();h.text('附近公廁');h.codes.push(500);h.location();h.advance(86401);h.c.papaKingState_(()=>{});assert.ok(Object.values(JSON.parse(h.props.pk_state_v1).events).some(r=>r.status==='UNKNOWN'));
});
test('P09 same semantics with reordered JSON keys is still one event',()=>{
 const h=router(),a=ev(h,'ordered');origin(h,{events:[a]});a.source={userId:direct.userId,type:'user'};a.message={text:'選單',type:'text'};origin(h,{events:[a]});assert.equal(h.sent.length,1);
});
test('P09 durable intent count and byte bounds reject before any query',()=>{
 const h=router();for(let i=0;i<16;i++)assert.equal(h.c.rememberFacilityIntent_({type:'user',userId:'synthetic'+i},'park','全部'),true);
 assert.throws(()=>h.c.rememberFacilityIntent_({type:'user',userId:'synthetic-overflow'},'park','全部'),/capacity/);assert.deepEqual(h.routes,[]);
 const before=h.props.pk_state_v1;assert.throws(()=>h.c.papaKingState_(s=>{s.padding='字'.repeat(3000);}),/capacity/);assert.equal(h.props.pk_state_v1,before);
});
test('P09 two different position IDs overlapping still consume the category only once',()=>{
 const h=router();let nested=false;const search=h.c.toiletSearch_;h.c.toiletSearch_=(...a)=>{if(!nested){nested=true;h.location();}return search(...a);};h.text('附近公廁');h.location();assert.equal(nested,true);assert.deepEqual(h.routes,['toilet']);
});
test('P09 monthly total partial write failure refuses query and conservatively keeps user reservation',()=>{
 const h=router();h.c.MONTHLY_QUOTA=10;h.c.MONTHLY_BUDGET=100;h.c.Utilities.formatDate=()=> '202610';
 const set=h.c.PROPS.setProperty;h.c.PROPS.setProperty=(k,v)=>{if(k==='quota_202610_total')throw Error('synthetic partial write');set(k,v);};
 assert.notEqual(h.c.consumeQuota(direct),null);const key=h.c.quotaUserKey('quota_202610_',direct.userId);assert.equal(h.props[key],'1');
});
test('P09 late unseen old command/menu cannot overwrite newer classification',()=>{
 for(const text of ['附近公廁','選單']){const h=router();h.text('附近公園');const a=ev(h,'late',text);a.timestamp-=1000;origin(h,{events:[a]});assert.equal(h.c.peekFacilityIntent_(direct).kind,'park');}
});
test('P09 delayed selection does not extend 10-minute validity from reception',()=>{
 const h=router(),a=ev(h,'delayed','附近公廁');a.timestamp-=599000;origin(h,{events:[a]});h.advance(1);h.location();assert.deepEqual(h.routes,[]);assert.match(h.lastText(),/逾時/);
});
test('P09 old unseen location cannot consume a later category',()=>{
 const h=router();h.text('附近公廁');const a={...ev(h,'late-location'),message:{type:'location',latitude:25,longitude:121.46}};a.timestamp-=1000;origin(h,{events:[a]});assert.deepEqual(h.routes,[]);assert.equal(h.c.peekFacilityIntent_(direct).kind,'toilet');
});
test('P09 signed envelope still rejects wrong original LINE destination',()=>{
 const h=router();origin(h,{destination:'wrong-channel',events:[ev(h,'x')]});assert.equal(h.sent.length,0);
});
test('P09 Taipei equipment quick replies reuse existing intents and keep primary location action',()=>{
 const h=router(),prompt=h.c.buildPapaKingLocationPrompt_('park'),actions=Array.from(prompt.quickReply.items,x=>x.action);
 assert.equal(actions[0].type,'location');for(const [label,intent] of [['臺北溜滑梯','溜滑梯'],['臺北鞦韆','鞦韆'],['臺北共融','共融']]){const action=actions.find(x=>x.label===label);assert.ok(action);h.text(action.text);assert.equal(h.c.peekFacilityIntent_(direct).intent,intent);}
 assert.equal(h.c.buildPapaKingLocationPrompt_('toilet').quickReply.items.length,2);
});
test('P09 logs never echo failed LINE response body or raw event payload',()=>{
 const h=router();h.c.UrlFetchApp={fetch:()=>({getResponseCode:()=>400,getContentText:()=> 'SYNTHETIC_PRIVATE_CANARY'})};
 h.c.postLineReply('PRIVATE_REPLY_TOKEN',[{type:'text',text:'synthetic'}]);assert.ok(!h.logs.join().includes('SYNTHETIC_PRIVATE_CANARY'));assert.ok(!h.logs.join().includes('PRIVATE_REPLY_TOKEN'));
});
