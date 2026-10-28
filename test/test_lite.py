import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
patch=load('patch',ROOT/'tools/apply_v9_1_lite.py')
verify=load('verify',ROOT/'test/verify_lite.py')

SOURCES={
 'gas/line_webhook_gas.js':"text: String(card.kind || '附近地點'), color: '#FFFFFF'\n公廁提供雙北（臺北／新北）已核准資料。\n",
 'gas/park_search_gas.js':"text: p.name || '未命名公園', weight: 'bold'\n",
 'gas/facility_line_gas.js':"if (/^(選單|功能選單|公園選單|主選單|menu)$/i.test(text)) {\n}\ntext:String(p.name).slice(0,60),weight:'bold'\n",
}
class LiteTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.source=self.root/'src';self.source.mkdir()
        for rel,content in SOURCES.items():
            path=self.source/rel;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content,encoding='utf-8')
    def test_source_unmodified_and_idempotent(self):
        out=self.root/'out';before={p:p.read_bytes() for p in self.source.rglob('*.js')}
        patch.plan(self.source,out)
        self.assertEqual(before,{p:p.read_bytes() for p in self.source.rglob('*.js')})
        out2=self.root/'out2';patch.plan(out,out2)
        for rel in SOURCES:self.assertEqual((out/rel).read_bytes(),(out2/rel).read_bytes())
        self.assertEqual((out/'gas/facility_line_gas.js').read_text().count("if (text === '使用說明')"),1)
    def test_mismatch_does_not_write_output(self):
        (self.source/'gas/facility_line_gas.js').write_text('incompatible',encoding='utf-8')
        out=self.root/'out'
        with self.assertRaises(patch.PatchError):patch.plan(self.source,out)
        self.assertFalse(out.exists())
    def test_existing_output_refused(self):
        out=self.root/'out';out.mkdir();(out/'keep').write_text('x')
        with self.assertRaises(patch.PatchError):patch.plan(self.source,out)
        self.assertEqual((out/'keep').read_text(),'x')
    def test_geometry_negative_and_missing_png(self):
        dest=self.root/'kit';shutil.copytree(ROOT/'assets',dest/'assets')
        verify.validate(dest)
        p=dest/'assets/line-rich-menu/menu.json';data=json.loads(p.read_text())
        for area in data['areas']:
            area['bounds'].update({'x':0,'y':0,'width':-1250,'height':-843})
        p.write_text(json.dumps(data))
        with self.assertRaises(ValueError):verify.validate(dest)
        shutil.copy2(ROOT/'assets/line-rich-menu/menu.json',p)
        (dest/'assets/line-rich-menu/menu.png').unlink()
        with self.assertRaises(ValueError):verify.validate(dest)

if __name__=='__main__':unittest.main()
