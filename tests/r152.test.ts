// r15.2（用户 + 策划）：初一普通关 3 星要答对 1 道挑战题；结算提示；旧 3 星保留；高一题卡预计伤害
import { describe, it, expect } from 'vitest';
import { levelStars, chalCostStar, chalMissing, CHAL_STAR_HINT, migrateStars } from '../src/game/levels';
import { newRound, resolveRound, calcD } from '../src/game/rounds';
import { TIP_TEXT, rulesFor } from '../src/ui/rules';
import { SCIFI, PUPS } from '../src/game/characters';

const base = { win: true, correct: 9, total: 10, revived: false, hpPct: 0.8 };
describe('r15.2 初一普通关 ★★★ 要答对 1 道挑战题', () => {
  it('挑战按钮亮过、没答对挑战题 → 最多 2 星，并提示', () => {
    const r = { ...base, chalNeed: true, chalRight: 0 };
    expect(levelStars(r)).toBe(2); expect(chalCostStar(r)).toBe(true); expect(chalMissing(r)).toBe(true);
  });
  it('答对 1 道挑战题 → 3 星，不提示', () => {
    const r = { ...base, chalNeed: true, chalRight: 1 };
    expect(levelStars(r)).toBe(3); expect(chalCostStar(r)).toBe(false);
  });
  it('挑战按钮一直灰（chalNeed=false）/ 精英、Boss、其他年级（不传）→ 原规则 3 星', () => {
    expect(levelStars({ ...base, chalNeed: false, chalRight: 0 })).toBe(3);
    expect(levelStars(base)).toBe(3);
  });
  it('别的原因不到 3 星时不提示挑战题', () => {
    expect(chalCostStar({ ...base, chalNeed: true, chalRight: 0, revived: true })).toBe(false);   // 复活本来就 2 星
    expect(chalCostStar({ ...base, chalNeed: true, chalRight: 0, correct: 7 })).toBe(false);      // 70% 本来就 2 星
    expect(levelStars({ ...base, chalNeed: true, chalRight: 0, correct: 5 })).toBe(1);
    expect(levelStars({ ...base, chalNeed: true, chalRight: 0, retreat: true })).toBe(1);         // 撤退最多 1 星不变
  });
  it('旧档案已有的 3 星保留（星星只升不降）', () => {
    const old = { 'L1': 3 }; const gain = levelStars({ ...base, chalNeed: true, chalRight: 0 });
    expect(Math.max(old.L1, gain)).toBe(3);
    expect(migrateStars([], old)).toBeNull();
  });
  it('首次短提示和「？」规则写上「答对一道挑战题就能拿 3 星」，只在初一', () => {
    expect(CHAL_STAR_HINT).toBe('其他条件都够 ⭐⭐⭐ 了，就差答对 1 道挑战题');   // r17.1 r17-7 改文案
    /* r15.3 策划 D：首次短提示改为原文（不再含 3 星说明）；3 星规则写在「？」里 */
    expect(TIP_TEXT.challenge).toBe('每次我方出题前可以选：普通题（默认）或挑战题。挑战题难一档，答对伤害 ×1.5；答错会受到 ×1.5 反击，而且不能闪避。慢慢选，点了才开始计时。');
    expect(rulesFor('j').find(r => r[0] === '挑战题')?.[1]).toContain('初中普通关要拿 3 星，得至少答对一道挑战题（挑战按钮一直是灰的那关不算）。');
    for (const t of [TIP_TEXT.challenge, ...rulesFor('j').map(r => r[1])]) expect(t).not.toMatch(/3 ?秒/);
    expect(rulesFor('h').some(r => r[1].includes(CHAL_STAR_HINT))).toBe(false);
    expect(rulesFor('p36').some(r => r[1].includes(CHAL_STAR_HINT))).toBe(false);
  });
});

describe('r15.2 高一题卡「本题预计伤害」= 现有伤害公式（数值不变）', () => {
  it('预计值等于答对实际造成的伤害（无技能、无护盾、无押注）', () => {
    for (const c of [...SCIFI, ...PUPS].slice(0, 4)) for (const card of ['light', 'std', 'heavy'] as const) for (const d of [1, 2, 3, 4, 5]) {
      const s = { ...newRound('h', 'normal'), monsterHp: 9999, monsterMax: 9999, shield: 0 };
      const i = { correct: true, subject: '数学', difficulty: d, card, noSkill: true };
      const est = Math.max(1, Math.round(calcD(s, c, i)));
      const [, o] = resolveRound(s, c, i);
      expect(o.dealt).toBe(est);
    }
  });
});
