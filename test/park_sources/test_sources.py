import unittest,sys,csv,io,json,tempfile,subprocess,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from park_source_quality import parse_csv,match_park,feature_evidence,twd97
class CSVTests(unittest.TestCase):
 def blob(self,body='1,公園(公1),板橋區,新北市板橋區甲路1號,板橋區公所',extra=''):
  return ('seqno,name,area,address,management'+extra+'\n'+body+'\n').encode('utf-8-sig')
 def test_bom_and_count(self):self.assertEqual(len(parse_csv(self.blob())['rows']),1)
 def test_no_coords_not_invented(self):self.assertEqual(parse_csv(self.blob())['coordinateSystem'],'NOT_PROVIDED')
 def test_cp950(self):self.assertEqual(parse_csv('name,area,address\n公園,板橋區,甲路\n'.encode('cp950'))['encoding'],'cp950')
 def test_quoted_newline(self):self.assertEqual(parse_csv(b'name,area,address\n"park\nname",district,address')['rows'][0]['name'],'park\nname')
 def test_duplicate_header(self):
  with self.assertRaises(ValueError):parse_csv(b'name,area,address,name\na,b,c,d')
 def test_ragged(self):
  with self.assertRaises(ValueError):parse_csv(b'name,area,address\na,b')
 def test_partial_coords(self):
  with self.assertRaises(ValueError):parse_csv(self.blob(extra=',latitude'))
 def test_wgs_requires_declaration(self):self.assertEqual(parse_csv(self.blob(body='1,園,板橋區,甲路,公所,25,121.5',extra=',latitude,longitude'))['rows'][0]['coordinateVerified'],False)
 def test_declared_wgs(self):self.assertTrue(parse_csv(self.blob(body='1,園,板橋區,甲路,公所,25,121.5',extra=',latitude,longitude'),'EPSG:4326')['rows'][0]['coordinateVerified'])
 def test_invalid_wgs(self):self.assertFalse(parse_csv(self.blob(body='1,園,板橋區,甲路,公所,0,0',extra=',latitude,longitude'),'EPSG:4326')['rows'][0]['coordinateVerified'])
 def test_projected_ambiguous(self):self.assertEqual(parse_csv(self.blob(body='1,園,板橋區,甲路,公所,296302.789883,2765976.789602',extra=',TW97X,TW97Y'))['coordinateSystem'],'PROJECTED_CRS_UNVERIFIED')
 def test_twd97_reference(self):
  lat,lon=twd97(296302.789883,2765976.789602);self.assertAlmostEqual(lat,25.001091424328948,places=5);self.assertAlmostEqual(lon,121.45871687039443,places=5)
 def test_declared_twd97(self):self.assertTrue(parse_csv(self.blob(body='1,園,板橋區,甲路,公所,296302.789883,2765976.789602',extra=',TW97X,TW97Y'),'EPSG:3826')['rows'][0]['coordinateVerified'])
 def test_unsupported_crs(self):
  with self.assertRaises(ValueError):parse_csv(self.blob(),'EPSG:3825')
class EvidenceTests(unittest.TestCase):
 blob=CSVTests.blob
 def setUp(self):
  self.park={'公園名稱':'公園(公1)','行政區':'板橋區','地址':'甲路1號','管理單位':'板橋區公所'}
  self.rows=parse_csv(self.blob())['rows'];self.match=match_park(self.park,self.rows)
  self.page={'url':'https://www.ntparks.tw/synthetic.html','httpStatus':200,'operatorVerified':True,'termsReviewed':True,'retrievedAt':'2026-10-20T00:00:00Z','facilityDescription':'園內有溜滑梯。鞦韆。沙坑。攀爬網。戲水區。共融遊戲場。'}
 def test_identity_composite_only(self):self.assertEqual(self.match['status'],'已確認');self.assertFalse(self.rows[0]['coordinateVerified'])
 def test_name_alone_insufficient(self):self.park['地址']='別處';self.assertEqual(match_park(self.park,self.rows)['status'],'待人工審核')
 def test_district_mismatch(self):self.park['行政區']='土城區';self.assertEqual(match_park(self.park,self.rows)['status'],'無法匹配')
 def test_duplicate_identity_ambiguous(self):self.assertEqual(match_park(self.park,self.rows*2)['status'],'待人工審核')
 def test_address_disambiguates_same_name(self):self.assertEqual(match_park(self.park,self.rows+[dict(self.rows[0],address='乙路')])['status'],'已確認')
 def test_management_conflict(self):self.park['管理單位']='其他';self.assertEqual(match_park(self.park,self.rows)['status'],'待人工審核')
 def test_coordinate_conflict_requires_review(self):
  self.park.update(緯度=25,經度=121.5);self.rows[0].update(coordinateVerified=True,latitude=25.02,longitude=121.5);self.assertEqual(match_park(self.park,self.rows)['status'],'待人工審核')
 def test_six_explicit_features(self):self.assertTrue(all(r['status']=='已確認' for r in feature_evidence(self.page,self.match)))
 def test_missing_features_unknown(self):self.page['facilityDescription']='景色宜人';self.assertTrue(all(r['status']=='UNKNOWN' for r in feature_evidence(self.page,self.match)))
 def test_missing_terms_blocks(self):self.page['termsReviewed']=False;self.assertTrue(all(r['status']=='UNKNOWN' for r in feature_evidence(self.page,self.match)))
 def test_unverified_operator_blocks(self):self.page['operatorVerified']=False;self.assertTrue(all(r['status']=='UNKNOWN' for r in feature_evidence(self.page,self.match)))
 def test_name_only_blocks(self):self.match['factors']=['name'];self.assertTrue(all(r['status']=='UNKNOWN' for r in feature_evidence(self.page,self.match)))
 def test_http_error_blocks(self):self.page['httpStatus']=403;self.assertTrue(all(r['status']=='UNKNOWN' for r in feature_evidence(self.page,self.match)))
 def test_lookalike_domain_blocks(self):self.page['url']='https://ntparks.tw.example.com/x';self.assertTrue(all(r['status']=='UNKNOWN' for r in feature_evidence(self.page,self.match)))
 def test_negative_planned_nearby_unknown(self):
  self.page['facilityDescription']='沒有鞦韆。規劃溜滑梯。附近有沙坑。攀爬設施維修。預計戲水區。未設共融遊戲場。';self.assertTrue(all(r['status']=='UNKNOWN' for r in feature_evidence(self.page,self.match)))
 def test_explicit_noninclusive_and_removed_unknown(self):
  self.page['facilityDescription']='非共融遊戲場。鞦韆已移除。';self.assertTrue(all(r['status']=='UNKNOWN' for r in feature_evidence(self.page,self.match)))
 def test_presence_never_approves_position(self):self.assertTrue(all(not r['publicationApproved'] and not r['entranceVerified'] and r['count'] is None for r in feature_evidence(self.page,self.match)))
class CLITests(unittest.TestCase):
 def test_fixture_pages_and_csv_end_to_end(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp);source=p/'official.csv';source.write_bytes(CSVTests().blob());digest=hashlib.sha256(source.read_bytes()).hexdigest();snapshot=p/'snapshot.json'
   snapshot.write_text(json.dumps({'parks':[{'公園ID':'NP-1','縣市':'新北市','公園名稱':'公園(公1)','行政區':'板橋區','地址':'甲路1號','管理單位':'板橋區公所','緯度':'','經度':'','資料狀態':'待定位'}],'facilities':[]}))
   root=Path(__file__).resolve().parents[2];out=p/'output'
   subprocess.run([sys.executable,str(root/'tools/park-official-audit.py'),str(source),str(snapshot),str(out),'--website-pages',str(Path(__file__).parent/'fixtures/pages.json')],check=True,capture_output=True)
   summary=json.loads((out/'summary.json').read_text());self.assertEqual(summary['confirmedFeatureEvidenceRows'],3);self.assertEqual(summary['productionCoordinatesApproved'],0);self.assertFalse(summary['priorQualityAvailable']);self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),digest)
   with (out/'website-pages.csv').open(encoding='utf-8-sig') as f:statuses=[r['matchStatus'] for r in csv.DictReader(f)]
   self.assertEqual(statuses,['確定匹配','疑似匹配','無法匹配'])
 def test_missing_snapshot_fails_without_claiming_validation(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp);source=p/'official.csv';source.write_bytes(CSVTests().blob());root=Path(__file__).resolve().parents[2]
   result=subprocess.run([sys.executable,str(root/'tools/park-official-audit.py'),str(source),str(p/'missing.json'),str(p/'out')],capture_output=True)
   self.assertNotEqual(result.returncode,0);self.assertFalse((p/'out/summary.json').exists())
if __name__=='__main__':unittest.main(verbosity=2)
