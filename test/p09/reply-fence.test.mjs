import test from 'node:test';
import assert from 'node:assert/strict';
import {router} from '../line/helpers.mjs';
const rich={type:'flex',altText:'SYNTHETIC',contents:{type:'bubble',body:{type:'box',layout:'vertical',contents:[{type:'text',text:'synthetic'}]}}};
function run(codes,action){const h=router();h.codes.push(...codes);h.c.handlePapaKingMessage_=e=>action(h,e);h.text('選單');return h;}
test('reply owner: committed success cannot send a second primary reply',()=>{
 const h=run([200,200],(h,e)=>{h.c.replyLine(e.replyToken,'first');h.c.replyLine(e.replyToken,'second');});assert.equal(h.sent.length,1);
});
test('reply owner: known text rejection cannot start another primary reply',()=>{
 const h=run([400,200],(h,e)=>{h.c.replyLine(e.replyToken,'first');h.c.replyLine(e.replyToken,'second');});assert.equal(h.sent.length,1);
});
test('reply owner: fallback requires known 400 rejection and the exact original snapshot',()=>{
 const uncertain=run([500,200],(h,e)=>{h.c.replyLine(e.replyToken,rich,'snapshot');h.c.papaKingPostReply_(e.replyToken,[{type:'text',text:'snapshot'}],true);});assert.equal(uncertain.sent.length,1);
 const changed=run([400,200],(h,e)=>{h.c.papaKingPostReply_(e.replyToken,[rich],false,[{type:'text',text:'original snapshot'}]);h.c.papaKingPostReply_(e.replyToken,[{type:'text',text:'changed snapshot'}],true);});assert.equal(changed.sent.length,1);
});
test('reply owner: failed 400 text fallback cannot lead to a third attempt',()=>{
 const h=run([400,400,200],(h,e)=>{h.c.replyLine(e.replyToken,rich,'snapshot');h.c.papaKingPostReply_(e.replyToken,[{type:'text',text:'snapshot'}],true);});assert.equal(h.sent.length,2);assert.deepEqual(h.sent.map(x=>x.messages[0].type),['flex','text']);
});
test('reply owner: fallback cannot be the first attempt',()=>{
 const h=run([200],(h,e)=>h.c.papaKingPostReply_(e.replyToken,[{type:'text',text:'snapshot'}],true));assert.equal(h.sent.length,0);
});
test('reply owner: 429 rejection does not authorize a fallback',()=>{
 const h=run([429,200],(h,e)=>{h.c.replyLine(e.replyToken,rich,'snapshot');h.c.papaKingPostReply_(e.replyToken,[{type:'text',text:'snapshot'}],true);});assert.equal(h.sent.length,1);
});
test('durable state: scalar maps fail closed without rewriting corrupt contents',()=>{
 for(const field of ['events','intents'])for(const value of ['broken',42,true]){
  const h=router(),state={v:1,events:{},intents:{},[field]:value},raw=JSON.stringify(state);h.props.pk_state_v1=raw;
  assert.equal(h.text('選單').value,'unavailable');assert.equal(h.sent.length,0);assert.equal(h.props.pk_state_v1,raw);
 }
});
test('durable state: invalid event record cannot silently lose dedup evidence',()=>{
 for(const record of [{status:'DONE',time:0},{hash:'x',time:1,status:'DONE'},{hash:'a'.repeat(64),time:1,status:'UNRECOGNIZED'}]){
  const h=router(),raw=JSON.stringify({v:1,events:{['a'.repeat(64)]:record},intents:{}});h.props.pk_state_v1=raw;
  assert.equal(h.text('選單').value,'unavailable');assert.equal(h.sent.length,0);assert.equal(h.props.pk_state_v1,raw);
 }
});
