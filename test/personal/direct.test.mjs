import test from 'node:test';
import assert from 'node:assert/strict';
import {router} from '../line/helpers.mjs';
import {configure} from '../p09/helpers.mjs';
const owner='U'+'1'.repeat(32),other='U'+'2'.repeat(32);
const direct={type:'user',userId:owner};
function personal(options={}) {
 const h=router(options);Object.assign(h.props,{PK_WEBHOOK_MODE:'personal-direct',PK_ALLOWED_LINE_USER_ID:owner,MONTHLY_BUDGET:'30'});h.c.MONTHLY_BUDGET=30;
 delete h.props.PK_ORIGIN_SECRET;delete h.props.PK_ORIGIN_AUDIENCE;delete h.props.PK_LINE_CHANNEL;
 let serial=0;
 h.event=(message,source=direct,id='personal-'+(++serial),timestamp=h.c.Date.now())=>({type:'message',webhookEventId:id,timestamp,source,replyToken:'SYNTHETIC_PERSONAL',message});
 h.raw=(events,destination='SYNTHETIC_BOT')=>h.c.originDoPost({postData:{type:'application/json',contents:JSON.stringify({destination,events})}});
 h.textRaw=(value,source=direct)=>h.raw([h.event({type:'text',text:value},source)]);
 h.locRaw=(source=direct)=>h.raw([h.event({type:'location',latitude:25,longitude:121.46},source)]);
 return h;
}
const text=value=>({type:'text',text:value}),loc={type:'location',latitude:25,longitude:121.46};
for(const [command,kind] of [['停車','parking'],['附近公園','park'],['附近公廁','toilet']])test(`personal owner DM routes ${kind} without origin secret or second environment`,()=>{const h=personal();h.textRaw(command);h.locRaw();assert.deepEqual(h.routes,[kind]);assert.equal(h.sent.length,2);});
test('personal no messages from another user, group, room or disguised group source reach ledger or LINE',()=>{
 for(const source of [{type:'user',userId:other},{type:'group',groupId:'G',userId:owner},{type:'room',roomId:'R',userId:owner},{type:'user',userId:owner,groupId:'G'},{type:'user',userId:owner,roomId:'R'},{type:'user'},{}]){
  const h=personal();for(const m of [text('停車'),text('id'),loc])h.raw([h.event(m,source)]);assert.deepEqual(h.routes,[]);assert.equal(h.sent.length,0);assert.equal(h.props.pk_state_v1,undefined);
 }
});
test('personal rejects unauthorized events within a mixed batch before intent/quota changes',()=>{const h=personal();h.raw([h.event(text('停車')),h.event(text('附近公廁'),{type:'user',userId:other}),h.event(loc)]);assert.deepEqual(h.routes,['parking']);assert.equal(h.sent.length,2);});
test('personal authorized id command remains private and unauthorized id has zero reply',()=>{const h=personal();h.textRaw('id',{type:'user',userId:other});assert.equal(h.sent.length,0);h.textRaw('id');assert.match(h.lastText(),new RegExp(owner));});
test('personal missing/invalid allowlist refuses instead of enabling public access',()=>{for(const value of [undefined,'',owner+','+other,'SYNTHETIC']){const h=personal();if(value===undefined)delete h.props.PK_ALLOWED_LINE_USER_ID;else h.props.PK_ALLOWED_LINE_USER_ID=value;h.textRaw('停車');h.locRaw();assert.deepEqual(h.routes,[]);assert.equal(h.sent.length,0);}});
test('personal requires a finite positive monthly budget before activation',()=>{for(const value of [undefined,'0','-1','NaN','Infinity','1.5']){const h=personal();if(value===undefined)delete h.props.MONTHLY_BUDGET;else h.props.MONTHLY_BUDGET=value;h.textRaw('停車');assert.equal(h.sent.length,0);}});
test('personal explicit kill switch refuses all owner work',()=>{const h=personal();h.props.PK_WEBHOOK_ENABLED='false';h.textRaw('停車');h.locRaw();assert.equal(h.sent.length,0);assert.deepEqual(h.routes,[]);});
test('personal is never inferred from a missing secret or a misspelled mode',()=>{for(const mode of [undefined,'personal','personal_direct']){const h=personal();if(mode===undefined)delete h.props.PK_WEBHOOK_MODE;else h.props.PK_WEBHOOK_MODE=mode;h.textRaw('停車');assert.equal(h.sent.length,0);}});
test('personal optional bot destination pin rejects wrong destination',()=>{const h=personal();h.props.PK_LINE_CHANNEL='EXPECTED_BOT';h.raw([h.event(text('停車'))],'OTHER_BOT');assert.equal(h.sent.length,0);h.raw([h.event(text('停車'))],'EXPECTED_BOT');assert.equal(h.sent.length,1);});
test('personal owner location redelivery cannot repeat query or consume newer selection',()=>{
 const h=personal(),selection=h.event(text('停車')),position=h.event(loc);h.raw([selection,position]);assert.deepEqual(h.routes,['parking']);h.textRaw('附近公廁');h.raw([{...position,replyToken:'NEW',deliveryContext:{isRedelivery:true}}]);assert.deepEqual(h.routes,['parking']);assert.equal(h.c.peekFacilityIntent_(direct).kind,'toilet');h.locRaw();assert.deepEqual(h.routes,['parking','toilet']);
});
test('personal replay namespace cannot be changed by forged body destination',()=>{const h=personal(),events=[h.event(text('停車')),h.event(loc)];h.raw(events,'BOT_A');h.raw(events,'BOT_B');assert.deepEqual(h.routes,['parking']);});
test('personal repeated category event does not extend 600 second validity',()=>{const h=personal(),selection=h.event(text('附近公園'));h.raw([selection]);h.advance(599);h.raw([selection]);h.advance(1);h.locRaw();assert.deepEqual(h.routes,[]);assert.match(h.lastText(),/逾時/);});
test('personal 400 Flex fallback uses one search and one bounded text fallback',()=>{const h=personal();h.textRaw('附近公廁');h.codes.push(400,200);h.locRaw();assert.deepEqual(h.routes,['toilet']);assert.deepEqual(h.sent.slice(-2).map(x=>x.messages[0].type),['flex','text']);});
test('personal no publication ledger means no NTPC park or toilet navigation',()=>{const h=personal({realPark:true,releases:[]});const p=h.sheets.get('公園資料');p.data[1][0]='NP-SYNTHETIC';p.data[1][1]='新北市';p.data[1][2]='板橋區';h.sheets.delete('設施發布核准');for(const command of ['附近公園','附近公廁']){h.textRaw(command);h.locRaw();assert.match(h.lastText(),/尚無已核准發布/);assert.ok(!JSON.stringify(h.sent.at(-1)).includes('maps/dir'));}assert.equal(h.events.length,0);});
test('personal normal old DONE events free capacity only after the 11 minute replay horizon',()=>{const h=personal();for(let i=0;i<32;i++)h.textRaw('選單');assert.equal(h.sent.length,32);h.textRaw('選單');assert.equal(h.sent.length,32);h.advance(661);h.textRaw('選單');assert.equal(h.sent.length,33);});
test('personal 60-second-future event stays deduplicated until it is necessarily stale',()=>{const h=personal(),e=h.event(text('選單'),direct,'future',h.c.Date.now()+60000);h.raw([e]);assert.equal(h.sent.length,1);h.advance(660);h.raw([e]);assert.equal(h.sent.length,1);h.advance(1);h.textRaw('選單');assert.equal(h.sent.length,2);h.raw([e]);assert.equal(h.sent.length,2);});
test('personal UNKNOWN delivery is never removed merely to free capacity',()=>{const h=personal();h.codes.push(500);h.textRaw('選單');h.advance(661);h.textRaw('選單');assert.ok(Object.values(JSON.parse(h.props.pk_state_v1).events).some(r=>r.status==='UNKNOWN'));});
test('RISK personal allowlist is not LINE authentication: forged allowed ID is accepted',()=>{const h=personal();h.raw([h.event(text('停車')),h.event(loc)]);assert.deepEqual(h.routes,['parking']);});

test('personal real quota reservation survives replay and refuses owner after monthly allowance',()=>{
 const h=personal(),original=h.c.handleLocation;h.c.MONTHLY_QUOTA=2;h.c.Utilities.formatDate=()=> '202610';
 h.c.handleLocation=e=>{const refusal=h.c.consumeQuota(e.source);if(refusal)h.c.replyLine(e.replyToken,refusal);else original(e);};
 let last;
 for(let i=0;i<3;i++){h.textRaw('停車');last=h.event(loc);h.raw([last]);}
 assert.deepEqual(h.routes,['parking','parking']);assert.equal(h.props.quota_202610_total,'2');assert.match(h.lastText(),/額度.*用完/);
 h.raw([last]);assert.equal(h.props.quota_202610_total,'2');assert.deepEqual(h.routes,['parking','parking']);
});
test('personal ledger never stores owner ID, raw position or reply token',()=>{
 const h=personal();h.textRaw('附近公園');h.locRaw();const raw=h.props.pk_state_v1;
 for(const value of [owner,'121.46','SYNTHETIC_PERSONAL'])assert.ok(!raw.includes(value));
});
test('configured owner allowlist also applies to signed mode without weakening signature requirements',()=>{
 const h=personal();configure(h.c,h.props);h.props.PK_WEBHOOK_MODE='signed';
 h.raw([h.event(text('停車'))],'synthetic-channel');assert.equal(h.sent.length,0);
 const send=events=>h.c.doPost({postData:{contents:JSON.stringify({events})}});
 send([h.event(text('停車'))]);send([h.event(loc,{type:'group',groupId:'G',userId:owner}),h.event(loc,{type:'user',userId:other}),h.event(loc)]);
 assert.deepEqual(h.routes,['parking']);assert.equal(h.sent.length,2);
});
