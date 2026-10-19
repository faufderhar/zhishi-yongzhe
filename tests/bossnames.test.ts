// r15.3 策划：初一 / 高一每一章 Boss 名字都不同，也不和别的怪物重名；同一美术各章主色不同（永久测试）
import { it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
import { skinFor, SKINS, BOSS_NAME, CHAPTER_BOSS, chapterBoss } from '../src/game/monsterSkin';
import MANIFEST from '../src/game/monsters.manifest.json';
const bare = (n: string) => n.replace(/^[^·]+·/, '');
// r15.4.4：题库 v32 新增的高一章节（生物必修2、政治必修3、历史纲要下、地理必修第二册、化学专题8–9）还没有策划给的 Boss 名（R-5，r16 补），
// 暂用本科目通用 Boss 名——这些章不参加重名 / 主色检查，数量钉死（补名后改成 0）。
// v33：纲要上第六、第八单元补题后够 12 题，第一次有章节 Boss，同样暂用通用名（+2）
const GENERIC_OK: Record<string, number> = { '7': 0, '10': 32 };
const NEW_V32 = (s: string, v: string, u: string) => (s === '生物' && v === '必修第二册') || (s === '政治' && v === '必修第三册') || (s === '历史' && v === '必修下册') || (s === '地理' && v === '必修第二册') || (s === '化学' && /^专题[89]/.test(u))
  || (s === '历史' && v === '必修上册' && /^第[六八]单元/.test(u));   // v33
for (const [g, band, label] of [['7', 'J', '初一'], ['10', 'H', '高一']] as const) {
  it(`${label}：章节 Boss 不重名、不和其他怪物重名、同一美术主色各不相同`, () => {
    const all = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all; const qs = playable(all, false);
    const names: string[] = []; const hues = new Map<string, string[]>(); let generic = 0;
    for (const ch of buildChapters(qs, null, all)) for (const l of ch.levels.filter(l => l.kind === 'boss')) {
      const sk = skinFor(ch.subject, 'boss', band, l.unit)!; expect(sk, `${ch.subject} ${l.unit}`).toBeTruthy();
      if (!chapterBoss(band, ch.subject, l.unit) && NEW_V32(ch.subject, l.volume, l.unit)) { generic++; continue; }
      names.push(bare(sk.name));
      const k = sk.art.id; hues.set(k, [...(hues.get(k) ?? []), String(sk.hue ?? 0)]);
      // 战斗里用题目路径取名也一样（关卡没传 unit 时的回退）
      const q0 = qs.find(q => q.key === l.pool[0]); if (q0?.unit?.includes(l.unit.split(' ')[0])) expect(skinFor(ch.subject, 'boss', band, q0.unit)!.name).toBe(sk.name);
    }
    expect(generic, '没有专属名字的章节 Boss（R-5）').toBe(GENERIC_OK[g]);
    const dup = names.filter((n, i) => names.indexOf(n) !== i); expect(dup, '重名').toEqual([]);
    const others = new Set([...Object.values(MANIFEST as Record<string, { name: string }>).map(a => a.name), ...Object.values(SKINS).flatMap(t => [t.normal.name, t.elite.name]), ...Object.values(BOSS_NAME).flatMap(Object.values)]);
    for (const t of Object.keys(BOSS_NAME[band]) as (keyof typeof BOSS_NAME['J'])[]) if (names.filter(n => n === BOSS_NAME[band][t]).length <= 1) others.delete(BOSS_NAME[band][t]);   // 只剩一章的科目沿用本学段默认 Boss 名，不算撞名
    expect(names.filter(n => others.has(n)), '和其他怪物重名').toEqual([]);
    for (const [id, hs] of hues) expect(hs.filter((h, i) => hs.indexOf(h) !== i), `${id} 主色重复`).toEqual([]);
  });
}
it('策划清单 72 个新名全部用上、彼此不同', () => {
  expect(CHAPTER_BOSS.filter(r => r[6] === undefined).length).toBe(72);   // r16：对照表生成的行（带册别）另算
  const f = '/workspace/playtest/Boss重名清单.csv'; if (!existsSync(f)) return; const csv = readFileSync(f, 'utf8').trim().split('\n').slice(1).map(r => r.split(',').at(-1)!.trim());
  if (csv.length) expect(new Set(CHAPTER_BOSS.filter(r => r[6] === undefined).map(r => r[4]))).toEqual(new Set(csv));
});
