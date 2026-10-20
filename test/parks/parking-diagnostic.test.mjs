import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,plain} from './helpers.mjs';

function diagnostic(expectation='cards',kind='cards') {
 const h=harness(['line_webhook_gas.js']),c=h.context;let queries=0;
 Object.assign(h.props,{PAPAKING_TEST_LAT:'25',PAPAKING_TEST_LON:'121.46',PAPAKING_TEST_ENVIRONMENT:'isolated',PAPAKING_TEST_COMMIT:'a'.repeat(40),PAPAKING_TEST_GAS_VERSION:'42',PAPAKING_TEST_POINT_ID:'SYNTHETIC_PUBLIC_POINT',PAPAKING_TEST_EXPECTATION:expectation});
 c.ScriptApp={getScriptId:()=> 'SYNTHETIC_ISOLATED_SCRIPT'};
 const card=c.flexBubble({kind:'停車場',title:'合成停車場',lines:['合成資訊'],lat:25,lon:121.46});
 const empty=['🚗 路邊停車格\n目前沒有查詢到小客車停車格','🏢 停車場\n目前沒有查詢到停車場'];
 const messages=kind==='empty'?empty:['合成路邊資訊','合成停車場資訊',{type:'flex',contents:{type:'carousel',contents:[card]}}];
 c.buildReply=()=>{queries++;return messages;};
 c.UrlFetchApp={fetch(){throw new Error('No live LINE or other requests permitted by this test');}};
 return {...h,messages,card,queries:()=>queries};
}
test('PK-06 default card expectation rejects zero cards instead of logging PASS',()=>{
 const h=diagnostic('cards','empty');assert.throws(()=>h.context.testPapaKingLiveParkingV2(),/card|卡片/i);assert.ok(!h.logs.some(l=>String(l).startsWith('[PASS]')));
});
test('PK-06 static-fallback expectation fails if only regular parking cards exist',()=>{
 const h=diagnostic('static-fallback');assert.throws(()=>h.context.testPapaKingLiveParkingV2(),/fallback/i);assert.ok(!h.logs.some(l=>String(l).startsWith('[PASS]')));
});
test('PK-06 an explicit legitimate empty result has no card/color PASS claim',()=>{
 const h=diagnostic('empty','empty'),r=h.context.testPapaKingLiveParkingV2();
 assert.equal(r.status,'PASS_EMPTY_RESULT');assert.equal(r.cardCount,0);
 assert.equal(r.checks.find(c=>c.name==='parking-card-structure').outcome,'not_exercised');assert.equal(r.checks.find(c=>c.name==='empty-result-text').outcome,'passed');
 assert.ok(!h.logs.some(l=>/\[PASS\].*(color|顏色|structure)/i.test(l)));
});
test('PK-06 empty expectation rejects an unexpected populated result',()=>{
 const h=diagnostic('empty');assert.throws(()=>h.context.testPapaKingLiveParkingV2(),/empty|空結果/i);
});
test('PK-06 arbitrary zero-card text cannot pass as a valid empty parking result',()=>{
 const h=diagnostic('empty','empty');h.messages.splice(0,h.messages.length,'arbitrary text');assert.throws(()=>h.context.testPapaKingLiveParkingV2(),/empty|空結果/i);
});
test('PK-06 an upstream error cannot pass as empty or successful cards',()=>{
 for(const expectation of ['empty','cards']) {
  const h=diagnostic(expectation);h.messages.unshift('❌ 查詢失敗');assert.throws(()=>h.context.testPapaKingLiveParkingV2(),/error|錯誤|失敗/i);
 }
});
for(const [key,value] of [
 ['PAPAKING_TEST_ENVIRONMENT',undefined],['PAPAKING_TEST_ENVIRONMENT','production'],
 ['PAPAKING_TEST_COMMIT','short-sha'],['PAPAKING_TEST_GAS_VERSION',''],['PAPAKING_TEST_POINT_ID','25,121'],['PAPAKING_TEST_EXPECTATION','unknown']
])test(`PK-06 invalid receipt configuration ${key}=${String(value)} fails before querying`,()=>{
 const h=diagnostic();if(value===undefined)delete h.props[key];else h.props[key]=value;
 assert.throws(()=>h.context.testPapaKingLiveParkingV2(),/PAPAKING_TEST/);assert.equal(h.queries(),0);
});
test('PK-06 receipt records isolated target, supplied source/version, timestamp and actual assertions without coordinates',()=>{
 const h=diagnostic(),r=h.context.testPapaKingLiveParkingV2();
 assert.equal(r.status,'PASS');assert.equal(r.environment,'isolated');assert.equal(r.sourceCommit,'a'.repeat(40));assert.equal(r.gasVersion,'42');assert.equal(r.scriptId,'SYNTHETIC_ISOLATED_SCRIPT');
 assert.equal(r.testPointId,'SYNTHETIC_PUBLIC_POINT');assert.ok(Number.isFinite(Date.parse(r.recordedAt)));
 assert.equal(r.checks.find(c=>c.name==='parking-card-structure').outcome,'passed');assert.equal(r.checks.find(c=>c.name==='static-fallback').outcome,'not_exercised');
 assert.equal(r.actualGoogleSheetsWriteVerified,false);assert.equal(r.lineSchemaVerified,false);assert.equal(r.lineDeliveryVerified,false);assert.equal(r.sourceMetadataIndependentlyVerified,false);
 assert.ok(!JSON.stringify(r).includes('121.46'));assert.ok(!h.logs.some(l=>String(l).startsWith('[PASS] Live')));
 assert.match(r.sourceDescription,/buildReply/);assert.equal(h.queries(),1);
});
test('PK-06 explicit Static Fallback verifies its actual presence and no navigation',()=>{
 const h=diagnostic('static-fallback');const card=h.context.testPapaKingStaticFallbackV2();h.messages[2].contents.contents=[card];h.logs.length=0;
 const r=h.context.testPapaKingLiveParkingV2();assert.equal(r.fallbackCount,1);assert.equal(r.status,'PASS');assert.equal(r.checks.find(c=>c.name==='static-fallback').outcome,'passed');
});
test('PK-06 Static Fallback with a footer fails without a success receipt',()=>{
 const h=diagnostic('static-fallback'),card=h.context.testPapaKingStaticFallbackV2();card.footer={type:'box',contents:[]};h.messages[2].contents.contents=[card];h.logs.length=0;
 assert.throws(()=>h.context.testPapaKingLiveParkingV2(),/navigate|導航/i);assert.ok(!h.logs.some(l=>String(l).startsWith('[PASS]')));
});
test('PK-06 wrong color, empty carousel and malformed bubble do not pass structure checks',()=>{
 for(const mutate of [h=>{h.card.header.backgroundColor='#ffffff';},h=>{h.messages[2].contents.contents=[];},h=>{h.card.body.contents=[];}]) {
  const h=diagnostic();mutate(h);assert.throws(()=>h.context.testPapaKingLiveParkingV2());assert.ok(!h.logs.some(l=>String(l).startsWith('[PASS]')));
 }
});
test('PK-06 whitespace coordinates are invalid and never trigger data requests',()=>{
 const h=diagnostic();h.props.PAPAKING_TEST_LAT=' ';assert.throws(()=>h.context.testPapaKingLiveParkingV2(),/coordinates/i);assert.equal(h.queries(),0);
});
