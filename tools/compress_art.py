"""压缩 public/art 下的角色图：每张输出 .webp（质量 82）+ 量化 PNG（256 色，Safari 旧版兜底），都 < 200KB。
用法：python3 tools/compress_art.py   （正式美术覆盖同名 PNG 后重新运行即可）"""
import glob, os
from PIL import Image
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'art')
for f in sorted(glob.glob(root + '/*/*.png')):
    if f.endswith('.q.png'): continue
    im = Image.open(f).convert('RGBA')
    if max(im.size) > 512: im.thumbnail((512, 512))
    base = f[:-4]
    im.save(base + '.webp', 'WEBP', quality=82, method=6)
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    q.save(f, optimize=True)   # 覆盖为量化 PNG（原始高清图在 /workspace/art，不受影响）
    print(os.path.relpath(f, root), os.path.getsize(f) // 1024, 'KB png /', os.path.getsize(base + '.webp') // 1024, 'KB webp')
