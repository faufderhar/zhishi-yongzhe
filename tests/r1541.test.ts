// r15.4.1 热修单元测试
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { newRound, resolveRound, estimateDealt } from '../src/game/rounds';
import { PUPS } from '../src/game/characters';
import { LK_CANCEL, LK_REC } from '../src/game/pin';
import { PEND_GAP_CAP_MS, NET_SKEW_MS } from '../src/game/pinVault';
import { voiceFiles } from '../src/offlineCache';
import { cleanAnswer, cleanWrong, cleanFlags } from '../src/game/sanitize';
import { minusOk, addNumKey } from '../src/game/keypad';
import { addUsage as aU, addBonus as aB, cancelBonus as cB, clampUsageAdd as cA, splitUsed as sU, bonusUsedSec as bU, remainingSec as rS, graceBudgetMs as gB, fmtMS as fm, type Usage as UT } from '../src/game/playtime';
import { cleanUsage } from '../src/game/sanitize';
import { VOICE_PROMPTS } from '../src/game/voicePrompts';
describe('学霸：初一怪物护盾', () => {
  const c = PUPS[0];
  it('护盾 10 真的挡掉 10 点；预计伤害是挡完以后的数；护盾打完清零', () => {
    const s0 = { ...newRound('j', 'normal'), side: 'P' as const, monsterHp: 999, monsterMax: 999, shield: 0 };
    const s1 = { ...s0, shield: 10 };
    const inp = { subject: '数学', difficulty: 2, card: 'std' as const };
    const raw = estimateDealt(s0, c, inp), est = estimateDealt(s1, c, inp);
    expect(raw).toBeGreaterThan(10); expect(est).toBe(raw - 10);
    const [n, o] = resolveRound(s1, c, { ...inp, correct: true, noSkill: true, rng: () => 0.999 });
    expect(o.dealt).toBe(est); expect(o.absorbed).toBe(10); expect(n.shield).toBe(0); expect(n.monsterHp).toBe(999 - est); expect(o.text).toMatch(/护盾挡掉 10 点/);
  });
  it('初一没有押注：只有高一（mode h）进入押注阶段', () => {
    const src = readFileSync('src/ui/RoundBattle.tsx', 'utf8');
    expect(src).toMatch(/const hs = mode === 'h'/); expect(src).toMatch(/setPhase\(hs && wagerOn && P \? 'bet' : 'question'\)/);   // r15.4.2：押注开关
    expect(src).toMatch(/wager: hs && P && wagerOn \? wager : false/);
  });
});
describe('技术QA', () => {
  it('取消框和恢复码各自计数', () => { expect(LK_CANCEL).not.toBe(LK_REC); });
  it('「为什么要等 3 天」新加的两条和代码一致：12 小时、10 分钟', () => { expect(PEND_GAP_CAP_MS).toBe(12 * 3600e3); expect(NET_SKEW_MS).toBe(10 * 60e3); });
  it('1e308 时间戳夹到不晚于现在', () => {
    const now = Date.now();
    expect(cleanAnswer({ at: 1e308, correct: true })!.at).toBeLessThanOrEqual(Date.now()); expect(cleanAnswer({ at: 1e308 })!.at).toBeGreaterThanOrEqual(now - 1000);
    const wv = cleanWrong({ box: 2, wrongCount: 1, addedAt: 1e308, updatedAt: 5e12 }) as { addedAt: number; updatedAt: number }; expect(wv.addedAt).toBeLessThanOrEqual(Date.now()); expect(wv.updatedAt).toBeLessThanOrEqual(Date.now());
    expect(Object.values(cleanFlags({ a: 1e308 })!)[0]).toBeLessThanOrEqual(Date.now());
  });
  it('离线录音列表：manifest 里所有 mp3（去重，分段数组展开）', () => {
    const man = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8'));
    const f = voiceFiles(man.items); expect(f.length).toBeGreaterThan(400); expect(new Set(f).size).toBe(f.length); expect(f.every(x => /\.mp3$/.test(x))).toBe(true);
    expect(voiceFiles({ a: 'x.mp3', b: ['y.mp3', 'x.mp3'], c: 'z.txt' })).toEqual(['x.mp3', 'y.mp3']);
    expect(readFileSync('src/App.tsx', 'utf8')).toMatch(/cacheVoiceForOffline/);
  });
});
describe('学霸：键盘负号', () => {
  it('r15.4.2：- 仍只在数的开头；已有数字时按 - 切换这个数的正负（不再弹「负号要先按」）', () => {
    expect(addNumKey('3', '-')).toBe('-3'); expect(addNumKey('-3', '-')).toBe('3'); expect(minusOk('3')).toBe(false); expect(addNumKey('', '-')).toBe('-');
    expect(readFileSync('src/ui/common.tsx', 'utf8')).not.toMatch(/负号要先按/);
  });
});
describe('小萌新：小班 emoji 选项', () => {
  it('只有 emoji 的选项排成网格，按卡片大小缩放', () => {
    const src = readFileSync('src/ui/Battle.tsx', 'utf8'), css = readFileSync('src/app.css', 'utf8');
    expect(src).toMatch(/className="kcount"/); expect(css).toMatch(/\.kopt\{container-type:size\}/); expect(css).toMatch(/\.kcount-i\{[^}]*cqw[^}]*cqh/);
  });
});

/* r15.4.1 较真家长：小班上限 5 分钟用完 → 两次「+10 分钟」都玩完 → 家长把上限改回 15、点「取消今天的临时加时」。
   以前：加时整笔清零，已经玩掉的 20 分钟加时全被算成「收尾」（家长页「已用 15:00 + 收尾 23:00」）。现在：只取消没用的；收尾永远 ≤ 3:00 */
describe('r15.4.1 加时用完 → 改上限 → 取消加时', () => {
  const D = '2026-10-19'; const wd = new Date('2026-10-19T10:00:00');   // 周一
  const play = (u: UT, limitMin: number, sec: number, grace: boolean) => { const base = limitMin * 60 + (u[D]?.bonus ?? 0); for (let i = 0; i < sec; i += 5) { const add = cA(u[D]?.used ?? 0, 5, base, grace); if (add) u = aU(u, D, add, base); } return u; };
  it('只取消没用的部分；收尾 ≤ 3:00；加时已用单独显示', () => {
    let u: UT = {};
    u = play(u, 5, 400, false); u = play(u, 5, 400, true);              // 5:00 + 收尾 3:00
    expect(u[D].used).toBe(480); expect(u[D].wrap).toBe(180);
    u = aB(u, D, 600); u = play(u, 5, 900, false); u = play(u, 5, 400, true);   // +10 用完 + 收尾
    u = aB(u, D, 600); u = play(u, 5, 900, false); u = play(u, 5, 400, true);   // 再 +10 用完 + 收尾
    expect(u[D].used).toBe(1680); expect(u[D].bonus).toBe(1200);
    // 家长把上限改回 15，取消加时
    // 不改上限直接取消：两次加时都用完了，什么都不取消；收尾 3:00 单独显示
    const c5 = cB(u, D, 300); expect(c5[D].bonus).toBe(1200); const s5 = sU(c5[D].used, 300 + 1200, c5[D].wrap); expect(`已用 ${fm(s5.play)} + 收尾 ${fm(s5.wrap)}`).toBe('已用 25:00 + 收尾 3:00');
    const L = 15 * 60; expect(bU(u[D], L)).toBe(600);   // 按家长改后的 15 分钟上限算，加时用掉 10:00（r15.4.2：最后那段刚走完的收尾 3:00 不算加时）
    const c = cB(u, D, L); expect(c[D].bonus).toBe(600); expect(c[D].used).toBe(1680);
    const sp = sU(c[D].used, L + c[D].bonus, c[D].wrap);
    expect(sp.wrap).toBeLessThanOrEqual(180); expect(`已用 ${fm(sp.play)} · 加时已用 ${fm(bU(c[D], L))}`).toBe('已用 25:00 · 加时已用 10:00'); expect(sp.over).toBe(0);
    expect(sU(u[D].used, L, u[D].wrap).wrap).toBe(180);   // 旧做法（整笔清零）现在也最多显示收尾 3:00，不再是 13:00 / 23:00
    // 再取消一次：没有可取消的了
    expect(cB(c, D, L)[D].bonus).toBe(600);
  });
  it('没用的加时会取消：+10 只玩了 2 分钟就取消 → 剩下的 8 分钟没了', () => {
    let u: UT = {}; u = play(u, 5, 300, false); u = aB(u, D, 600); u = play(u, 5, 120, false);
    expect(bU(u[D], 300)).toBe(120); const c = cB(u, D, 300); expect(c[D].bonus).toBe(120); expect(rS({ weekday: 5, weekend: 5 }, c, D, wd)).toBe(0);
  });
  it('旧算法的「收尾 23:00」不会再出现：任何上限 / 加时组合下收尾 ≤ 3:00', () => {
    for (const used of [0, 300, 900, 1680, 2280, 5000]) for (const base of [300, 900, 1500, 2100]) for (const w of [undefined, 0, 180, 540, 1380]) expect(sU(used, base, w).wrap).toBeLessThanOrEqual(180);
    const old = sU(2280, 900); expect(old.wrap).toBe(180); expect(old.play + old.wrap).toBe(2280);   // 旧记录没有 wrap：同样封顶，其余算已用
  });
  it('不限时：取消就是整笔取消', () => { let u: UT = aB({}, D, 600); u = aU(u, D, 100); expect(cB(u, D, 0)[D].bonus).toBe(0); });
});

describe('r15.4.1 小班时间到结算页 / 录音', () => {
  it('「今天玩够啦，明天见」登记成提示语 p:timeup_k，并且已经有录音（manifest）', () => {
    expect(VOICE_PROMPTS.timeup_k).toBe('今天玩够啦，明天见');
    const m = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8'));
    for (const k of ['p:timeup_k', 'p:grace', 'p:sleepy']) { expect(m.items[k]).toMatch(/\.mp3$/); expect(m.meta[k].voice).toBe('zf_002'); expect(m.meta[k].speed).toBe(m.speeds.prompts); /* r15.4.4：跟录音包的语速（1.5 → 1.2） */ }
  });
  it('结算页：小班时间到不显示星星比较，自动朗读', () => {
    const src = readFileSync('src/ui/Screens.tsx', 'utf8');
    expect(src).toMatch(/!kTime && cfg.band !== 'K' && !capped && prevBest !== undefined/); expect(src).toMatch(/speak\(TIMEUP_K_TEXT\)/);
  });
  it('备份 / 读回时保留 wrap 字段', () => { expect(cleanUsage({ d: { used: 100, bonus: 0, wrap: 30 } })).toEqual({ d: { used: 100, bonus: 0, wrap: 30 } }); expect(cleanUsage({ d: { used: 100, bonus: 0 } })).toEqual({ d: { used: 100, bonus: 0 } }); });
});
