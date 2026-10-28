#!/usr/bin/env python3
"""Deterministic 2x2 Rich Menu draft renderer; requires Pillow and CJK font."""
import argparse
import os
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

def render(destination,font_path):
    candidates=[font_path,os.environ.get('PAPAKING_CJK_FONT'),'/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc']
    usable=None
    for candidate in candidates:
        if not candidate:continue
        try:
            ImageFont.truetype(candidate,110)
            usable=candidate
            break
        except OSError:
            continue
    if not usable:
        raise RuntimeError('No CJK font available; use --font /path/to/installed/CJK-font')
    f=ImageFont.truetype(usable,110)
    small=ImageFont.truetype(usable,56)
    im=Image.new('RGB',(2500,1686),'#F7FAFC');d=ImageDraw.Draw(im)
    items=[('附近停車','#1976D2','P'),('附近公園','#227A4C','樹'),('附近公廁','#00838F','WC'),('使用說明','#546578','?')]
    for i,(label,color,symbol) in enumerate(items):
        x=(i%2)*1250;y=(i//2)*843
        d.rounded_rectangle((x+26,y+26,x+1224,y+817),radius=54,fill='white',outline=color,width=10)
        cx=x+625;cy=y+300
        d.ellipse((cx-125,cy-125,cx+125,cy+125),fill=color)
        sf=ImageFont.truetype(usable,110 if len(symbol)==1 else 80)
        bb=d.textbbox((0,0),symbol,font=sf)
        d.text((cx-(bb[2]-bb[0])/2,cy-(bb[3]-bb[1])/2-bb[1]),symbol,font=sf,fill='white')
        bb=d.textbbox((0,0),label,font=f)
        d.text((cx-(bb[2]-bb[0])/2,y+510),label,font=f,fill=color)
        d.text((cx-110,y+680),'PapaKing',font=small,fill='#7C8794')
    destination.parent.mkdir(parents=True,exist_ok=True)
    im.save(destination,format='PNG',optimize=True)
    return usable

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--font');p.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'assets/line-rich-menu/menu.png');a=p.parse_args()
    print('Font:',render(a.output,a.font));print('Saved:',a.output)
