"""关卡 id 迁移表：旧版关卡（OLD）在新题库/新规则（NEW）下不再存在时，按「同科目、同类型、题池重合最多」映射到新关卡，
追加到 src/game/levelAliases.json（新 id → [旧 id]），星级取最大继承。用法：python3 tools/gen_level_aliases.py /tmp/old.json /tmp/new.json"""
import json, sys
old = json.load(open(sys.argv[1])); new = json.load(open(sys.argv[2]))
P = 'src/game/levelAliases.json'; al = json.load(open(P))
covered = set(new) | {p for v in new.values() for p in v['parts']} | {a for v in new.values() for a in v['aliases']} | {a for v in al.values() for a in v}
mapped, unmapped = 0, []
for o, ov in old.items():
    if o in covered: continue
    subj, kind = o.split('|')[0], ov['kind']; op = set(ov['pool'])
    # 同类型优先；精英关找不到同类型（精英不再跨课）时退到重合最多的普通关
    for kinds in ([kind], ['normal']):
        c = [(len(op & set(v['pool'])), n) for n, v in new.items() if v['kind'] in kinds and n.split('|')[0] == subj]
        c = [x for x in c if x[0] > 0]
        if c: best = max(c)[1]; al.setdefault(best, []); al[best].append(o); mapped += 1; break
    else: unmapped.append(o)
json.dump(al, open(P, 'w'), ensure_ascii=False, indent=1)
print('old', len(old), 'new', len(new), 'mapped', mapped, 'unmapped', len(unmapped), unmapped)
