// r17.1 学霸 r17-4（裁定 §2.2 / §3 / §4.3）：护体 / 能量 / 技能文案定稿；能量弹窗（高中有冷却）+ 共用触发行
import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { rulesFor, TIP_TEXT } from '../src/ui/rules';
import { SKILL_TRIGGER_TEXT, SKILL_COOLDOWN_TEXT } from '../src/game/skills';
import { SKILL, ENERGY_CAP } from '../src/game/balance';

const rule = (m: 'p36' | 'j' | 'h', k: string) => rulesFor(m).find(r => r[0] === k)?.[1];
it('规则页：护体 / 能量 / 技能三条定稿；复活、星星、挑战题（r17-7）仍在', () => {
  for (const m of ['p36', 'j', 'h'] as const) {
    expect(rule(m, '护体')).toBe('护体：下一次受伤只受 70%（用掉就没了，不叠加）。');
    expect(rule(m, '能量')).toBe('每次答对攒 1 点 ⚡（连对到第 3 题多攒 1 点，高中押注再多 1 点）。答对后能量到 5 点，这道题当场放技能；连续 4 次答对都没放，第 5 次答对也一定放。放完能量清零。');
    expect(rule(m, '技能')).toBe('答对时自动放技能（不用按）：我方回合放攻击技能，对方回合放护体、回血或打乱怪物的技能；同一边的两个技能轮流出。');
    expect(rule(m, '复活')).toContain('本关没出过的新题优先'); expect(rule(m, '星星')).toContain('⭐⭐⭐');
  }
  expect(rule('j', '挑战题')).toContain('初中普通关要拿 3 星，得至少答对一道挑战题（挑战按钮一直是灰的那关不算）。');
  expect(TIP_TEXT.guard).toBe('护体挡住了一部分伤害：这次只受 70%');
  expect(TIP_TEXT.energy).toBe('能量：答对就攒 ⚡，攒到 5 点的那道题当场放技能');
});
it('共用触发行 / 冷却行 = 裁定原文，数字和 balance 一致', () => {
  expect(SKILL.rate.battle).toBe(0.2); expect(SKILL.pity.battle).toBe(4); expect(ENERGY_CAP).toBe(5);
  expect(SKILL_TRIGGER_TEXT).toBe('技能只在答对时放。每次答对有 20% 机会；答对后能量到 5 点，这道题一定放；连续 4 次答对没放，第 5 次一定放。放完能量清零。同一边的两个技能轮流出。答错、超时、漏选不会放。');
  expect(SKILL_COOLDOWN_TEXT).toBe('冷却：放过的技能，接下来 3 个回合（控制、恢复、清心类 4 个回合；双方回合都算）不会再出；这一边的技能都在冷却时，「一定放」顺延到下一次答对。');
});
it('RoundBattle：能量弹窗用共用文案、（高中有冷却）；护体图标 title / aria-label；结果行「（护体：只受 70%）」', () => {
  const rb = readFileSync('src/ui/RoundBattle.tsx', 'utf8');
  // r17-1：弹窗文案搬进共用组件 SkillDetail（角色卡〔技能详情〕同一个）
  const sd = readFileSync('src/ui/SkillDetail.tsx', 'utf8');
  expect(rb).toContain('<SkillDetail seg={bs.seg} major={c.major} testid="ring-pop" cdLeft={bs.sk.cd} />');
  expect(sd).toContain('<p data-testid={testid}>{SKILL_TRIGGER_TEXT}</p>{seg === \'H\' && <p data-testid={testid + \'-cd\'}>{SKILL_COOLDOWN_TEXT}</p>}');
  expect(sd).toContain("'（高中有冷却）'"); expect(rb).toContain('title="护体：下一次受伤只受 70%" aria-label="护体：下一次受伤只受 70%"');
  expect(rb).toContain("(o.guardUsed ? '（护体：只受 70%）' : '')");
});
it('全仓库 grep：不再有「下次答对必定」「护体抵挡 30%」「护体：下一次受伤 ×0.7」「高一有冷却」（hurtNote 明细的「护体 ×0.7」允许）', () => {
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
  const files = [...walk('src'), ...walk('scripts'), ...walk('tests').filter(f => !f.endsWith('r171rulestext.test.ts'))].filter(f => /\.(ts|tsx|mjs|js|py)$/.test(f));
  for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/下次答对必定|护体抵挡 30%|护体：下一次受伤 ×0\.7|高一有冷却/);
});
