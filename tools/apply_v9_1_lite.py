#!/usr/bin/env python3
"""Offline, fail-closed V9.1 Lite patch planner. Never mutates source files."""
import argparse
import difflib
import hashlib
import json
from pathlib import Path
import re
import sys

POLICY = '公廁提供雙北符合發布條件的資料，部分位置尚未完成逐筆人工驗證；實際入口及開放狀況請依現場資訊確認。'
FILES = ('gas/line_webhook_gas.js', 'gas/park_search_gas.js', 'gas/facility_line_gas.js')
HELP = """\n/** V9.1 Lite: help does not alter current search intent. */
function buildPapaKingHelp_() {
  return 'PapaKing 使用說明\\n'
    + '1. 點選附近停車、附近公園或附近公廁。\\n'
    + '2. 點選「分享位置」並允許 LINE 傳送位置。\\n'
    + '3. 查看附近結果，點選地圖或導航按鈕。\\n'
    + '停車搜尋範圍為 1 公里；公園與公廁為 3 公里。\\n'
    + '分類有效 10 分鐘，每次搜尋後請重新選擇。\\n'
    + '部分設施位置尚未人工驗證，入口與開放資訊以現場為準。';
}
"""

OLD_HELP = HELP
HELP = HELP.replace('部分設施位置尚未人工驗證，入口與開放資訊以現場為準。', POLICY)

class PatchError(Exception):
    pass

def one_replace(text, before, after, rel):
    if text.count(after) == 1 and text.count(before) == 0:
        return text
    if text.count(before) != 1 or text.count(after) != 0:
        raise PatchError(f'{rel}: expected exactly one unmodified anchor: {before[:90]!r}')
    return text.replace(before, after, 1)

def transform(rel, text):
    if rel.endswith('line_webhook_gas.js'):
        text = one_replace(text, "text: String(card.kind || '附近地點'), color: '#FFFFFF'", "text: '🅿️ ' + String(card.kind || '附近地點'), color: '#FFFFFF'", rel)
        known = ('公廁提供雙北（臺北／新北）已核准資料。','公廁目前提供新北已核准資料。')
        matches = sum(text.count(value) for value in known)
        if matches == 1 and POLICY not in text:
            text = text.replace(next(value for value in known if value in text), POLICY, 1)
        elif matches != 0 or text.count(POLICY) != 1:
            raise PatchError('line_webhook_gas.js: unknown or duplicated toilet policy')
    elif rel.endswith('park_search_gas.js'):
        text = one_replace(text, "text: p.name || '未命名公園', weight: 'bold'", "text: '🌳 ' + (p.name || '未命名公園'), weight: 'bold'", rel)
    else:
        old = "if (/^(選單|功能選單|公園選單|主選單|menu)$/i.test(text)) {"
        new = "if (text === '使用說明') {\n        message = buildPapaKingHelp_();\n      } else " + old
        # New branch contains old as substring: check new first.
        if new in text:
            if text.count(new) != 1:
                raise PatchError('facility_line_gas.js: duplicated help branch')
        else:
            text = one_replace(text, old, new, rel)
        text = one_replace(text, "text:String(p.name).slice(0,60),weight:'bold'", "text:'🚻 ' + String(p.name).slice(0,60),weight:'bold'", rel)
        if '公廁提供新北已核准資料。' in text:
            text = one_replace(text, '公廁提供新北已核准資料。', '公廁提供雙北已發布資料，部分位置尚未經人工驗證。', rel)
        if text.count('function buildPapaKingHelp_()') == 0:
            text += '\n' + HELP
        elif text.count('function buildPapaKingHelp_()') == 1 and OLD_HELP.strip() in text:
            text = text.replace(OLD_HELP.strip(), HELP.strip(), 1)
        elif text.count('function buildPapaKingHelp_()') != 1 or HELP.strip() not in text:
            raise PatchError('facility_line_gas.js: unknown help function already exists')
    return text

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def plan(source, output):
    if output == source or source in output.parents or output in source.parents:
        raise PatchError('Output must be a separate directory outside source tree')
    original = {}
    generated = {}
    for rel in FILES:
        path = source / rel
        if not path.is_file():
            raise PatchError('Missing source: ' + str(path))
        raw = path.read_bytes()
        try:
            text = raw.decode('utf-8')
        except UnicodeError as exc:
            raise PatchError(f'{rel}: not UTF-8') from exc
        modified = transform(rel, text)
        # Re-running transformation on every generated result must be byte-identical.
        if transform(rel, modified) != modified:
            raise PatchError(f'{rel}: non-idempotent transform')
        original[rel] = raw
        generated[rel] = modified.encode('utf-8')
    if output.exists() and any(output.iterdir()):
        raise PatchError('Output directory must be empty (no overwrite): ' + str(output))
    output.mkdir(parents=True, exist_ok=True)
    receipt = {'mode':'offline-output-only', 'files':{}}
    for rel in FILES:
        dest = output / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(generated[rel])
        receipt['files'][rel] = {'before_sha256':digest(original[rel]), 'after_sha256':digest(generated[rel]), 'changed':original[rel]!=generated[rel]}
        diff = ''.join(difflib.unified_diff(original[rel].decode().splitlines(True), generated[rel].decode().splitlines(True), fromfile='a/'+rel,tofile='b/'+rel))
        patch = output / 'patches' / (Path(rel).name + '.diff')
        patch.parent.mkdir(parents=True,exist_ok=True)
        patch.write_text(diff,encoding='utf-8')
    (output / 'RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return receipt

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    try:
        receipt=plan(args.source.resolve(),args.output.resolve())
    except (PatchError, OSError) as exc:
        print('FAIL:',exc,file=sys.stderr)
        return 1
    print(json.dumps(receipt,ensure_ascii=False,indent=2))
    return 0

if __name__=='__main__':
    sys.exit(main())
