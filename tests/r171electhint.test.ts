// r17.1 学霸 r17-11（r16.1 裁定 §6）：高二 / 高三「默认全科」三处提示文案 + electNote 只由〔添加孩子〕打上、刷新保留、进地图清掉
const mem = new Map<string, string>(); (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() };
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ELECT_ADD_HINT, ELECT_UPGRADE_HINT, electMapNote } from '../src/game/electives';
import { newProfile, repairProfile, DEFAULT_PROFILES } from '../src/state';
const src = (f: string) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');

describe('§6 文案', () => {
  it('三处原文', () => {
    expect(ELECT_ADD_HINT).toBe('高二、高三默认「还没选科（全科）」，所有科目都能玩；已经选了科，到「家长 → 编辑档案 → 选科」里改。');
    expect(electMapNote(9)).toBe('已按「还没选科（全科）」建好：9 个科目都能玩，Boss 没有弱点加成。选了科？到「家长 → 编辑档案 → 选科」里改。');
    expect(ELECT_UPGRADE_HINT).toBe('升到高二后默认「还没选科（全科）」。孩子已经选科的话，在下面选「已选科」。');
  });
});
describe('electNote', () => {
  it('newProfile / 默认档案都不带（旧档、恢复不提示）', () => {
    for (const g of ['10', '11', '12'] as const) expect(newProfile('a', g).electNote).toBeUndefined();
    for (const p of DEFAULT_PROFILES()) expect(p.electNote).toBeUndefined();
  });
  it('repairProfile 只保留 true', () => {
    const p = newProfile('a', '11');
    expect(repairProfile({ ...p, electNote: true })?.electNote).toBe(true);
    expect(repairProfile({ ...p, electNote: 'yes' })?.electNote).toBeUndefined();
    expect(repairProfile(p)?.electNote).toBeUndefined();
  });
  it('源码：添加孩子按 needsElectives 打标；地图提示后清掉；家长编辑只在 ≤10 → ≥11 且没选科时出', () => {
    expect(src('ui/Screens.tsx')).toMatch(/needsElectives\(g\) \? \{ electNote: true \}/);
    expect(src('ui/Screens.tsx')).toContain('data-testid="add-hint-elect"');
    const app = src('App.tsx');
    expect(app).toMatch(/screen\.s !== 'map' \|\| !p0\?\.electNote/); expect(app).toContain('electNote: undefined'); expect(app).toContain('data-testid="elect-note"');
    expect(src('ui/Parent.tsx')).toMatch(/needsElectives\(f\.grade\) && !needsElectives\(p\.grade\) && !p\.electives/);
  });
});
