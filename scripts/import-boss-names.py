#!/usr/bin/env python3
"""r16：Boss 名对照表（题库组 CSV）→ src/game/chapterBoss.gen.json
行格式与 monsterSkin.ts CHAPTER_BOSS 相同：[grade, subject, "", 章/单元原文, Boss名, 0(主色由程序分配), volume]
用法：python3 scripts/import-boss-names.py [/workspace/questions]
r17.1：15 个年级全开，大班 / 初三 / 高三 也导入；初一 / 高一加策划 r17 的按章起名表。
r17.1（初三新版 P-2）：章号相同、章名不同 → 报错退出（题库改了章序而对照表没跟上时，Boss 名会悄悄挂错章）。"""
import csv, json, sys, os, re
SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/questions'
# r17.1：+大班 v39 / 初三 v47 / 高三 v50；初二换 v48（+生物 / 地理 30 行）、高二换 v49（+物理）；
#   初一 / 高一按章起名的 37 行（策划 r17，原来退回通用名的章）放在仓库 scripts/boss-names/（以 / 开头或带目录的 = 相对仓库根，不在题库目录）
FILES = [('K2', '中班Boss名对照_v34.csv'), ('K3', '大班Boss名对照_v39.csv'), ('7', 'scripts/boss-names/初一章节Boss名_r17.csv'), ('8', '初二Boss名对照_v48.csv'),
         ('9', '初三Boss名对照_v47.csv'), ('10', '高一Boss名对照_v39.csv'), ('10', 'scripts/boss-names/高一章节Boss名_r17.csv'), ('11', '高二Boss名对照_v49.csv'), ('12', '高三Boss名对照_v50.csv')]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
def bank_qs(grade):
    with open(os.path.join(ROOT, 'public', 'banks', f'bank_{grade}.json'), encoding='utf-8') as f:
        return json.load(f)['questions']
def bank_units(grade): return {q['id']: q.get('unit') or '' for q in bank_qs(grade)}
CH = re.compile(r'^(.*?)(第[0-9一二三四五六七八九十百]+[章单元课]|Unit\s*\d+|专题\s*\d+)\s*(.*)$')
def chap(u):
    """「九上·第1章 反比例函数·1.1 …」→ ('九上·', '第1章', '反比例函数')：章号前的前缀、章号、章名（章名到下一个「·」为止）"""
    segs = u.split('·')
    for i, seg in enumerate(segs):
        m = CH.match(seg)
        if m: return ('·'.join(segs[:i]) + '·' + m.group(1)).lstrip('·').strip(), re.sub(r'\s+', ' ', m.group(2)), m.group(3).strip()
    return None
def name_clash(grade, subj, vol, ch, qs):
    """P-2：对照表这一行的章号在题库（同年级、科目、册别）里对应的章名不同 → 返回题库里的章名"""
    c = chap(ch)
    if not c or not c[2]: return None
    names = set()
    for q in qs:
        if q.get('subject') != subj or (q.get('volume') or '') != vol: continue
        b = chap(q.get('unit') or '')
        if b and b[0] == c[0] and b[1] == c[1] and b[2]: names.add(b[2])
    nb = lambda n: re.sub(r'（[^（）]*）$', '', n).strip()   # 章名末尾的括号注（「（定语从句）」）不算章名不同
    return sorted(names) if names and nb(c[2]) not in {nb(n) for n in names} else None
VOL_ONLY = re.compile(r'^(选择性必修|必修)[\d一二三四上中下]*$|^[七八九]年级[上下]册$|^[七八九][上下]$')
rows, seen, warn = [], set(), []
err = []
for grade, fn in FILES:
    qs = bank_qs(grade); units = {q['id']: q.get('unit') or '' for q in qs}
    with open(os.path.join(ROOT, fn) if '/' in fn else os.path.join(SRC, fn), encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            subj, vol, name = r['科目'].strip(), r['册别 volume'].strip(), r['Boss名'].strip()
            ch = (r.get('章/单元') or r.get('小节 unit') or '').strip()
            if not (subj and vol and ch and name): sys.exit(f'{fn}: 空字段 {r}')
            if VOL_ONLY.match(ch):
                # 对照表「章/单元」只写了册别（高二 v37 化学「选择性必修2」）：用 Boss 专用题所在的章补全，并提示题库组
                us = {units.get(i, '') for i in (r.get('Boss专用题 id') or '').split()} - {''}
                if len(us) != 1: sys.exit(f'{fn}: 「{ch}」只有册别，Boss 专用题找不到唯一的章：{us}')
                u = us.pop(); warn.append(f'{fn}: {subj} {name}：章/单元「{ch}」只有册别 → 按专用题补为「{u}」'); ch = u
            else:
                # 「章/单元」在段中间被截断（初二 v35/v36 物理引言少了「·体验科学探究）」）：专用题所在章以它开头且下一个字不是「·」→ 用专用题的章补全
                us = {units.get(i, '') for i in (r.get('Boss专用题 id') or '').split()} - {''}
                if len(us) == 1:
                    u = next(iter(us))
                    if u != ch and u.startswith(ch) and (u[len(ch)] != '·' or ch.count('（') > ch.count('）')):
                        warn.append(f'{fn}: {subj} {name}：章/单元「{ch}」被截断 → 按专用题补为「{u}」'); ch = u
            bad = name_clash(grade, subj, vol, ch, qs)
            if bad: err.append(f'{fn}: {subj} {name}：「{ch}」的章名和题库不一致（题库同章号是「{"」「".join(bad)}」）')
            k = (grade, subj, vol, ch)
            if k in seen: sys.exit(f'{fn}: 重复 {k}')
            seen.add(k); rows.append([grade, subj, '', ch, name, 0, vol])
if err: sys.exit('章号相同、章名不同（对照表和题库不是同一版？）：\n' + '\n'.join(err))
out = os.path.join(ROOT, 'src', 'game', 'chapterBoss.gen.json')
with open(out, 'w', encoding='utf-8') as f:
    f.write('[\n' + ',\n'.join(json.dumps(r, ensure_ascii=False) for r in rows) + '\n]\n')
for w in warn: print('WARN', w)
print(f'{len(rows)} rows → {os.path.normpath(out)}', {g: sum(r[0] == g for r in rows) for g in dict(FILES)})
