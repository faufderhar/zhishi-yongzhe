import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters, volRank, volShort } from '../src/game/levels';
// r16 2c：中班 / 初二 / 高二 册内小节按题库顺序；高二册别顺序（R-3）；同名「古诗词诵读」按册区分；旧年级地图不变
const load = (g: string) => { const b = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`); return { b, qs: playable(b.all, false) }; };
describe('r16 sections', () => {
  for (const g of ['K2', '8', '11']) it(`${g} lessons follow bank order within volume`, () => {
    const { b, qs } = load(g);
    for (const c of buildChapters(qs, null, b.all)) {
      const seen: string[] = [];
      for (const v of c.volumes) for (const q of qs.filter(q => q.subject === c.subject && q.volume === v && (q as { usage?: string }).usage !== 'boss')) { const k = q.volume + '|' + q.unit; if (!seen.includes(k)) seen.push(k); }
      const lv: string[] = [];
      for (const l of c.levels) if (l.kind === 'normal' && l.lesson) { const [v, ...r] = l.lesson.split('|'); for (const u of r.join('|').split('+')) { const k = v + '|' + u; if (!lv.includes(k)) lv.push(k); } }
      expect(lv, `${g} ${c.subject}`).toEqual(seen);
    }
  });
  it('高二 volume order: 必修四 → 选必一/上 → 选必二/中', () => {
    expect(['选择性必修第二册', '选择性必修第一册', '必修第四册'].sort((a, b) => volRank(a) - volRank(b))).toEqual(['必修第四册', '选择性必修第一册', '选择性必修第二册']);
    expect(volRank('选择性必修上册')).toBeLessThan(volRank('选择性必修中册'));
    const { b, qs } = load('11');
    expect(buildChapters(qs, null, b.all).find(c => c.subject === '政治')!.volumes).toEqual(['必修第四册', '选择性必修第一册', '选择性必修第二册']);
    expect(volShort('选择性必修上册')).toBe('选必上'); expect(volShort('选择性必修第一册')).toBe('选必一');
  });
  it('高二诗词「古诗词诵读」两册的章名、关名不同', () => {
    const { b, qs } = load('11');
    const po = buildChapters(qs, null, b.all).find(c => c.subject === '诗词')!;
    const units = [...new Set(po.levels.filter(l => /古诗词诵读/.test(l.unit ?? '')).map(l => `${l.volume}|${l.unit}`))];
    expect(units).toEqual(['选择性必修上册|古诗词诵读（选必上）', '选择性必修中册|古诗词诵读（选必中）']);
    const names = po.levels.filter(l => l.kind === 'normal' && /古诗词诵读/.test(l.name)).map(l => l.name);
    expect(new Set(names).size).toBe(names.length);
  });
  // r16.1 (h)：初一「基础积累（字词·病句）」、高一「拓展（课外·毛泽东诗词）」的关名 / 显示单元名不再在括号里截断（原来是「病句）」「毛泽东诗词）」），
  // r16.1 (o) 题库 v47：5 / 6 年级只多了 5B / 6B Unit 1 普通关，本册 Boss 换 id（旧 id 作别名，tests/r161v47.test.ts），已有关卡不变——5 / 6 的指纹按此更新
  // 7 / 10 的指纹按此更新；逐关对比确认只有这 2 关的 name / unit 变了，id / 题池 / 章不变（tests/r161titles.test.ts）
  // r16.2：题名本身带「·」不再截断（四下「古诗词 清平乐·村居」、六下「汤姆·索亚历险记」、高一「沁园春·长沙」）——4 / 6 / 10 的指纹按此更新；
  //   逐关对比确认只有这 3 关（+ 高二 1 关）的 name / unit 变了，id / 题池 / 册 / Boss 名不变（tests/r162dotnames.test.ts）
  it('existing grades: chapters / level ids / names unchanged', () => {
    const want = JSON.parse(readFileSync('tests/fixtures/r16_old_levels.json', 'utf8')) as Record<string, string>;
    for (const g of Object.keys(want)) {
      const { b, qs } = load(g); const chs = buildChapters(qs, null, b.all);
      expect(createHash('sha1').update(JSON.stringify(chs.map(c => [c.subject, c.volumes, c.levels.map(l => [l.id, l.name, l.unit, l.volume])]))).digest('hex'), g).toBe(want[g]);
    }
  });
});
