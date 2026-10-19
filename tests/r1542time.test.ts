// r15.4.2 技术QA P3-6 / 较真家长：收尾后 +10 立刻取消回到「收尾 3:00」；取消先确认；加时已用注明按现在的上限算
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { addUsage as aU, addBonus as aB, cancelBonus as cB, clampUsageAdd as cA, splitUsed as sU, bonusUsedSec as bU, cancelPreview as cP, remainingSec as rS, type Usage as UT } from '../src/game/playtime';
import { cleanUsage } from '../src/game/sanitize';
const D = '2026-10-18';
const play = (u: UT, limitMin: number, sec: number, grace: boolean, step = 5) => { const base = limitMin * 60 + (u[D]?.bonus ?? 0); for (let i = 0; i < sec; i += step) { const add = cA(u[D]?.used ?? 0, step, base, grace); if (add) u = aU(u, D, add, base); } return u; };
const L = 300; const lim = { weekday: 5, weekend: 5 };
describe('r15.4.2 P3-6 收尾不算加时已用', () => {
  it('收尾 3:00 走完 → +10 → 立刻取消：加时已用 0，回到「已用 5:00 + 收尾 3:00」', () => {
    let u: UT = {}; u = play(u, 5, 400, false); u = play(u, 5, 400, true); expect(u[D]).toMatchObject({ used: 480, wrap: 180, wrapTail: 180 });
    u = aB(u, D, 600); expect(bU(u[D], L)).toBe(0); expect(cP(u[D], L)).toEqual({ cancel: 600, leftAfter: 0 });
    const c = cB(u, D, L); expect(c[D].bonus).toBe(0); expect(c[D].used).toBe(480); const s = sU(c[D].used, L + c[D].bonus, c[D].wrap); expect([s.play, s.wrap]).toEqual([300, 180]);
    expect(rS(lim, c, D, new Date('2026-10-18T10:00:00'))).toBe(0);
  });
  it('反复 +10 / 取消 3 次：used 不变（不再每次 +1 秒），bonus 回到 0', () => {
    let u: UT = {}; u = play(u, 5, 400, false); u = play(u, 5, 400, true);
    for (let i = 0; i < 3; i++) { u = aB(u, D, 600); u = cB(u, D, L); expect(u[D].used).toBe(480); expect(u[D].bonus).toBe(0); }
    // 取消后剩 0，地图上的计时（不在收尾）一秒都记不上
    u = play(u, 5, 30, false, 1); expect(u[D].used).toBe(480);
  });
  it('收尾后用加时玩了一会儿：那段收尾按「先抵掉超出的部分」算用掉的加时（与 r15.4.1 场景 A 一致）', () => {
    let u: UT = {}; u = play(u, 5, 400, false); u = play(u, 5, 400, true); u = aB(u, D, 600); u = play(u, 5, 120, false);
    expect(u[D].used).toBe(600); expect(u[D].wrapTail).toBeUndefined(); expect(bU(u[D], L)).toBe(300);
    expect(cP(u[D], L)).toEqual({ cancel: 300, leftAfter: 0 }); const c = cB(u, D, L); expect(rS(lim, c, D, new Date('2026-10-18T10:00:00'))).toBe(0);
  });
  it('较真家长第二次 +10：之前的 0:10 收尾之后没再玩，不算加时', () => {
    let u: UT = { [D]: { used: 900, bonus: 600, wrap: 10, wrapTail: 10 } }; u = { [D]: { ...u[D], used: 910 } };
    u = aB(u, D, 600); expect(bU(u[D], L)).toBe(600);
  });
  it('没用完就 +10，取消后剩余 = 原上限 - 已用', () => { let u: UT = {}; u = play(u, 5, 200, false); u = aB(u, D, 600); expect(cP(u[D], L)).toEqual({ cancel: 600, leftAfter: 100 }); });
  it('不限：取消后剩余不限', () => { expect(cP({ used: 100, bonus: 600 }, 0).leftAfter).toBe(Infinity); });
  it('wrapTail 清洗 0–180；读取也封顶', () => { expect((cleanUsage({ [D]: { used: 1, bonus: 0, wrapTail: 1e308 } }) as any)[D].wrapTail).toBe(180); expect(readFileSync('src/state.ts', 'utf8')).toMatch(/wrapTail: Math\.min\(180/); });
});
describe('r15.4.2 较真家长：取消确认框', () => {
  const src = readFileSync('src/ui/Parent.tsx', 'utf8');
  it('时长页「取消没用的」先弹确认，确认框写取消后今天还能玩多久', () => {
    expect(src).toMatch(/data-testid=\{'bonus-cancel-' \+ p\.id\} onClick=\{\(\) => setCc\(/);
    expect(src).toMatch(/data-testid="bonus-cancel-confirm"[\s\S]{0,400}今天还能玩 <b data-testid="bonus-cancel-left">/);
    expect(src).toMatch(/bonus-cancel-ok[^\n]*cancelBonus\(usage\[c\.pid\]/);
  });
  it('编辑页「取消今天没用的加时」也先确认', () => { expect(src).toMatch(/data-testid="bonus-cancel" onClick=\{\(\) => setAskCancel\(true\)\}/); expect(src).toMatch(/bonus-cancel-ok" onClick=\{\(\) => \{ setAskCancel\(false\); onCancelBonus/); });
  it('r15.4.4 较真家长：「按现在的每日上限计算」删掉了（上限改大后加时已用数不变，这半句反而让人误会）', () => { expect(src).not.toMatch(/按现在的每日上限/); expect(src).toContain('（已经用掉的部分会留下）'); });
  it('按钮上的时间每秒重算', () => { expect(src).toMatch(/setInterval\(\(\) => setTick\(x => x \+ 1\), 1000\)/); });
});
describe('r15.4.2 较真家长 A：小班时间到结算页 🔊', () => {
  const src = readFileSync('src/ui/Screens.tsx', 'utf8');
  it('强制结算页和收尾里打完的结算页都有 kspeaker 重放按钮', () => {
    expect(src.match(/className="kspeaker" aria-label="再听一遍" data-testid="timeup-replay"/g)!.length).toBe(2);
    expect(src).toMatch(/data-testid="timeup-replay" onClick=\{\(\) => speak\(TIMEUP_K_TEXT\)\}/);
  });
});
describe('r15.4.2 较真家长 B：恢复确认框文案', () => {
  const src = readFileSync('src/ui/Parent.tsx', 'utf8'); const css = readFileSync('src/app.css', 'utf8');
  it('占位文字缩短、输入框占满；不再出现被截断的长占位', () => { expect(src).not.toMatch(/placeholder="备份时的家长密码 \/ 恢复码"/); expect(src.match(/placeholder="备份时的密码或恢复码"/g)!.length).toBe(2); expect(css).toMatch(/\.restore-alt \.restore-bsec\{width:100%/); });
  it('「忘了现在的密码？」短句分行', () => { expect(src).toMatch(/忘了现在的密码？<\/b><p className="hint">填<b>备份时<\/b>的家长密码，或那时的 8 位恢复码。<\/p><p className="hint">连续错 5 次锁 24 小时。<\/p>/); });
  it('「会被替换」缩短，仍不含今天时长', () => { const m = src.match(/restore-will-replace"><b>会被替换：<\/b>([^<{]*)/)![1]; expect(m.length).toBeLessThan(45); expect(m).not.toMatch(/今天/); });
  it('合并 / 覆盖恢复各一句什么时候用', () => { expect(src).toMatch(/data-testid="when-merge"><b>合并：<\/b>[^<]*时用/); expect(src).toMatch(/data-testid="when-overwrite"><b>覆盖恢复：<\/b>[^<]*时用/); });
});
