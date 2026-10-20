import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,plain} from './helpers.mjs';
const headers=['公園ID','縣市','行政區','公園名稱','地址','緯度','經度','管理單位','資料來源ID','原始資料ID','來源網址','資料更新日期','同步時間','資料狀態','備註'];
function setup(){
 const h=harness(['park_search_gas.js','line_webhook_gas.js']);
 const parks=h.addSheet('公園資料',[headers,['TP-1','臺北市','萬華區','台北合成園','甲路',25.04,121.5,'','TP_PARK','','','','','可用',''],['NP-1','新北市','三重區','新北合成園','乙路',25.041,121.5,'','NTPC_PARK','','','','','可用','']]);
 const facilities=h.addSheet('公園設施',[['公園ID','可查詢遊具類別（依休憩設施）','遊戲場名稱','資料狀態'],['TP-1','溜滑梯、鞦韆','共融遊戲場','可用'],['NP-1','溜滑梯、鞦韆','共融遊戲場','可用']]);
 return {...h,parks,facilities};
}
test('MVP border query includes both cities sorted by actual distance',()=>{const h=setup(),r=h.context.parkSearch_(25.0408,121.5,'全部');assert.deepEqual(plain(r.map(x=>x.id)),['NP-1','TP-1']);assert.ok(r[0].km<r[1].km);});
for(const intent of ['溜滑梯','鞦韆','共融'])test(`MVP ${intent} filters only Taipei even if NTPC has unverified feature tags`,()=>{const h=setup();assert.deepEqual(plain(h.context.parkSearch_(25.0408,121.5,intent).map(p=>p.id)),['TP-1']);});
test('MVP NTPC nearby never displays raw facility tags',()=>{const h=setup(),p=h.context.parkSearch_(25.041,121.5,'全部').find(x=>x.id==='NP-1');assert.deepEqual(plain(p.tags),[]);});
test('MVP explicitly pending Taipei facilities cannot become positive filter evidence',()=>{const h=setup();h.facilities.data[1][3]='待查核';assert.equal(h.context.parkSearch_(25.04,121.5,'鞦韆').length,0);});
test('MVP approved formal coordinates only; valid unreviewed coordinates remain excluded',()=>{const h=setup();h.parks.data[2][13]='待定位';assert.deepEqual(plain(h.context.parkSearch_(25.041,121.5,'全部').map(x=>x.id)),['TP-1']);});
test('MVP unsupported county and invalid coordinates never enter result',()=>{const h=setup();h.parks.data[1][1]='桃園市';h.parks.data[2][5]=NaN;assert.equal(h.context.parkSearch_(25.041,121.5,'全部').length,0);});
test('MVP representative-position navigation accompanies original map link',()=>{const h=setup(),f=h.context.buildParkFlexReply_(25.041,121.5,'全部');for(const p of f.contents.contents){assert.match(p.footer.contents[0].action.uri,/maps\/search/);const nav=p.footer.contents.find(b=>b.action.label.includes('導航'));assert.ok(nav);assert.equal(new URL(nav.action.uri).pathname,'/maps/dir/');assert.ok(JSON.stringify(p).includes('代表位置'));assert.ok(!JSON.stringify(p).includes('已確認入口'));}});
test('MVP NTPC card keeps facilities unknown and no absence assertion',()=>{const h=setup(),f=h.context.buildParkFlexReply_(25.041,121.5,'全部');const card=f.contents.contents.find(p=>p.body.contents[0].text==='新北合成園');const text=JSON.stringify(card);assert.match(text,/設施.*(?:未知|未確認|未核實)/);assert.ok(!/設施：溜滑梯|無設施/.test(text));});
test('MVP menu labels communicate Taipei facility scope while preserving five choices',()=>{const h=setup(),m=h.context.buildPapaKingQuickMenu_();assert.equal(m.quickReply.items.length,5);for(const i of m.quickReply.items.slice(1,4))assert.match(i.action.label,/台北/);assert.match(m.text,/新北/);});
test('MVP empty result distinguishes incomplete location and Taipei-only facility coverage',()=>{const h=setup();h.parks.data.length=1;const text=h.context.buildParkReply_(25.04,121.5,'鞦韆');assert.match(text,/沒有符合條件/);assert.match(text,/台北/);assert.match(text,/未.*(?:審核|確認)|尚未/);});
test('MVP real LINE location flow, same snapshot Flex 400 fallback and one-shot intent',()=>{
 const h=setup(),c=h.context,sent=[];let reads=0,parking=0;const search=c.parkSearch_;c.parkSearch_=(...a)=>{reads++;return search(...a);};c.handleLocation=()=>parking++;c.postLineReply=(t,m)=>{sent.push(plain(m));return sent.length===2?400:200;};const source={type:'user',userId:'SYNTHETIC'};
 const event=message=>({type:'message',replyToken:'SYNTHETIC',source,message});
 c.doPost({postData:{contents:JSON.stringify({events:[event({type:'text',text:'附近公園'}),event({type:'location',latitude:25.0408,longitude:121.5})]})}});
 assert.equal(reads,1);assert.equal(sent[1][0].type,'flex');assert.equal(sent[2][0].type,'text');assert.match(sent[2][0].text,/台北合成園/);assert.match(sent[2][0].text,/新北合成園/);assert.match(sent[2][0].text,/maps\/dir/);assert.equal(c.takeParkIntent_(source),null);
 c.doPost({postData:{contents:JSON.stringify({events:[event({type:'location',latitude:25.0408,longitude:121.5})]})}});assert.equal(parking,1);
});
