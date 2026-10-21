#!/usr/bin/env python3
"""程序化合成《知识勇者》小班期末庆祝关（r17 / r17.1）的庆祝短乐句（自制合成，CC0，无外部采样）。
用法: python3 tools/gen_term_jingle.py            (需要 numpy + ffmpeg；写 public/sfx/ 两个文件，并登记 manifest.json / credits)
      python3 tools/gen_term_jingle.py --out DIR  (只写到 DIR，不改 public/sfx 清单)
音色: 钟琴 / 铃 / 马林巴式正弦叠加（非整数泛音 + 快速衰减），明亮大调，高处少量「闪光」；
      无铜管、无吼声、无低频冲击：最低基频 ≥ 262 Hz，整体 150 Hz 二阶高通。
响度: 对齐小班技能音效文件（skills/kindergarten/ ≈ −22.4 LUFS），TP ≤ −1.5 dBTP；mp3 单声道 44.1 kHz 96 kbps（同 skills/）。"""
import os, sys, json, csv, subprocess, re, numpy as np
SR = 44100; TARGET_LUFS = -22.4; TP_MAX = -1.5
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(17)
N = lambda name, oct_: 440.0 * 2 ** ((('C C# D D# E F F# G G# A A# B'.split().index(name)) - 9) / 12 + (oct_ - 4))

def fft_filter(x, lo=None, hi=None, order=2):
    """零相位频域滤波：lo = 高通角频率，hi = 低通角频率（Butterworth 幅度响应）"""
    n = len(x); X = np.fft.rfft(x, 2 * n); f = np.fft.rfftfreq(2 * n, 1 / SR); H = np.ones_like(f)
    if lo: H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** (2 * order))
    if hi: H *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    return np.fft.irfft(X * H)[:n]

def partial_tone(f, dur, partials, attack=0.010):
    """partials: [(倍数, 幅度, 衰减时间常数 s)]；软起音（attack 用 sin² 渐入，不咔哒）"""
    n = int(dur * SR); tt = np.arange(n) / SR; y = np.zeros(n)
    for m, a, tau in partials:
        if f * m > 16000: continue
        y += a * np.sin(2 * np.pi * f * m * tt + rng.uniform(0, 2 * np.pi)) * np.exp(-tt / tau)
    na = max(1, int(attack * SR)); y[:na] *= np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    nr = max(1, int(0.3 * n)); y[-nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2   # 每个音尾部平滑收到 0（不截断、不咔哒）
    return y

GLOCK = [(1, 1.0, 0.9), (2.76, 0.30, 0.25), (5.40, 0.12, 0.10), (8.93, 0.05, 0.05)]   # 钟琴：非整数泛音
BELL  = [(1, 1.0, 1.4), (2.0, 0.25, 0.6), (3.01, 0.12, 0.35), (4.17, 0.06, 0.2)]       # 柔和小铃
MARIMBA = [(1, 1.0, 0.45), (3.93, 0.22, 0.08), (9.2, 0.05, 0.03)]                      # 马林巴式：木质、短

def sparkle(dur, start_f=5000, count=10, spread=0.9):
    """高处闪光：几颗很短很轻的高频铃点（> 3 kHz），随机落在 spread 秒内"""
    n = int(dur * SR); y = np.zeros(n)
    for _ in range(count):
        t0 = rng.uniform(0, spread); f = start_f * 2 ** rng.uniform(0, 1.0)
        s = partial_tone(f, 0.25, [(1, 1.0, 0.07), (2.0, 0.2, 0.04)], attack=0.004) * rng.uniform(0.25, 0.6)
        i = int(t0 * SR); y[i:i + len(s)] += s[:n - i]
    return y

def room(x, wet=0.12, rt=0.55):
    """小房间混响：指数衰减的高通噪声脉冲响应（卷积，频域）"""
    n = int(rt * SR); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (rt / 6.9)); ir = fft_filter(ir, lo=400, hi=7000)
    ir /= np.sqrt((ir ** 2).sum()) + 1e-12
    L = len(x) + n; w = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L))[:len(x)]
    return x + wet * w * (np.abs(x).max() / (np.abs(w).max() + 1e-12))

def place(buf, sig, t0, gain=1.0):
    i = int(t0 * SR); assert i + len(sig) <= len(buf), 'tone would be cut by buffer end'; buf[i:i + len(sig)] += gain * sig

def finish(y, dur):
    y = room(y[:int(dur * SR)]); y = fft_filter(y, lo=150, order=2)          # 小房间混响 → 150 Hz 二阶高通
    nf = int(0.6 * SR); y[-nf:] *= np.cos(np.linspace(0, np.pi / 2, nf)) ** 2    # 尾部自然收尾到 0
    na = int(0.006 * SR); y[:na] *= np.linspace(0, 1, na)
    return y / (np.abs(y).max() + 1e-9) * 0.5

def jingle_primary():
    """主版「星星铃」：C 大调，钟琴上行琶音 C5-E5-G5-C6 → 马林巴 C-E-G 和弦垫底 → 高处 E6/G6 小铃长鸣 + 闪光（≈4.0 s）"""
    D = 4.6; y = np.zeros(int(D * SR)); bt = 0.16
    for i, (nm, o) in enumerate([('C', 5), ('E', 5), ('G', 5), ('C', 6)]):
        place(y, partial_tone(N(nm, o), 1.4, GLOCK), 0.05 + i * bt, 0.55 + 0.08 * i)
    place(y, partial_tone(N('D', 6), 0.9, GLOCK), 0.05 + 4 * bt, 0.4); place(y, partial_tone(N('E', 6), 1.6, GLOCK), 0.05 + 5 * bt, 0.6)
    t1 = 0.05 + 6.2 * bt
    for nm, o, g in [('C', 5, .32), ('E', 5, .28), ('G', 5, .26)]:
        place(y, partial_tone(N(nm, o), 1.2, MARIMBA, attack=0.006), t1, g)
    place(y, partial_tone(N('G', 6), 2.6, BELL, attack=0.012), t1 + 0.02, 0.42)
    place(y, partial_tone(N('C', 7), 2.4, BELL, attack=0.015), t1 + 0.20, 0.28)
    place(y, sparkle(1.6, 4800, 12, 1.2), t1 + 0.05, 0.22)
    return finish(y, 4.1)

def jingle_alt():
    """备选「跳跳马林巴」：F 大调，马林巴轻快跳音 F5 A5 C6 A5 | C6 F6，钟琴叠一层，结尾 F 大三和弦铃声 + 闪光（≈3.6 s）"""
    D = 4.2; y = np.zeros(int(D * SR)); bt = 0.14
    seq = [('F', 5), ('A', 5), ('C', 6), ('A', 5), ('C', 6), ('F', 6)]
    for i, (nm, o) in enumerate(seq):
        tt = 0.05 + i * bt + (0.05 if i >= 4 else 0)
        place(y, partial_tone(N(nm, o), 0.8, MARIMBA, attack=0.005), tt, 0.6)
        place(y, partial_tone(N(nm, o) * 2, 0.9, GLOCK, attack=0.008), tt + 0.01, 0.16)
    t1 = 0.05 + 6 * bt + 0.12
    for nm, o, g in [('F', 5, .30), ('A', 5, .26), ('C', 6, .26), ('F', 6, .34)]:
        place(y, partial_tone(N(nm, o), 2.4, BELL, attack=0.014), t1, g)
    place(y, sparkle(1.4, 5200, 9, 1.0), t1 + 0.08, 0.2)
    return finish(y, 3.7)

def measure(path):
    e = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = e[e.rindex('Summary:'):]; return float(re.search(r'I:\s+(-?[\d.]+)', s).group(1)), float(re.search(r'Peak:\s+(-?[\d.]+)', s).group(1))

def encode(y, path):
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '96k', path], input=pcm, check=True)

def render(y, path):
    g = 1.0
    for _ in range(4):
        encode(y * g, path); I, tp = measure(path)
        if abs(I - TARGET_LUFS) < 0.15 and tp <= TP_MAX: break
        g *= 10 ** ((TARGET_LUFS - I) / 20)
        if tp + 20 * np.log10(10 ** ((TARGET_LUFS - I) / 20)) > TP_MAX: g *= 10 ** ((TP_MAX - 0.3 - (tp + TARGET_LUFS - I)) / 20)
    return measure(path)

JINGLES = [('sfx_k_term_celebrate.mp3', jingle_primary, '主版「星星铃」：C 大调钟琴上行琶音 + 马林巴和弦 + 高音小铃长鸣 + 闪光'),
           ('sfx_k_term_celebrate_alt.mp3', jingle_alt, '备选「跳跳马林巴」：F 大调马林巴跳音 + 钟琴叠层 + F 大三和弦铃声 + 闪光')]

if __name__ == '__main__':
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(ROOT, 'public/sfx')
    rows = []
    for fn, fnc, brief in JINGLES:
        p = os.path.join(out, fn); I, tp = render(fnc(), p)
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout)
        rows.append([fn, 'k_term_celebrate', 'k', '小班期末庆祝关（上/下学期）', brief, 'tools/gen_term_jingle.py（程序化合成，无外部素材）', '知识勇者 音频设计（Grok Bot 程序化合成）', '自制合成 CC0 1.0 (CC0-1.0)', f'{dur:.3f}', I, tp])
        print(fn, f'dur={dur:.3f}', f'I={I}', f'TP={tp}')
    if '--out' in sys.argv: sys.exit(0)
    mp = os.path.join(out, 'manifest.json'); m = json.load(open(mp)); have = set(m['sfx'])
    for fn, _, _ in JINGLES:
        if fn not in have: m['sfx'].append(fn)
    json.dump(m, open(mp, 'w'), ensure_ascii=False, indent=1)
    cp = os.path.join(out, 'credits.csv'); hdr = ['file', 'sfx_id', 'stage', 'use', 'sfx_brief', 'source_url', 'author', 'license', 'duration_s', 'integrated_lufs', 'true_peak_dbtp']
    old = [r for r in (list(csv.reader(open(cp, encoding='utf-8')))[1:] if os.path.exists(cp) else []) if r and r[0] not in {j[0] for j in JINGLES}]
    with open(cp, 'w', encoding='utf-8', newline='') as f: w = csv.writer(f); w.writerow(hdr); w.writerows(old + rows)
    cm = os.path.join(out, 'CREDITS.md')
    if not os.path.exists(cm):
        open(cm, 'w', encoding='utf-8').write('# 音效（public/sfx/ 顶层）授权说明\n\n'
            '技能音效见 `skills/CREDITS.md`。本目录顶层的音效：\n\n'
            '- `sfx_k_term_celebrate.mp3`（主版）、`sfx_k_term_celebrate_alt.mp3`（备选）：小班期末庆祝关（r17 / r17.1）庆祝短乐句。\n'
            '  由 `tools/gen_term_jingle.py` 用 numpy 正弦叠加（钟琴 / 铃 / 马林巴式音色）程序化合成、ffmpeg(libmp3lame) 编码，**未使用任何外部采样或素材库**。\n'
            '- 作者：知识勇者项目 音频设计（Grok Bot 程序化合成）\n'
            '- 授权：CC0 1.0 公共领域贡献 https://creativecommons.org/publicdomain/zero/1.0/\n'
            '- 逐文件明细（时长、响度）：`credits.csv`\n'
            '- 重新生成：`python3 tools/gen_term_jingle.py`（需 numpy、ffmpeg）\n')
