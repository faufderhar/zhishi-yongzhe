// r17.1 学霸 r17-6（裁定 §2.3）：能量环标签「满5必放」/「答对必放」，用 triggerWhy 预测；高中这一边全冷却时不显示「答对必放」
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ringTag, RING_TAG, roll, newRoll, skillsFor } from '../src/game/skills';

const never = () => 0.999;   // 不会中 20% 的幸运触发
it('能量 3 →「满5必放」；能量 4 或连续 4 次没放 →「答对必放」，下一题答对确实放', () => {
  const r0 = newRoll();
  for (const seg of ['P36', 'J', 'H'] as const) {
    expect(ringTag(r0, seg, '数学', 'P', 3)).toBe('cap');
    expect(ringTag(r0, seg, '数学', 'P', 0)).toBe('cap');
    expect(ringTag(r0, seg, '数学', 'P', 4)).toBe('must');
    expect(ringTag({ ...r0, dry: 4 }, seg, '数学', 'M', 1)).toBe('must');
    // 预测和实际一致：答对 +1 后 roll（rng 不中）
    expect(roll(r0, { seg, major: '数学', side: 'P', correct: true, energy: 4 + 1, rng: never })[1]).not.toBeNull();
    expect(roll({ ...r0, dry: 4 }, { seg, major: '数学', side: 'M', correct: true, energy: 2, rng: never })[1]).not.toBeNull();
    expect(roll(r0, { seg, major: '数学', side: 'P', correct: true, energy: 3 + 1, rng: never })[1]).toBeNull();
  }
  expect(RING_TAG).toEqual({ must: '答对必放', cap: '满5必放' });
});
it('高中：这一边的技能全在冷却 → 不显示「答对必放」（答对也确实不放）；另一边不受影响', () => {
  const atk = skillsFor('H', '数学').filter(k => k.type === 'atk'); expect(atk.length).toBeGreaterThan(0);
  const r = { ...newRoll(), cd: Object.fromEntries(atk.map(k => [k.id, 2])) };
  expect(ringTag(r, 'H', '数学', 'P', 4)).toBe('cap');
  expect(roll(r, { seg: 'H', major: '数学', side: 'P', correct: true, energy: 5, rng: never })[1]).toBeNull();
  expect(ringTag(r, 'H', '数学', 'M', 4)).toBe('must');
});
it('UI / 样式：标签取 RING_TAG；≥13px、字重 600、无透明度；按钮点击区 ≥44', () => {
  const rb = readFileSync('src/ui/RoundBattle.tsx', 'utf8'), css = readFileSync('src/app.css', 'utf8');
  expect(rb).toContain('<small className="ring-tag" data-testid="energy-tag">{RING_TAG[rt]}</small>');
  expect(rb).not.toContain('>保底</small>');
  const tag = css.match(/\.energy-ring \.ring-tag\{([^}]*)\}/g)!; expect(tag.length).toBe(2);   // 基础一条 + 短横屏只改 padding / margin
  expect(tag.slice(1).every(t => !/font-size|font-weight|opacity/.test(t))).toBe(true);
  expect(tag[0]).toContain('font-size:13px'); expect(tag[0]).toContain('font-weight:600'); expect(tag[0]).not.toContain('opacity');
  expect(css).toContain('.energy-ring::after{content:\'\';position:absolute;inset:-6px}');
  expect(css).toContain('.battle .intent,.battle .energy-ring{min-width:44px !important;min-height:44px !important');
  // 短横屏顶栏按钮一律 28×28：能量环按内容撑宽（≥44），环图标 22
  expect(css).toContain('.battle .hud .energy-ring{width:auto !important;min-width:44px !important;gap:3px}');
  expect(css).toContain('.battle .hud .energy-ring svg{width:22px !important;height:22px !important;flex:0 0 22px}');
});
