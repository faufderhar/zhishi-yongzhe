// r16.1 [HIGH] 高二选科：「还没选科（全科）」默认；全部科目可玩、R-13 无弱点；家长页可改；旧档案不变；备份 / 恢复 / 清洗认新值
import 'fake-indexeddb/auto';
const mem = new Map<string, string>(); (globalThis as any).localStorage ??= { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear() };
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanElectives, electivesValid, isAllSubjects, needsElectives, electivesLabel } from '../src/game/electives';
import { bossWeak } from '../src/game/rounds';
import { newProfile, repairProfile } from '../src/state';
import { cleanProfiles } from '../src/game/sanitize';
import { exportAll, importAll, setKV, getKV } from '../src/db';

describe('默认与规则', () => {
  it('高二及以上新档案默认「还没选科（全科）」；高一及以下没有选科', () => {
    expect(newProfile('a', '11').electives).toEqual({ all: true }); expect(newProfile('a', '12').electives).toEqual({ all: true });
    for (const g of ['K1', '1', '7', '8', '10'] as const) expect(newProfile('a', g).electives, g).toBeUndefined();
    expect(needsElectives('11')).toBe(true); expect(needsElectives('10')).toBe(false); expect(needsElectives('K2')).toBe(false);
  });
  it('全科 → Boss 两阶段都没有弱点；已选科照 R-13', () => {
    for (const s of ['物理', '化学', '语文', '地理']) expect(bossWeak('11', s, { all: true })).toEqual([undefined, undefined]);
    expect(bossWeak('11', '地理', undefined)).toEqual([undefined, undefined]);
    expect(bossWeak('11', '地理', { first: '物理', second: ['化学', '地理'] })).toEqual(['地理', '物理']);
    expect(bossWeak('10', '数学', { all: true })).toBeNull();
  });
  it('能不能保存', () => {
    expect(electivesValid({ all: true })).toBe(true); expect(electivesValid(undefined)).toBe(true);
    expect(electivesValid({ first: '物理', second: ['化学', '生物'] })).toBe(true);
    expect(electivesValid({ first: '物理', second: ['化学'] })).toBe(false); expect(electivesValid({ first: '化学', second: ['生物', '地理'] })).toBe(false);
    expect(electivesValid({ second: ['生物', '地理'] })).toBe(false); expect(electivesValid({ first: '历史', second: ['生物', '生物'] })).toBe(false);
    expect(electivesLabel({ all: true })).toBe('还没选科（全科）'); expect(electivesLabel({ first: '历史', second: ['政治', '地理'] })).toBe('历史 + 政治 + 地理');
  });
  it('清洗：合法的原样留；乱值去掉；什么都不剩 = 全科', () => {
    expect(cleanElectives({ all: true })).toEqual({ all: true });
    expect(cleanElectives({ first: '物理', second: ['化学', '地理'] })).toEqual({ first: '物理', second: ['化学', '地理'] });
    expect(cleanElectives({ first: '化学', second: ['x', '生物', '生物', '政治', '地理'] })).toEqual({ second: ['生物', '政治'] });
    expect(cleanElectives({ first: 1, second: 'x' })).toEqual({ all: true });
    expect(cleanElectives('all')).toBeUndefined(); expect(cleanElectives(null)).toBeUndefined();
    expect(isAllSubjects(cleanElectives({}))).toBe(true);
  });
  it('读档（repairProfile）留住选科（r16 会丢掉）；旧档案没有选科 = 全科、不补写', () => {
    const base = { id: 'x', name: 'a', avatar: '🧒', grade: '11', volumes: null, limit: { weekday: 45, weekend: 60 } };
    expect(repairProfile({ ...base, electives: { first: '物理', second: ['化学', '地理'] } })!.electives).toEqual({ first: '物理', second: ['化学', '地理'] });
    expect(repairProfile({ ...base, electives: { all: true } })!.electives).toEqual({ all: true });
    expect(repairProfile(base)!.electives).toBeUndefined();
    expect((cleanProfiles([{ ...base, electives: { all: true, junk: 1 } }]) as any[])[0].electives).toEqual({ all: true });
  });
});
it('备份 → 恢复：全科和已选科都原样回来', async () => {
  const ps = [{ ...newProfile('全科', '11'), id: 'a' }, { ...newProfile('选了', '11'), id: 'b', electives: { first: '历史', second: ['政治', '地理'] } }];
  await setKV('settings', { includePending: false }); await setKV('profiles', ps);
  const bk = await exportAll(); await setKV('profiles', []); await importAll(bk, { trusted: true });
  const got = await getKV<any[]>('profiles');
  expect(got!.find(p => p.id === 'a').electives).toEqual({ all: true }); expect(got!.find(p => p.id === 'b').electives).toEqual({ first: '历史', second: ['政治', '地理'] });
});
it('界面：家长页档案编辑有选科（高二起），新建档案不用选科就能建', () => {
  const s = readFileSync('src/ui/Parent.tsx', 'utf8');
  expect(s).toMatch(/needsElectives\(f\.grade\) && <ElectivesPicker/); expect(s).toMatch(/data-testid="el-all"/); expect(s).toMatch(/还没选科（全科）/);
  const h = readFileSync('src/ui/Screens.tsx', 'utf8'); expect(h).toMatch(/onAdd\(\{ \.\.\.newProfile\(/);
});
