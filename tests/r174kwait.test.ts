// r17.4 小萌新 r17.3：题间放技能（「算算·积木城堡」横幅）时等下一题 4.8–6.1 s（无技能 2–2.7 s）。
// 现在放技能只读技能名（不再「表扬 + 技能名」两段），普通题上限 nextMax = 4 s；技能名本身最长那段 + margin 仍在上限内，不被下一题切掉。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { kCorrectLine, kWaitCap, K_WAIT } from '../src/ui/Battle';
import { sysEstimateMs } from '../src/tts';
const src = readFileSync(new URL('../src/ui/Battle.tsx', import.meta.url), 'utf8');
const man = JSON.parse(readFileSync('public/voice/manifest.json', 'utf8'));
const L = { praise: '太厉害了！', skillLine: '算算的积木城堡！', friendLine: '小乌云变成你的好朋友啦！' };
describe('r17.4 放技能时的题间等待', () => {
  it('放技能：只读技能名；没技能：读表扬；最后一题不变（技能名 + 好朋友）', () => {
    expect(kCorrectLine({ ...L, last: false })).toBe('算算的积木城堡！');
    expect(kCorrectLine({ ...L, last: false, skillLine: '' })).toBe('太厉害了！');
    expect(kCorrectLine({ ...L, last: true })).toBe('算算的积木城堡！小乌云变成你的好朋友啦！');
    expect(kCorrectLine({ ...L, last: true, skillLine: '' })).toBe('小乌云变成你的好朋友啦！');
  });
  it('录音：所有技能名单段 + margin ≤ 3.5 s（和只有表扬的题一样的上限）', () => {
    const ks = Object.keys(man.meta).filter(k => k.startsWith('p:sk_k_')); expect(ks.length).toBeGreaterThan(10);
    for (const k of ks) expect(kWaitCap(K_WAIT.nextCap, man.meta[k].duration * 1000)).toBe(K_WAIT.nextCap);
  });
  it('系统朗读：普通题上限封顶 nextMax = 4 s（以前「表扬 + 技能名」估时 + margin ≈ 5.6 s）', () => {
    expect(K_WAIT.nextMax).toBe(4000);
    const old = kWaitCap(K_WAIT.nextCap, sysEstimateMs('太厉害了！算算的积木城堡！', 0.72)); expect(old).toBeGreaterThan(5000);
    const now = Math.min(K_WAIT.nextMax, kWaitCap(K_WAIT.nextCap, sysEstimateMs('算算的积木城堡！', 0.72))); expect(now).toBeLessThanOrEqual(4000);
    expect(src).toMatch(/!last && r !== 'demo' \? Math\.min\(K_WAIT\.nextMax, c\)/);
    expect(src).toMatch(/spoken = kCorrectLine\(\{ last, praise, skillLine, friendLine \}\)/);
  });
});
