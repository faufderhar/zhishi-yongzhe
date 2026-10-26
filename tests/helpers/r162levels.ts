// r16.2：整份内置题库建关后的关卡快照（id / 题池 / 册 / 名字 / 单元 / Boss 名），用来证明 shortUnit 改动只改了该改的显示名
import { readFileSync, readdirSync } from 'node:fs';
import { loadBank, playable } from '../../src/game/questions';
import { buildChapters } from '../../src/game/levels';
import { skinFor } from '../../src/game/monsterSkin';
import { bandOf } from '../../src/game/grades';

// r17.1：大班 / 初三 / 高三导入后不在 eefc5aa 快照的范围里（快照只管 r16.2 已有的 12 个年级）
export function levelSnapshot() {
  const out: Record<string, { pool: string; volume: string; name: string; unit: string; boss?: string }> = {};
  for (const f of readdirSync('public/banks').filter(f => /^bank_.*\.json$/.test(f) && !/^bank_(K3|9|12)\.json$/.test(f)).sort()) {
    const b = loadBank(JSON.parse(readFileSync('public/banks/' + f, 'utf8')), f);
    for (const ch of buildChapters(playable(b.all, false), null, b.all)) for (const l of ch.levels) {
      const g = l.pool[0]?.split(':')[0];
      out[l.id] = { pool: l.pool.join(','), volume: l.volume, name: l.name, unit: l.unit,
        ...(l.kind === 'boss' ? { boss: skinFor(ch.subject, 'boss', bandOf(g as never), l.unit, { grade: g, volume: l.volume })?.name } : {}) };
    }
  }
  return out;
}
