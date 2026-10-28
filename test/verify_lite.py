#!/usr/bin/env python3
"""Strict offline menu/image validator; nonzero exit on all failures."""
import argparse
import json
from pathlib import Path
import sys
from PIL import Image, UnidentifiedImageError

QUADRANTS=[(0,0,1250,843),(1250,0,1250,843),(0,843,1250,843),(1250,843,1250,843)]
EXPECTED=[('附近停車','停車查詢'),('附近公園','附近公園'),('附近公廁','附近公廁'),('使用說明','使用說明')]

def require(ok, message):
    if not ok:
        raise ValueError(message)

def validate(root):
    menu=json.loads((root/'assets/line-rich-menu/menu.json').read_text(encoding='utf-8'))
    size=menu['size']; w=size['width']; h=size['height']
    require(type(w) is int and type(h) is int and (w,h)==(2500,1686),'Invalid canvas dimensions')
    areas=menu['areas']
    require(len(areas)==4,'Expected four areas')
    rects=[]
    for index,(area,(label,command)) in enumerate(zip(areas,EXPECTED)):
        b=area['bounds']; action=area['action']
        vals=[b[k] for k in ('x','y','width','height')]
        require(all(type(v) is int for v in vals),'Noninteger or boolean bounds')
        require(tuple(vals)==QUADRANTS[index], 'Action does not match fixed quadrant '+str(index))
        x,y,bw,bh=vals
        require(0<=x<w and 0<=y<h and bw>0 and bh>0 and x+bw<=w and y+bh<=h,'Out-of-bounds/negative rectangle')
        require(action=={'type':'message','label':label,'text':command},'Wrong action '+str(index))
        rects.append((x,y,x+bw,y+bh))
    for i,a in enumerate(rects):
        for b in rects[i+1:]:
            require(not (max(a[0],b[0])<min(a[2],b[2]) and max(a[1],b[1])<min(a[3],b[3])),'Overlapping rectangles')
    require(sum((a[2]-a[0])*(a[3]-a[1]) for a in rects)==w*h,'Incomplete canvas coverage')
    image_path=root/'assets/line-rich-menu/menu.png'
    require(image_path.is_file(),'PNG image missing')
    require(0<image_path.stat().st_size<=1_000_000,'Image exceeds provisional 1MB cap')
    try:
        with Image.open(image_path) as image:
            require(image.format=='PNG' and image.size==(w,h),'PNG format/dimensions mismatch')
            image.verify()
    except (UnidentifiedImageError,OSError) as exc:
        raise ValueError('Image cannot be decoded') from exc
    return True

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);args=parser.parse_args()
    try:
        validate(args.root)
        print('PASS: strict geometry, four actions, decoded PNG')
    except (ValueError,KeyError,TypeError,OSError) as exc:
        print('FAIL:',exc,file=sys.stderr);sys.exit(1)
