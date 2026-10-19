#!/usr/bin/env python3
"""r16：Boss 名对照表（题库组 CSV）→ src/game/chapterBoss.gen.json
行格式与 monsterSkin.ts CHAPTER_BOSS 相同：[grade, subject, "", 章/单元原文, Boss名, 0(主色由程序分配), volume]
用法：python3 scripts/import-boss-names.py [/workspace/questions]
只导入已开放年级（中班 / 高一 / 初二 / 高二）；大班 / 初三 / 高三 留到 r17。"""
import csv, json, sys, os, re
SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/questions'
FILES = [('K2', '中班Boss名对照_v34.csv'), ('8', '初二Boss名对照_v36.csv'), ('10', '高一Boss名对照_v39.csv'), ('11', '高二Boss名对照_v37.csv')]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
def bank_units(grade):
    with open(os.path.join(ROOT, 'public', 'banks', f'bank_{grade}.json'), encoding='utf-8') as f:
        return {q['id']: q.get('unit') or '' for q in json.load(f)['questions']}
VOL_ONLY = re.compile(r'^(选择性必修|必修)[\d一二三四上中下]*$|^[七八九]年级[上下]册$|^[七八九][上下]$')
rows, seen, warn = [], set(), []
for grade, fn in FILES:
    units = bank_units(grade)
    with open(os.path.join(SRC, fn), encoding='utf-8-sig') as f:
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
            k = (grade, subj, vol, ch)
            if k in seen: sys.exit(f'{fn}: 重复 {k}')
            seen.add(k); rows.append([grade, subj, '', ch, name, 0, vol])
out = os.path.join(ROOT, 'src', 'game', 'chapterBoss.gen.json')
with open(out, 'w', encoding='utf-8') as f:
    f.write('[\n' + ',\n'.join(json.dumps(r, ensure_ascii=False) for r in rows) + '\n]\n')
for w in warn: print('WARN', w)
print(f'{len(rows)} rows → {os.path.normpath(out)}', {g: sum(r[0] == g for r in rows) for g, _ in FILES})
