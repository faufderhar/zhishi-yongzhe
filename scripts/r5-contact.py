"""把 r5-check 的技能图集截图拼成联系表。用法: python3 scripts/r5-contact.py <dir>"""
import sys, json, os
from PIL import Image, ImageDraw, ImageFont
d = sys.argv[1]; ids = json.load(open('/tmp/r5-gallery.json'))
names = json.load(open('public/fx/skills/manifest.json'))['skills']
procs = [f for f in sorted(os.listdir(d)) if f.startswith('r5-proc-')]
items = [(f'r5-gal-{i}.png', f"{i} · {names[i]['name']}") for i in ids] + [(f, f[8:-4] + ' · 程序化回退') for f in procs]
W, H, C = 400, 260, 4; rows = (len(items) + C - 1) // C
sheet = Image.new('RGB', (W * C, (H + 28) * rows), (24, 26, 40)); dr = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 18)
except Exception: font = ImageFont.load_default()
for k, (f, t) in enumerate(items):
    im = Image.open(os.path.join(d, f)).convert('RGB'); im.thumbnail((W, H))
    x, y = (k % C) * W, (k // C) * (H + 28); sheet.paste(im, (x + (W - im.width) // 2, y)); dr.text((x + 8, y + H + 3), t, fill=(240, 240, 240), font=font)
sheet.save(os.path.join(d, 'r5-skill-gallery.png')); print('ok', len(items))
