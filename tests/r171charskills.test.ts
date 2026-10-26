// r17.1 学霸 r17-1：角色卡技能块（主修 / 被动 / 技能 ⚔ 我方回合 · 🛡 对方回合 /〔技能详情〕），技能详情和能量环弹窗同一个组件 SkillDetail。
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { skillBlock, skillLine, skillsFor, SKILL_BLOCK_HEAD, type SkillSeg } from '../src/game/skills';
import * as SK from '../src/game/skills';
import { SKILL_DATA } from '../src/game/skills.data';
import { SKILL } from '../src/game/balance';
import { PUPS, SCIFI } from '../src/game/characters';

const SEGS: SkillSeg[] = ['P36', 'J', 'H'];
const CHARS = [...PUPS, ...SCIFI];
describe('skillBlock', () => {
  it('10 个角色 × 3 学段：技能块列出全部技能（名字 = skills.data），我方 = 攻击、对方 = 防护 / 恢复 / 控制（按权重），每边 1–2 个', () => {
    expect(CHARS.length).toBe(10);
    for (const c of CHARS) for (const seg of SEGS) {
      const b = skillBlock(seg, c.major)!; expect(b, `${c.id} ${seg}`).toBeTruthy();
      const all = skillsFor(seg, c.major);
      expect([...b.mine, ...b.theirs].map(k => k.id).sort()).toEqual(all.map(k => k.id).sort());
      expect(b.mine.every(k => k.type === 'atk') && b.theirs.every(k => k.type !== 'atk')).toBe(true);
      expect(b.mine.length).toBeGreaterThanOrEqual(1); expect(b.mine.length).toBeLessThanOrEqual(2);
      expect(b.theirs.length).toBeGreaterThanOrEqual(1); expect(b.theirs.length).toBeLessThanOrEqual(2);
      for (let i = 1; i < b.theirs.length; i++) expect(SKILL.weight[b.theirs[i - 1].type]).toBeGreaterThanOrEqual(SKILL.weight[b.theirs[i].type]);
    }
  });
  it('裁定 §1 的例子：算算初中「数字风暴 · 数轴突刺」/「绝对值护盾 · 坐标锁定」', () => {
    const b = skillBlock('J', '数学')!;
    expect(b.mine.map(k => k.name).join(' · ')).toBe('数字风暴 · 数轴突刺'); expect(b.theirs.map(k => k.name).join(' · ')).toBe('绝对值护盾 · 坐标锁定');
  });
  it('幼儿园 / 小学 1–2（纯视觉技能）不显示技能块', () => {
    for (const c of CHARS) { expect(skillBlock('K', c.major)).toBeNull(); expect(skillBlock('P12', c.major)).toBeNull(); }
  });
  it('STORM_CARD / skillCardLine 已删除', () => {
    expect('STORM_CARD' in SK).toBe(false); expect('skillCardLine' in SK).toBe(false);
    for (const f of ['src/game/skills.ts', 'src/ui/Screens.tsx', 'src/ui/RoundBattle.tsx']) expect(readFileSync(f, 'utf8')).not.toMatch(/STORM_CARD|skillCardLine|答对时有 20% 机会触发/);
  });
});
const SPEC = '/workspace/playtest/学霸r16.1裁定_r17.md';
describe.skipIf(!existsSync(SPEC))('裁定 §1 每个技能的正式文案（box only）', () => {
  it('三张表逐行：「名字：效果」= skillLine，冷却一致；每学段行数 = 数据里的技能数', () => {
    const md = readFileSync(SPEC, 'utf8'); const s0 = md.indexOf('### 每个技能的正式文案'); const sec = md.slice(s0, md.indexOf('\n---', s0));
    const parts: [SkillSeg, string][] = [['P36', '#### 小学 3–6 年级'], ['J', '#### 初中'], ['H', '#### 高中']];
    for (let i = 0; i < parts.length; i++) {
      const [seg, h] = parts[i]; const a = sec.indexOf(h); const b = i + 1 < parts.length ? sec.indexOf(parts[i + 1][1]) : sec.indexOf('\n\n', sec.indexOf('|', a) + 1) + 1 || sec.length;
      const rows = sec.slice(a, b).split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| 角色') && !l.startsWith('|---')).map(l => l.split('|').slice(1, -1).map(x => x.trim()));
      expect(rows.length, seg).toBe(SKILL_DATA.filter(k => k.seg === seg).length);
      for (const [char, name, , , text, cd] of rows) {
        const k = SKILL_DATA.find(x => x.seg === seg && x.name === name && x.char === char)!; expect(k, `${seg} ${char} ${name}`).toBeTruthy();
        expect(skillLine(k)).toBe(text);
        expect(k.cd).toBe(cd === '无' ? 0 : +cd.match(/(\d+) 回合/)![1]);
      }
    }
  });
});
describe('UI 源码', () => {
  const sc = readFileSync('src/ui/Screens.tsx', 'utf8'), rb = readFileSync('src/ui/RoundBattle.tsx', 'utf8'), sd = readFileSync('src/ui/SkillDetail.tsx', 'utf8'), css = readFileSync('src/app.css', 'utf8');
  it('角色卡：标题 + ⚔ 我方回合 / 🛡 对方回合 +〔技能详情〕；详情 Modal 和能量弹窗都用 SkillDetail', () => {
    expect(SKILL_BLOCK_HEAD).toBe('技能（答对时自动放，不用按）');
    expect(sc).toContain("⚔ 我方回合：{sb.mine.map(k => k.name).join(' · ')}"); expect(sc).toContain("🛡 对方回合：{sb.theirs.map(k => k.name).join(' · ')}");
    expect(sc).toContain('〔技能详情〕'); expect(sc).toContain('<SkillDetail seg={segOf(cfg.band)} major={detailC.major} testid="skill-detail" />');
    expect(rb).toContain('<SkillDetail seg={bs.seg} major={c.major} testid="ring-pop" cdLeft={bs.sk.cd} />');
    expect(sd).toContain('{SKILL_TRIGGER_TEXT}'); expect(sd).toContain('{SKILL_COOLDOWN_TEXT}');
    expect(css).toContain('.char-card .char-skill .cs-more{pointer-events:auto;');
    expect(css).toContain('.char-card .char-skill span{display:block;word-break:keep-all;overflow-wrap:anywhere}');   // 技能名不从中间断行   // 整张卡 pointer-events:none，只放开〔技能详情〕
  });
});
