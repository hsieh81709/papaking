"""R3 regression cases; only temporary copies and synthetic data."""
import importlib.util,json,os,shutil,subprocess,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image,ImageFont
ROOT=Path(__file__).resolve().parents[1]
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
planner=load('r3_planner',ROOT/'tools/apply_v9_1_lite.py')
verify=load('r3_verify',ROOT/'test/verify_lite.py')
render=load('r3_render',ROOT/'tools/render_menu.py')
class GeometryTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);shutil.copytree(ROOT/'assets',self.root/'assets');self.path=self.root/'assets/line-rich-menu/menu.json';self.menu=json.loads(self.path.read_text());self.png=self.root/'assets/line-rich-menu/menu.png'
 def reject(self,mutate):
  mutate(self.menu);self.path.write_text(json.dumps(self.menu));self.assertRaises(ValueError,verify.validate,self.root)
 def test_valid_menu(self):self.assertTrue(verify.validate(self.root))
 def test_swap_parking_park(self):
  def mutate(m):m['areas'][0]['bounds'],m['areas'][1]['bounds']=m['areas'][1]['bounds'],m['areas'][0]['bounds']
  self.reject(mutate)
 def test_swap_toilet_help(self):
  def mutate(m):m['areas'][2]['bounds'],m['areas'][3]['bounds']=m['areas'][3]['bounds'],m['areas'][2]['bounds']
  self.reject(mutate)
 def test_wrong_quadrant(self):self.reject(lambda m:m['areas'][0]['bounds'].update(x=1250,y=843))
 def test_overlap(self):self.reject(lambda m:m['areas'][0]['bounds'].update(width=1251))
 def test_overflow(self):self.reject(lambda m:m['areas'][3]['bounds'].update(width=1251))
 def test_negative(self):self.reject(lambda m:m['areas'][0]['bounds'].update(width=-1250))
 def test_zero(self):self.reject(lambda m:m['areas'][0]['bounds'].update(width=0))
 def test_boolean(self):self.reject(lambda m:m['areas'][0]['bounds'].update(x=False))
 def test_missing_area(self):self.reject(lambda m:m['areas'].pop())
 def test_wrong_action(self):self.reject(lambda m:m['areas'][0]['action'].update(text='附近公園'))
 def test_missing_png(self):self.png.unlink();self.assertRaises(ValueError,verify.validate,self.root)
 def test_corrupt_png(self):self.png.write_bytes(b'not PNG');self.assertRaises(ValueError,verify.validate,self.root)
 def test_wrong_png_dimensions(self):Image.new('RGB',(100,100)).save(self.png);self.assertRaises(ValueError,verify.validate,self.root)
 def test_oversize_png(self):self.png.write_bytes(b'x'*1_000_001);self.assertRaises(ValueError,verify.validate,self.root)
class FontTests(unittest.TestCase):
 def test_fallback_uses_resolved_font_for_every_text(self):
  real=ImageFont.truetype;calls=[]
  def font(path,*args,**kw):
   calls.append(str(path))
   if str(path).endswith('NotoSansCJK-Regular.ttc'):raise OSError('Synthetic missing preferred font')
   return real(path,*args,**kw)
  with tempfile.TemporaryDirectory() as d,patch.dict(os.environ,{'PAPAKING_CJK_FONT':''}),patch.object(ImageFont,'truetype',font):
   usable=render.render(Path(d)/'menu.png',None);self.assertTrue(usable.endswith('NotoSerifCJK-Regular.ttc'));self.assertEqual(sum(x.endswith('NotoSansCJK-Regular.ttc') for x in calls),1)
class PlannerTests(unittest.TestCase):
 def test_real_v9_output_matches_reviewed_r3_without_mutating_source(self):
  with tempfile.TemporaryDirectory() as d:
   src=Path(d)/'v9';original={}
   for rel in planner.FILES:
    p=src/rel;p.parent.mkdir(parents=True,exist_ok=True);original[rel]=subprocess.check_output(['git','show','fb069a7:'+rel],cwd=ROOT);p.write_bytes(original[rel])
   out=Path(d)/'r3';planner.plan(src,out)
   for rel in planner.FILES:
    self.assertEqual((src/rel).read_bytes(),original[rel]);self.assertEqual((out/rel).read_bytes(),(ROOT/rel).read_bytes())
 def test_real_r3_replan_is_byte_identical(self):
  with tempfile.TemporaryDirectory() as d:
   out=Path(d)/'again';planner.plan(ROOT,out)
   for rel in planner.FILES:self.assertEqual((out/rel).read_bytes(),(ROOT/rel).read_bytes())
if __name__=='__main__':unittest.main()
