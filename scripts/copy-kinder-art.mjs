#!/usr/bin/env node
// r17：幼儿园美术一步拷进游戏（可以反复跑：美术重画后再跑一次，新图直接覆盖；源目录缺了就跳过并提示，不报错）。只读源目录。
//   1) Q版怪物三态（/workspace/art/k_qban/out/<id>/<id>_{default,happy,mischief}.webp）→ public/art/k_qban/，
//      范围 = 小乌云 + 5 只学科柔和版 + kinderBoss.gen.json 里的中班 / 大班 Boss（导入时跳过的 Boss 不拷）+ 备用 小黏黏（不使用）；
//      写 src/game/kinderQban.gen.json（有 Q版的 id 列表）
//   2) 中班题干配图 K2N-010/011/012/014（/workspace/art/k2/stems/*.webp）→ public/images/k2/stems/（K2N-014 用当前版，不用 alt）
//   3) 小班期末庆祝关（/workspace/art/k1_boss/rainbow_cloud/）→ public/images/k1_boss/：彩虹云 intro / end、爱心 empty / lit、两枚学期奖章、彩虹特效层
// 用法：node scripts/copy-kinder-art.mjs [--dry]；源根目录 $ZY_BOX_ROOT（默认 /workspace）
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'); const W = process.env.ZY_BOX_ROOT ?? '/workspace'; const dry = process.argv.includes('--dry');
const QSTATES = ['default', 'happy', 'mischief'];
export const QBAN_BASE = ['mon_k_naughty_cloud', 'mon_math_normal', 'mon_chem_normal', 'mon_histgeo_normal', 'mon_bio_normal', 'mon_english_normal'];
export const QBAN_SPARE = ['mon_k_sticky_jelly'];
export const K2_STEMS = ['K2N-010_stem_train_after7.webp', 'K2N-011_stem_train_before9.webp', 'K2N-012_stem_train_1to10.webp', 'K2N-014_stem_kids_count_off.webp'];
export const K1_BOSS = ['mon_k1_rainbow_cloud_boss_intro.webp', 'mon_k1_rainbow_cloud_boss_end.webp', 'ui_heart_empty.webp', 'ui_heart_lit.webp', 'medal_term1_sun_cloud.webp', 'medal_term2_rainbow.webp', 'fx_rainbow_overlay.webp'];
let copied = 0, same = 0; const warn = [];
const cp = (src, dst) => { if (!existsSync(src)) { warn.push(`缺 ${src}`); return false; } const d = join(ROOT, dst);
  if (existsSync(d) && readFileSync(d).equals(readFileSync(src))) { same++; return true; }
  if (!dry) { mkdirSync(dirname(d), { recursive: true }); copyFileSync(src, d); } copied++; return true; };
// 1) Q版
const qsrc = join(W, 'art/k_qban/out');
const bosses = Object.keys(JSON.parse(readFileSync(join(ROOT, 'src/game/kinderBoss.gen.json'), 'utf8')));
const want = [...QBAN_BASE, ...bosses, ...QBAN_SPARE];
if (existsSync(qsrc)) {
  const ok = want.filter(id => QSTATES.map(s => cp(join(qsrc, id, `${id}_${s}.webp`), `public/art/k_qban/${id}_${s}.webp`)).every(Boolean));
  const ids = ok.filter(id => !QBAN_SPARE.includes(id)).sort();
  if (!dry) writeFileSync(join(ROOT, 'src/game/kinderQban.gen.json'), JSON.stringify({ states: QSTATES, ids, spare: QBAN_SPARE.filter(id => ok.includes(id)) }, null, 1) + '\n');
  console.log(`Q版：${ids.length} 只（+ 备用 ${QBAN_SPARE.join('、')}）`);
} else warn.push(`Q版源目录不在：${qsrc}（跳过，kinderQban.gen.json 不变）`);
// 2) 题干配图
const ssrc = join(W, 'art/k2/stems'); if (existsSync(ssrc)) K2_STEMS.forEach(f => cp(join(ssrc, f), `public/images/k2/stems/${f}`)); else warn.push(`题干配图源目录不在：${ssrc}`);
// 3) 期末庆祝关
const bsrc = join(W, 'art/k1_boss/rainbow_cloud'); if (existsSync(bsrc)) K1_BOSS.forEach(f => cp(join(bsrc, f), `public/images/k1_boss/${f}`)); else warn.push(`期末庆祝关源目录不在：${bsrc}`);
for (const w of warn) console.log('WARN ' + w);
console.log(`${dry ? '（--dry）' : ''}拷贝 ${copied} 个，已经一样 ${same} 个`);
