/* r8b：两级入口数据、技能音效清单 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { STAGES, stageOf, needsGate, defaultPick } from '../src/game/stages';
import { BUILTIN_GRADES } from '../src/bankStore';
import { SKILL_DATA as SKILLS } from '../src/game/skills.data';
import { isSkillSfxId } from '../src/fx/assets';
describe('r8b 学段 → 年级', () => {
  it('4 个学段；有题库的年级可进，初二/初三/高二/高三锁定', () => {
    expect(STAGES.map(s => s.label)).toEqual(['幼儿园', '小学', '初中', '高中']);
    const all = STAGES.flatMap(s => s.grades);
    expect(all.filter(g => g.grade).map(g => g.grade).sort()).toEqual([...BUILTIN_GRADES].sort());
    expect(all.filter(g => !g.grade).map(g => g.label)).toEqual(['初二', '初三', '高二', '高三']);
    for (const g of BUILTIN_GRADES) expect(existsSync(new URL(`../public/banks/bank_${g}.json`, import.meta.url))).toBe(true);
  });
  it('学段归属、默认选择、家长确认', () => {
    expect(['K1', '3', '7', '10'].map(stageOf)).toEqual(['K', 'P', 'J', 'H']);
    expect(defaultPick('5')).toBe('5'); expect(defaultPick('5', '10')).toBe('10'); expect(defaultPick('5', '8')).toBe('5');   // 锁定年级不会成为默认
    expect(needsGate('5', '5')).toBe(false); expect(needsGate('5', '10')).toBe(true);
  });
});
describe('r8b 技能音效：85 个技能都按 ID 有文件，小班有 kindergarten 版', () => {
  const man = JSON.parse(readFileSync(new URL('../public/sfx/skills-manifest.json', import.meta.url), 'utf8')).skills as Record<string, { file: string; kindergarten?: string; stage: string }>;
  it('每个技能 ID 都在清单里、文件存在；k_ 开头的有 kindergarten 文件', () => {
    const ids = (SKILLS as { id: string }[]).map(k => k.id); expect(ids.length).toBe(85);
    for (const id of ids) {
      expect(isSkillSfxId(id)).toBe(true); const e = man[id]; expect(e, id).toBeTruthy();
      expect(existsSync(new URL('../public/sfx/' + e.file, import.meta.url)), e.file).toBe(true);
      if (id.startsWith('k_')) { expect(e.kindergarten).toMatch(/^skills\/kindergarten\//); expect(existsSync(new URL('../public/sfx/' + e.kindergarten, import.meta.url))).toBe(true); }
    }
  });
});
