#!/usr/bin/env python3
"""r15.4.4：把已发布的题库（/workspace/questions，只读）导入游戏 public/banks/。
以前是把 题库_<年级>.json 原样复制成 bank_<g>.json；r15.4.4 起（总管）「需家长确认」的题不进游戏题库：导入时去掉，
并和 需家长确认清单_vNN.csv 核对（清单里仍待确认的题一个都不能留下）。其余字段、顺序、格式不变（indent=1，和源文件同格式）。
用法：python3 scripts/import-bank.py [--src /workspace/questions]"""
import argparse, csv, glob, json, os, sys
GR = {'K1': '幼儿园小班', 'K2': '幼儿园中班', '1': '1年级', '2': '2年级', '3': '3年级', '4': '4年级', '5': '5年级', '6': '6年级', '7': '初一', '8': '初二', '10': '高一', '11': '高二'}   # r16：+中班 K2、初二 8、高二 11；大班 K3 / 初三 9 / 高三 12 是 r17
PENDING = '需家长确认'
ap = argparse.ArgumentParser(); ap.add_argument('--src', default='/workspace/questions'); ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'public', 'banks'))
a = ap.parse_args()
ver = open(os.path.join(a.src, 'src', 'VERSION'), encoding='utf-8').read().strip()
lst = os.path.join(a.src, f'需家长确认清单_{ver}.csv')
if not os.path.exists(lst):   # 本版没有新标需家长确认的题时沿用上一版清单（v33 README：清单仍是 需家长确认清单_v32.csv）
    vn = lambda f: int(''.join(c for c in os.path.basename(f).split('_v')[-1] if c.isdigit()) or 0)
    old = sorted((f for f in glob.glob(os.path.join(a.src, '需家长确认清单_v*.csv')) if vn(f) <= int(ver.lstrip('v'))), key=vn)
    if old: lst = old[-1]
print(f'需家长确认清单：{os.path.basename(lst)}', file=sys.stderr)
listed = set()
if os.path.exists(lst):
    for r in csv.DictReader(open(lst, encoding='utf-8-sig')):
        if (r.get('是否仍待确认') or '是').startswith('是'): listed.add(r['id'])
else: print(f'注意：没有 {lst}，只按 status 去掉', file=sys.stderr)
tot_ex, rows = 0, []
for g, name in GR.items():
    d = json.load(open(os.path.join(a.src, f'题库_{name}.json'), encoding='utf-8'))
    if str(d.get('version')) != ver: sys.exit(f'{name}: version {d.get("version")} ≠ {ver}')
    qs = d['questions']; ex = [q['id'] for q in qs if q.get('status') == PENDING or q['id'] in listed]
    d['questions'] = [q for q in qs if q['id'] not in set(ex)]
    left = [q['id'] for q in d['questions'] if q.get('status') == PENDING or q['id'] in listed]
    assert not left, left
    open(os.path.join(a.out, f'bank_{g}.json'), 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))
    tot_ex += len(ex); rows.append((g, len(qs), len(d['questions']), ex))
# r16（总管）：大班 K3 / 初三 9 / 高三 12 在 r17 才接入游戏——这里不导入，清单里属于没导入年级的题也不算「找不到」
known = {f'题库_{n}.json' for n in GR.values()}
skipped = sorted(os.path.basename(f) for f in glob.glob(os.path.join(a.src, '题库_*.json')) if not os.path.basename(f).startswith('题库_游戏可用_') and os.path.basename(f) not in known)
skip_ids = set()
for f in skipped:
    sq = json.load(open(os.path.join(a.src, f), encoding='utf-8'))['questions']; skip_ids |= {q['id'] for q in sq}
    print(f'不导入 {f}（{len(sq)} 题，r17 接入）', file=sys.stderr)
listed -= skip_ids
miss = listed - {i for r in rows for i in r[3]}
if miss: sys.exit(f'清单里的题在题库里找不到：{sorted(miss)}')
for g, n0, n1, ex in rows: print(f'bank_{g}.json {ver}: {n0} 题 → 导入 {n1}（去掉需家长确认 {len(ex)}{"：" + ",".join(ex) if ex else ""}）')
print(f'合计去掉需家长确认 {tot_ex} 题（清单里属于导入年级的 {len(listed)} 题）')
extra = sorted(set(os.listdir(a.out)) - {f'bank_{g}.json' for g in GR} - {'release.json'})
if extra: sys.exit(f'public/banks 里有不该有的文件：{extra}')
