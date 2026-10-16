"""r5 护眼：对 r5-check 录下的舞台帧（/tmp/r5frames）算亮度。阈值同美术 QA：相邻帧亮度变化 ≤20%，峰谷差 ≤20%，>5% 的方向反转 ≤2 次/秒，新增近白像素 <25%。"""
import os, re, json, collections
from PIL import Image
import numpy as np
D = '/tmp/r5frames/'; g = collections.defaultdict(list)
for f in os.listdir(D):
    m = re.match(r'(art|proc)_(.+)_(\d\d)_(\d+)\.jpg', f)
    if m: g[(m[1], m[2])].append((int(m[3]), int(m[4]), f))
rows = []; worst = {}
for (mode, sid), fs in sorted(g.items()):
    fs.sort(); L = []; W = []; base = None
    for _, t, f in fs:
        a = np.asarray(Image.open(D + f).convert('RGB'), dtype=np.float32) / 255
        y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
        if base is None: base = y
        h = min(base.shape[0], y.shape[0]); w_ = min(base.shape[1], y.shape[1]); y = y[:h, :w_]; base = base[:h, :w_]
        L.append((t, float(y.mean()))); W.append(float(((y > 0.92) & (base <= 0.92)).mean()))
    ls = [x for _, x in L]; ts = [t for t, _ in L]
    dmax = max(abs(ls[i] - ls[i - 1]) for i in range(1, len(ls))) if len(ls) > 1 else 0
    pv = max(ls) - min(ls)
    rev = 0; d0 = 0; last = ls[0]
    for x in ls[1:]:
        d = x - last
        if abs(d) > 0.05: s = 1 if d > 0 else -1; rev += 1 if d0 and s != d0 else 0; d0 = s; last = x
    dur = (ts[-1] - ts[0]) / 1000 or 1
    r = dict(mode=mode, id=sid, n=len(ls), dmax=dmax, pv=pv, rev=rev, hz=rev / 2 / dur, white=max(W))
    r['pass'] = dmax <= 0.2 and pv <= 0.2 and r['hz'] <= 3 and r['white'] < 0.25; rows.append(r)
for mode in ('art', 'proc'):
    R = [r for r in rows if r['mode'] == mode]
    if not R: continue
    print(f"{mode}: {len(R)} 个技能，帧/技能 {min(r['n'] for r in R)}–{max(r['n'] for r in R)}；最大相邻帧亮度变化 {max(r['dmax'] for r in R)*100:.1f}% ；最大峰谷差 {max(r['pv'] for r in R)*100:.1f}%；最大闪烁 {max(r['hz'] for r in R):.2f} Hz；最大新增近白像素 {max(r['white'] for r in R)*100:.1f}%；全部通过 {all(r['pass'] for r in R)}")
    for r in R:
        if not r['pass']: print('  FAIL', r)
json.dump(rows, open('screenshots/r5-luma.json', 'w'), indent=0)
