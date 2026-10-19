import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,fixture} from './helpers.mjs';
const ids=['NP-9','NP-12','NP-112','NP-333'];
function setup() {
 const h=harness(),{rs}=fixture(h,ids);
 rs.data.slice(1).forEach(row=>{row[7]='需要修正';row[11]='';row[12]='';row[13]='';row[14]='';});
 let calls=0;
 h.context.Maps={newGeocoder:()=>({setLanguage(){return this;},setRegion(){return this;},geocode(query){calls++;
  const district=query.includes('土城區')?'土城區':query.includes('板橋區')?'板橋區':'八里區';
  return {status:'OK',results:[{formatted_address:'新北市'+district,geometry:{location:{lat:25.01,lng:121.46},location_type:'GEOMETRIC_CENTER'}}]};
 }})};
 return {h,rs,calls:()=>calls};
}
test('duplicate ID is detected before any geocoding or writes',()=>{
 const {h,rs,calls}=setup();rs.data.push([...rs.data[1]]);
 assert.throws(()=>h.context.runPapaKingParkB43Regeocode('確認寫入待審候選'),/ID 重複/);assert.equal(calls(),0);assert.equal(h.events.length,0);
});
test('default re-geocoding is preview, never candidate or production writes',()=>{
 const {h,calls}=setup();assert.equal(h.context.runPapaKingParkB43Regeocode().length,4);assert.equal(calls(),4);assert.equal(h.events.length,0);
});
test('confirmed reviews, partial coordinates, source/acceptance metadata are protected',()=>{
 const {h,rs,calls}=setup();rs.data[1][14]='已確認';rs.data[2][11]=25.01;rs.data[3][13]='人工來源';rs.data[4][7]='核准';
 assert.equal(h.context.runPapaKingParkB43Regeocode('確認寫入待審候選').length,0);assert.equal(calls(),0);assert.equal(h.events.length,0);
});
test('explicit candidate write only writes L:O as pending; no official changes',()=>{
 const {h}=setup();h.context.runPapaKingParkB43Regeocode('確認寫入待審候選');
 const writes=h.events.filter(e=>e.type==='write');assert.equal(writes.length,16);
 assert.ok(writes.every(e=>e.sheet==='公園座標品質檢核'&&e.col>=12&&e.col<=15));
 assert.ok(h.sheets.get('公園座標品質檢核').data.slice(1).every(r=>r[14]==='待人工確認'));
});
test('wrong city and null geocoder coordinates are rejected',()=>{
 const {h}=setup();h.context.Maps.newGeocoder=()=>({setLanguage(){return this;},setRegion(){return this;},geocode:()=>({status:'OK',results:[{formatted_address:'台北市八里區',geometry:{location:{lat:null,lng:121.46}}}]})});
 assert.equal(h.context.runPapaKingParkB43Regeocode('確認寫入待審候選').length,0);assert.equal(h.events.length,0);
});
