/* r11：一局内去重（2000 局性质测试）、难度回落取题、幼儿园怪兽、锁定时长 */
import { describe, it, expect } from 'vitest';
import { drawNext, normStem } from '../src/game/draw';
import { newTier, nextTier, isConsolidating, type Tier } from '../src/game/consolidate';
import { pickWithMulti, isMultiSel } from '../src/game/multi';
import { kinderSkin, KINDER_MON } from '../src/game/monsterSkin';
import { DESIGN } from '../src/game/config';
type Q = { key: string; question: string; difficulty: number; type: string; unit: string };
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function mkPool(): Q[] {
  const n = 3 + Math.floor(rnd() * 25); const out: Q[] = [];
  for (let i = 0; i < n; i++) { const dupStem = i > 0 && rnd() < 0.15; out.push({ key: 'q' + i, question: dupStem ? out[Math.floor(rnd() * out.length)].question.replace(/ /g, '  ') : `题 ${i} 的 $x$ ？`, difficulty: 1 + Math.floor(rnd() * 5), type: rnd() < 0.1 ? '多选' : '选择', unit: 'u' }); }
  return out;
}
describe('一局内去重：2000 局', () => {
  it('还有没出过的题（题号和题干都没出过）时，绝不重复；全出过才重复', () => {
    for (let run = 0; run < 2000; run++) {
      // 同 RoundBattle：进局时按题号 + 题干去重
      const ts = new Set<string>(); const pool0 = mkPool().filter(q => !ts.has(normStem(q)) && !!ts.add(normStem(q)));
      let unused = [...pool0], used: Q[] = [], tier: Tier = newTier(1 + Math.floor(rnd() * 4)), mu = 0; const seenStems = new Set<string>();
      const turns = 5 + Math.floor(rnd() * 26);
      for (let t = 1; t <= turns; t++) {
        const P = t % 2 === 1; let recycled = false;
        if (!unused.length) { unused = used; used = []; recycled = true; seenStems.clear(); }
        const ctx = { band: rnd() < 0.5 ? 'J' : 'H', side: (P ? 'P' : 'M') as 'P' | 'M', turn: t, used: mu, poolHas: pool0.some(isMultiSel) };
        const pred = rnd() < 0.2 ? (x: Q) => x.difficulty !== 5 : () => true;   // 对方回合等限制
        const r = drawNext(unused, used, { pred, curated: new Set(pool0.filter(() => rnd() < 0.4).map(q => q.key)), seen: new Set(), tier, multi: (xs, pk) => pickWithMulti(xs, ctx, pk) });
        const q = r.q!; expect(q).toBeTruthy();
        if (!recycled) { expect(r.repeat).toBe(false); expect(seenStems.has(normStem(q))).toBe(false); }
        seenStems.add(normStem(q)); if (isMultiSel(q)) mu++;
        unused = unused.filter(x => x.key !== q.key); if (!used.includes(q)) used.push(q);
        tier = nextTier(tier, rnd() < 0.6);
      }
    }
  });
});
describe('难度回落', () => {
  const mk = (k: string, d: number) => ({ key: k, question: k, difficulty: d, type: '选择', unit: 'u' });
  const T: Tier = { base: 2, tier: 1, right: 0, wrong: 0 };
  it('降档时优先 1 档，哪怕 1 档题不在精选 / 关外没见过分组里', () => {
    const r = drawNext([mk('a', 2), mk('b', 2), mk('c', 1)], [], { pred: () => true, curated: new Set(['a', 'b']), seen: new Set(['c']), tier: T, multi: (xs, pk) => pk(xs) });
    expect(r.q!.key).toBe('c');
  });
  it('答错不升档；降档后要连续答对 2 题才恢复', () => {
    let t = newTier(2); t = nextTier(t, false); t = nextTier(t, false); expect(t.tier).toBe(1);
    t = nextTier(t, false); expect(t.tier).toBe(1); t = nextTier(t, true); t = nextTier(t, false); t = nextTier(t, true); expect(t.tier).toBe(1);
    t = nextTier(t, true); expect(t.tier).toBe(2); expect(isConsolidating(t)).toBe(false);
  });
});
describe('幼儿园', () => {
  it('每个小班科目都有柔和版怪兽（普通级、标了 kinder 学段）', () => {
    for (const s of ['数数', '颜色形状', '认识动物', '生活常识', '儿歌古诗', '英语']) { const k = kinderSkin(s); expect(k, s).toBeTruthy(); expect(k!.art.tier).toBe('normal'); }
    expect(Object.values(KINDER_MON)).not.toContain('mon_chinese_normal');
  });
  it('点错后锁定固定 1.5 s（唯一来源）', () => { expect(DESIGN.kinder.retryUnlockMs).toBe(1500); });
});
import { toggleVol, toggleAllVols, learnedCount, volsValid } from '../src/game/volumes';
import { remainingSec, addBonus, cancelBonus } from '../src/game/playtime';
describe('较真家长：已学册别', () => {
  const all = ['二年级上册', '二年级下册', '通用'];
  it('点掉最后一册 → 一册都不选（不会变回全部），保存时要提示', () => {
    let v = toggleVol(null, '二年级上册', all); v = toggleVol(v, '二年级下册', all); v = toggleVol(v, '通用', all);
    expect(v).toEqual([]); expect(volsValid(v)).toBe(false);
  });
  it('〔全部册别〕全亮 ↔ 全灭；逐册全选上 = 全部', () => {
    expect(toggleAllVols(null)).toEqual([]); expect(toggleAllVols([])).toBeNull(); expect(toggleAllVols(['通用'])).toBeNull();
    expect(toggleVol(['二年级上册', '通用'], '二年级下册', all)).toBeNull();
  });
  it('「已学 X 册」不算通用 / 拓展复习（不分册）', () => {
    expect(learnedCount(['二年级上册', '通用'])).toBe(1); expect(learnedCount(['上册', '拓展复习（不分册）'])).toBe(1);
  });
});
describe('较真家长：临时加时', () => {
  it('上限改成 5 分钟 + 今天临时加 10 分钟 = 15 分钟；取消加时后 5 分钟', () => {
    const d = new Date(2026, 9, 14); const day = '2026-10-14';   // 周三
    const u = addBonus({}, day, 600); const l = { weekday: 5, weekend: 40 };
    expect(remainingSec(l, u, day, d)).toBe(900); expect(remainingSec(l, cancelBonus(u, day), day, d)).toBe(300);
  });
});
