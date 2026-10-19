#!/usr/bin/env python3
"""r16：中班 Boss 美术（/workspace/art/monsters/manifest.json 里 grade=k2、level_kind=boss 的条目）→ src/game/kinderBoss.gen.json
+ 复制柔和版序列帧（*_soft.json / *_soft_sheet.webp，幼儿园只用柔和版）到 public/art/monsters/k2_boss/anim/<id>/。
按字段匹配（grade + level_kind + k2_subject + k2_topic），id 只当键用；小节 unit 由 Boss 名对照表（同名 Boss 名）给出，并和 art/k2/todo.json 的来源核对。
用法：python3 scripts/import-k2-monsters.py"""
import csv, json, os, re, shutil, sys
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
W = '/workspace'
man = json.load(open(f'{W}/art/monsters/manifest.json', encoding='utf-8'))
todo = {b['id']: b for b in json.load(open(f'{W}/art/k2/todo.json', encoding='utf-8'))['bosses']}
rows = list(csv.DictReader(open(f'{W}/questions/中班Boss名对照_v34.csv', encoding='utf-8-sig')))
unit_of = {r['Boss名'].strip(): (r['科目'].strip(), r['小节 unit'].strip()) for r in rows}
SUBJ = {'num': '数数', 'shape': '颜色形状', 'ani': '认识动物', 'life': '生活常识', 'song': '儿歌古诗', 'poem': '儿歌古诗', 'eng': '英语'}
out, errs = {}, []
for m in man['monsters']:
    if str(m.get('grade', '')).lower() != 'k2' or m.get('level_kind') != 'boss': continue
    sub, topic = m.get('k2_subject'), m.get('k2_topic')
    if sub not in SUBJ or not topic: errs.append(f'{m["id"]}: k2_subject/k2_topic 缺失'); continue
    if m['name'] not in unit_of: errs.append(f'{m["id"]}: Boss 名「{m["name"]}」不在中班对照表'); continue
    subj_cn, unit = unit_of[m['name']]
    if subj_cn != SUBJ[sub]: errs.append(f'{m["id"]}: 对照表科目 {subj_cn} ≠ k2_subject {sub}'); continue
    src = todo.get(m['id'], {}).get('source', '')
    if f'{subj_cn} / {unit}' not in src: errs.append(f'{m["id"]}: todo 来源「{src[:60]}」和对照表 {subj_cn}/{unit} 不一致')
    d = os.path.dirname(m['anims']['idle']['soft_json']); dst = f'art/monsters/k2_boss/anim/{m["id"]}'
    os.makedirs(os.path.join(ROOT, 'public', dst), exist_ok=True)
    anims = {}
    for k in ('idle', 'attack', 'hit', 'defeat'):
        a = m['anims'][k]
        for f in (a['soft_json'], a['soft_sheet']): shutil.copyfile(os.path.join(W, f), os.path.join(ROOT, 'public', dst, os.path.basename(f)))
        meta = json.load(open(os.path.join(W, a['json']), encoding='utf-8'))
        anims[k] = {'json': os.path.basename(a['json'])[:-5], 'soft': os.path.basename(a['soft_json'])[:-5], 'hit_frame': meta.get('hit_frame')}
    cw, ch = m['cutout_size']
    out[m['id']] = {'name': m['name'], 'grade': 'K2', 'level_kind': 'boss', 'k2_subject': sub, 'k2_topic': topic, 'subject': subj_cn, 'unit': unit,
                    'subject_key': m.get('subject_key'), 'theme': m['theme'], 'tier': 'boss', 'pool_cn': [subj_cn], 'dir': dst, 'anims': anims,
                    'aspect': round(cw / ch, 3)}
if errs: sys.exit('\n'.join(errs))
keys = [(v['subject'], v['unit']) for v in out.values()]
if len(set(keys)) != len(keys): sys.exit('同一小节有两只 Boss')
json.dump(out, open(os.path.join(ROOT, 'src/game/kinderBoss.gen.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(out)} 只中班 Boss → src/game/kinderBoss.gen.json；宽（aspect>1.15）：', sorted(k for k, v in out.items() if v['aspect'] > 1.15))
