// r17.1 学霸r16.1裁定_r17 r17-2：effectText 按 §1 表的效果部分（gen-skills.py 生成；数值字段 / id / cd 完全不变）
import { it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SKILL_DATA } from '../src/game/skills.data';
import { PLAYER, SKILL } from '../src/game/balance';

const T: Record<string, string> = {
  A14: '本题伤害 ×1.4', A2H: '连打 2 下，每下 70%（合计约 140%）', A13P: '本题伤害 ×1.3，无视怪物护盾', A125C: '本题伤害 ×1.25，连击多算 1 层',
  G70: '获得护体（下一次受伤只受 70%）', C: '怪物下一招变弱：⚔ 攻击→发呆，💥 重击→普通攻击，⚡ 蓄力 / 🛡 护盾→取消', F1: '专注 +1（下次攻击 +25%、闪避 +10%）', V: '纯视觉，无数值',
};
it('每个技能的效果文字 = 裁定表；H5 写本学段血量（小学 / 初中 5 血，高中 8 血）', () => {
  for (const k of SKILL_DATA) {
    if (k.effect === 'H5') { const hp = k.seg === 'H' ? PLAYER.hs.hp : PLAYER.std.hp; expect(k.effectText).toBe(`回复 5% 最大血量（${Math.round(hp * SKILL.healPct)} 血）`); }
    else expect(k.effectText, k.id).toBe(T[k.effect]);
  }
  const by = (seg: string, name: string) => SKILL_DATA.find(k => k.seg === seg && k.name === name)!.effectText;
  expect(by('P36', '成语回春')).toBe('回复 5% 最大血量（5 血）'); expect(by('H', 'Translation Field')).toBe('回复 5% 最大血量（8 血）');
  expect(SKILL_DATA.some(k => /负面状态|×0\.7/.test(k.effectText))).toBe(false);
});
it('只有 effectText 变：和 r17.1 B6 的 skills.data.ts 比，其余字段逐个相同', () => {
  let old: string; try { old = execSync('git show b8f06f4:src/game/skills.data.ts', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return; }   // 浅克隆没有这个提交时跳过
  const parse = (s: string) => JSON.parse(s.slice(s.indexOf('= [') + 2, s.lastIndexOf(']') + 1)) as Record<string, unknown>[];
  const a = parse(old), b = parse(readFileSync('src/game/skills.data.ts', 'utf8')); expect(b.length).toBe(a.length);
  a.forEach((x, i) => { const { effectText: _e1, ...r1 } = x; const { effectText: _e2, ...r2 } = b[i]; expect(r2).toEqual(r1); });
});
