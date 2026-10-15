"""把 /workspace/art/characters/pups/*.jpg 去底 → public/art/pups/<同名>.png（原图不动）。
用 rembg(isnet-general-use) 抠图，裁到包围盒，缩到最长边 512。
依赖：pip install "rembg[cpu]"。正式美术到位后：直接用同名透明 PNG 覆盖 public/art/pups/ 即可。"""
import glob, os
from PIL import Image
from rembg import remove, new_session
SRC = '/workspace/art/characters/pups'
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'art', 'pups')
os.makedirs(DST, exist_ok=True)
s = new_session('isnet-general-use')
for f in sorted(glob.glob(SRC + '/*.jpg')):
    out = remove(Image.open(f).convert('RGB'), session=s, alpha_matting=False, post_process_mask=True)
    a = out.getchannel('A').point(lambda v: 0 if v < 20 else v)
    out.putalpha(a)
    out = out.crop(a.getbbox())
    out.thumbnail((512, 512))
    name = os.path.splitext(os.path.basename(f))[0] + '.png'
    out.save(os.path.join(DST, name), optimize=True)
    print(name, out.size)
