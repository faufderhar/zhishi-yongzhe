// 关卡题池导出（发布新题库前生成迁移表用）：DUMP_DIR=<banks 目录> DUMP_OUT=<json> npx vitest run tests/_dump.test.ts
import { test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
test.skipIf(!process.env.DUMP_OUT)('dump', () => {
  const out: Record<string, { kind: string; pool: string[]; parts: string[]; aliases: string[] }> = {};
  for (const g of ['1', '2', '3', '4', '5', '6', '7', '10', 'K1']) {
    const all = loadBank(JSON.parse(readFileSync(`${process.env.DUMP_DIR}/bank_${g}.json`, 'utf8')), `bank_${g}.json`).all;
    const qs = playable(all, false);
    for (const ch of buildChapters(qs, null, all)) for (const l of ch.levels) out[l.id] = { kind: l.kind, pool: l.pool, parts: l.parts ?? [], aliases: l.aliases ?? [] };
  }
  writeFileSync(process.env.DUMP_OUT!, JSON.stringify(out)); console.log('levels', Object.keys(out).length);
});
