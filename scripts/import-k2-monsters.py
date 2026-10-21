#!/usr/bin/env python3
"""r16：中班 Boss 美术（/workspace/art/monsters/manifest.json 里 grade=k2、level_kind=boss 的条目）→ src/game/kinderBoss.gen.json
+ 复制柔和版序列帧（*_soft.json / *_soft_sheet.webp，幼儿园只用柔和版）到 public/art/monsters/k2_boss/anim/<id>/。
按字段匹配（grade + level_kind + k2_subject + k2_topic），id 只当键用；小节 unit 由 Boss 名对照表（同名 Boss 名）给出，并和 art/k2/todo.json 的来源核对。
r17：也导入大班 Boss（grade=k3，字段 k3_subject / k3_topic，对照表 大班Boss名对照_v39.csv，序列帧到 public/art/monsters/k3_boss/anim/<id>/；
     gen.json 里统一写成 k2_subject / k2_topic 两个字段名，游戏按 grade 区分）。
r17：小节里够格的题（游戏可用题库里同科目同小节、去掉 Boss 专用题）不满 12 道 → 这一关没有章节 Boss（levels.ts 同一规则），
     这只 Boss 跳过并打印 WARN（不报错）。现在：大班 镜子小狐狸（左右和镜像 11 道，K3C-007 需家长确认没进可用题库）。
用法：python3 scripts/import-k2-monsters.py [--dry]（--dry：只检查、打印，不写文件）；源目录 = $ZY_BOX_ROOT（默认 /workspace）"""
import csv, json, os, shutil, sys
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
W = os.environ.get('ZY_BOX_ROOT', '/workspace')
OUT = os.environ.get('ZY_KBOSS_OUT', os.path.join(ROOT, 'src/game/kinderBoss.gen.json'))
DRY = '--dry' in sys.argv
MIN_Q = 12
SUBJ = {'num': '数数', 'shape': '颜色形状', 'ani': '认识动物', 'life': '生活常识', 'song': '儿歌古诗', 'poem': '儿歌古诗', 'eng': '英语'}
GRADES = {'k2': ('K2', '中班Boss名对照_v34.csv', '题库_游戏可用_幼儿园中班.json'), 'k3': ('K3', '大班Boss名对照_v39.csv', '题库_游戏可用_幼儿园大班.json')}

def qualifying(qs, subject, unit, boss_only):
    """小节里够格的题数：同科目、同小节（去首尾空格），不算 Boss 专用题"""
    return sum(1 for q in qs if q.get('subject') == subject and str(q.get('unit', '')).strip() == unit and q.get('id') not in boss_only)

def main():
    man = json.load(open(f'{W}/art/monsters/manifest.json', encoding='utf-8'))
    todo_p = f'{W}/art/k2/todo.json'
    todo = {b['id']: b for b in json.load(open(todo_p, encoding='utf-8'))['bosses']} if os.path.exists(todo_p) else None
    out, errs, warns = {}, [], []
    for g, (G, csv_name, bank_name) in GRADES.items():
        rows = list(csv.DictReader(open(f'{W}/questions/{csv_name}', encoding='utf-8-sig')))
        unit_of = {r['Boss名'].strip(): (r['科目'].strip(), r['小节 unit'].strip(), set(r.get('Boss专用题 id', '').split())) for r in rows}
        bank = json.load(open(f'{W}/questions/{bank_name}', encoding='utf-8')); qs = bank['questions'] if isinstance(bank, dict) else bank
        for m in man['monsters']:
            if str(m.get('grade', '')).lower() != g or m.get('level_kind') != 'boss': continue
            sub, topic = m.get(f'{g}_subject'), m.get(f'{g}_topic')
            if sub not in SUBJ or not topic: errs.append(f'{m["id"]}: {g}_subject/{g}_topic 缺失'); continue
            if m['name'] not in unit_of: errs.append(f'{m["id"]}: Boss 名「{m["name"]}」不在{csv_name}'); continue
            subj_cn, unit, boss_only = unit_of[m['name']]
            if subj_cn != SUBJ[sub]: errs.append(f'{m["id"]}: 对照表科目 {subj_cn} ≠ {g}_subject {sub}'); continue
            n = qualifying(qs, subj_cn, unit, boss_only)
            if n < MIN_Q: warns.append(f'WARN 跳过 {G} Boss {m["name"]}（{m["id"]}）：{subj_cn}·{unit} 只有 {n} 道够格的题（< {MIN_Q}），这一节没有章节 Boss 关'); continue
            if g == 'k2' and todo is not None:
                src = todo.get(m['id'], {}).get('source', '')
                if f'{subj_cn} / {unit}' not in src: errs.append(f'{m["id"]}: todo 来源「{src[:60]}」和对照表 {subj_cn}/{unit} 不一致')
            dst = f'art/monsters/{g}_boss/anim/{m["id"]}'
            if not DRY: os.makedirs(os.path.join(ROOT, 'public', dst), exist_ok=True)
            anims = {}
            for k in ('idle', 'attack', 'hit', 'defeat'):
                a = m['anims'][k]
                if not DRY:
                    for f in (a['soft_json'], a['soft_sheet']): shutil.copyfile(os.path.join(W, f), os.path.join(ROOT, 'public', dst, os.path.basename(f)))
                meta = json.load(open(os.path.join(W, a['json']), encoding='utf-8'))
                anims[k] = {'json': os.path.basename(a['json'])[:-5], 'soft': os.path.basename(a['soft_json'])[:-5], 'hit_frame': meta.get('hit_frame')}
            cw, ch = m['cutout_size']
            out[m['id']] = {'name': m['name'], 'grade': G, 'level_kind': 'boss', 'k2_subject': sub, 'k2_topic': topic, 'subject': subj_cn, 'unit': unit,
                            'subject_key': m.get('subject_key'), 'theme': m['theme'], 'tier': 'boss', 'pool_cn': [subj_cn], 'dir': dst, 'anims': anims,
                            'aspect': round(cw / ch, 3)}
    for w in warns: print(w)
    if errs: sys.exit('\n'.join(errs))
    keys = [(v['grade'], v['subject'], v['unit']) for v in out.values()]
    if len(set(keys)) != len(keys): sys.exit('同一小节有两只 Boss')
    by = {G: sum(1 for v in out.values() if v['grade'] == G) for G in ('K2', 'K3')}
    if not DRY: json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(out)} 只幼儿园 Boss（中班 {by["K2"]} / 大班 {by["K3"]}，跳过 {len(warns)}）→ {"（--dry 不写）" if DRY else OUT}；宽（aspect>1.15）：', sorted(k for k, v in out.items() if v['aspect'] > 1.15))

if __name__ == '__main__': main()
