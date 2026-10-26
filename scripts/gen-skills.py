#!/usr/bin/env python3
"""从 /workspace/playtest/skills/data.py 生成 src/game/skills.data.ts 与 docs/skill-assets.md（不要手改生成文件）。
用法：python3 scripts/gen-skills.py [data.py 路径]"""
import json, re, sys, runpy, pathlib
SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/playtest/skills/data.py'
D = runpy.run_path(SRC)
ROOT = pathlib.Path(__file__).resolve().parent.parent
SEG = {'小班': 'K', '小学1–2': 'P12', '小学3–6': 'P36', '初一': 'J', '高一': 'H'}
CHAR = {'算算': ('suansuan', '数学'), '墨墨': ('momo', '语文'), '阿贝': ('abei', '英语'), '诗诗': ('shishi', '诗词'), '杯杯': ('beibei', '化学'),
        '阿算': ('asuan', '数学'), '小墨': ('xiaomo', '语文'), 'Lexi': ('lexi', '英语'), '小白': ('xiaobai', '诗词'), '铂拉': ('bola', '化学')}
TYPE = {'攻': 'atk', '护': 'guard', '愈': 'heal', '控': 'control', '演': 'visual'}
IDP = {'K': 'k', 'P12': 'p12', 'P36': 'p36', 'J': 'j1', 'H': 'h1'}
CAP = {'K': 30, 'P12': 40, 'P36': 40, 'J': 60, 'H': 60}
MAJOR_GLYPH = {'数学': ['+', '−', '×', '÷', '='], '语文': ['文', '字', '书'], '英语': ['A', 'B', 'C'], '诗词': ['❀', '月', '诗'], '化学': ['⚗', '○', '◎']}
MAJOR_COLOR = {'数学': ['#29B6F6', '#E1F5FE'], '语文': ['#5C6BC0', '#F5F0E6'], '英语': ['#AB47BC', '#E1BEE7'], '诗词': ['#F48FB1', '#FFF9C4'], '化学': ['#66BB6A', '#AB47BC']}
def recipe(t, desc):
    if t == 'control': return 'control'
    if t == 'heal': return 'heal'
    if re.search(r'音波|声波|涟漪|波纹', desc): return 'ring'
    if t == 'guard' or re.search(r'护盾|屏障|护罩|罩住|壁垒|气罩|薄纱|小盾', desc): return 'shield'
    if re.search(r'斩|剑气|划过|横扫|一划|飞白|弧光', desc): return 'slash'
    if re.search(r'落下|雨|飘落|飘过|洒下|降下', desc): return 'rain'
    if re.search(r'飞向|射出|抛出|撞向|飞镖|刺中|涌向|拍向|卷向|滑向|开到|漂到|飞到|砸中|落向|喷出', desc): return 'projectile'
    if re.search(r'飘起|升起|冒出|长出|长成|亮起|弹出|打开|吹出|展开', desc): return 'rise'
    return 'burst'
def glyphs(desc, major):
    q = re.findall(r'「([^」]{1,10})」', desc)
    if q: return q[:4]
    if re.search(r'0–9|数字', desc): return list('0123456789')[:6] if major == '数学' else MAJOR_GLYPH[major]
    m = re.findall(r'(?<![A-Za-z])([A-Z])(?:、| )', desc + ' ')
    if len(m) >= 2: return m[:4]
    if '1、2、3' in desc: return ['1', '2', '3']
    return MAJOR_GLYPH[major]
ICON = [('蝴蝶','🦋'),('花瓣','🌸'),('小花','🌼'),('开出一朵花','🌸'),('月','🌙'),('星','⭐'),('泡泡','🫧'),('积木','🧱'),('算珠','🟠'),('爱心','💗'),('书','📖'),('气球','🎈'),('Hello','👋'),('火车','🚂'),('彩虹','🌈'),('小芽','🌱'),('叶','🍃'),('火箭','🚀'),('直尺','📏'),('笔画','🖌️'),('毛笔','🖌️'),('笔','🖌️'),('灯笼','🏮'),('鼓','🥁'),('风','🍃'),('纸船','⛵'),('萤火虫','✨'),('糖果','🍬'),('数字','🔢'),('斩','⚔️'),('护盾','🛡️'),('屏障','🛡️'),('卷轴','📜'),('音波','〰️'),('声波','〰️'),('飞镖','🎯'),('STOP','🛑'),('zzz','💤'),('烧杯','⚗️'),('气泡','🫧'),('液体','💧'),('阳光','☀️'),('数轴','➡️'),('准星','🎯'),('竖线','‖'),('浪','🌊'),('江','🌊'),('词块','🔗'),('字母','🔤'),('催化','⚗️'),('曲线','〰️'),('力场','🧲'),('多面体','🔷'),('墨龙','🐉'),('箭','🏹'),('涟漪','💧'),('星图','✨'),('静音','🔇'),('字符','🔤'),('剑气','🗡️'),('举杯','🍵'),('反应','⚗️'),('分子','⚛️'),('辉光','🟣'),('粉末','✨'),('水滴','💧'),('墨','🖋️')]
def icon_of(desc, name, t):
    for k, v in ICON:
        if k in name or k in desc: return v
    return {'atk': '⚔️', 'guard': '🛡️', 'heal': '💚', 'control': '⏸️', 'visual': '✨'}[t]
out, seen = [], {}
# r17.1（学霸r16.1裁定_r17 §1 / r17-2）：卡面 / 横幅 effectText 按裁定表的「效果」部分（只改文字；id、cd、数值字段不变）。
# 写在生成器里（按效果码），数据源 data.py 不动；H5 写血量 = 5% × 本学段玩家最大血量（balance.ts PLAYER：std 100 / hs 160）。
PLAYER_HP = {'P36': 100, 'J': 100, 'H': 160}
EFFECT_TEXT = {
    'A14': '本题伤害 ×1.4', 'A2H': '连打 2 下，每下 70%（合计约 140%）', 'A13P': '本题伤害 ×1.3，无视怪物护盾', 'A125C': '本题伤害 ×1.25，连击多算 1 层',
    'G70': '获得护体（下一次受伤只受 70%）', 'C': '怪物下一招变弱：⚔ 攻击→发呆，💥 重击→普通攻击，⚡ 蓄力 / 🛡 护盾→取消',
    'F1': '专注 +1（下次攻击 +25%、闪避 +10%）',   # 「解除负面状态」去掉：代码里没有负面状态来源（r17-13）
}
def effect_text(eff, sk):
    if eff == 'H5': return f'回复 5% 最大血量（{round(PLAYER_HP[sk] * 0.05)} 血）'
    return EFFECT_TEXT.get(eff, D['EFFECT'][eff])
for (seg, ch, name, typ, eff, cd, desc, dur, color, parts, sound) in D['S']:
    sk = SEG[seg]; cid, major = CHAR[ch]; t = TYPE[typ]
    seen[(sk, cid)] = seen.get((sk, cid), 0) + 1
    sid = f"{IDP[sk]}_{cid}_{seen[(sk, cid)]}"   # 与音效 skills-manifest.json 的 ID 一致
    cols = re.findall(r'#[0-9A-Fa-f]{6}', color) or MAJOR_COLOR[major]
    n = re.findall(r'≤\s*(\d+)', parts) or re.findall(r'(\d+)\s*(?:个|颗|只|圈|块)', parts)
    count = min(int(n[0]) if n else 12, CAP[sk])
    d = float(dur)
    limit = 1.2 if sk == 'K' else 1.0 if t in ('guard', 'heal', 'control') else 1.5
    out.append(dict(id=sid, seg=sk, char=ch, charId=cid, major=major, name=name, type=t, effect=eff, effectText=effect_text(eff, sk), cd=int(cd),
        anim=desc, durMs=int(round(min(d, limit) * 1000)), srcDurMs=int(round(d * 1000)), colors=[c.upper() for c in cols], particles=count, sfxNote=sound,
        recipe=recipe(t, desc), glyphs=glyphs(desc, major), icon=icon_of(desc, name, t),
        assets=dict(fx=f'fx/skills/{sid}.webp', icon=f'fx/skills/icons/icon_{sid}.webp', sfx=f'sfx/skills/sfx_skill_{sid}.mp3')))
assert len(out) == 85, len(out)
ts = ('/* 自动生成：python3 scripts/gen-skills.py（数据源 /workspace/playtest/skills/data.py，v0.3.7）。不要手改。 */\n'
      'export type SkillSeg = \'K\' | \'P12\' | \'P36\' | \'J\' | \'H\';\n'
      'export type SkillType = \'atk\' | \'guard\' | \'heal\' | \'control\' | \'visual\';\n'
      'export type SkillEffect = \'A14\' | \'A2H\' | \'A13P\' | \'A125C\' | \'G70\' | \'H5\' | \'C\' | \'F1\' | \'V\';\n'
      'export type FxRecipe = \'control\' | \'heal\' | \'ring\' | \'shield\' | \'slash\' | \'rain\' | \'projectile\' | \'rise\' | \'burst\';\n'
      'export interface SkillDef { id: string; seg: SkillSeg; char: string; charId: string; major: string; name: string; type: SkillType; effect: SkillEffect; effectText: string; cd: number;\n'
      '  anim: string; durMs: number; srcDurMs: number; colors: string[]; particles: number; sfxNote: string; recipe: FxRecipe; glyphs: string[]; icon: string; assets: { fx: string; icon: string; sfx: string } }\n'
      f'export const SKILL_DATA: SkillDef[] = {json.dumps(out, ensure_ascii=False, indent=1)};\n')
(ROOT / 'src/game/skills.data.ts').write_text(ts)
md = ['# 技能素材键（自动生成，`python3 scripts/gen-skills.py`）', '',
      '程序化特效已覆盖全部 85 个技能。美术/音频到位后，把文件放到 `public/` 下对应路径，并在 `public/fx/manifest.json` 的 `skills` 数组里登记技能 id，即自动替换程序化特效（未登记的不发请求）：',
      '- `fx`：序列帧 webp（横排 ≤12 帧，单帧 ≤512×512，≤150 KB）', '- `icon`：128×128 技能图标', '- `sfx`：已交付（`public/sfx/skills/`，小班另有 `skills/kindergarten/` −6 dB 版），运行时按 `public/sfx/skills-manifest.json` 查找，详见 `public/sfx/README.md`', '',
      '| id | 学段 | 角色 | 技能 | 类型 | 程序化配方 | 时长 ms | 粒子上限 | fx | icon | sfx |', '|---|---|---|---|---|---|---|---|---|---|---|']
md += [f"| {s['id']} | {s['seg']} | {s['char']} | {s['name']} | {s['type']} | {s['recipe']} | {s['durMs']} | {s['particles']} | `{s['assets']['fx']}` | `{s['assets']['icon']}` | `{s['assets']['sfx']}` |" for s in out]
(ROOT / 'docs/skill-assets.md').write_text('\n'.join(md) + '\n')
print('generated', len(out))
