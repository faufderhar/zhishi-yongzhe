#!/usr/bin/env node
// r15.4.4：把音频设计做好的录音包一步换进游戏（public/voice/）。只读源目录，不改 /workspace/tts 里的任何东西。
// 用法：node scripts/import-voice.mjs <录音包目录（有 manifest.json）> [--speed 1.2] [--dry]
//   检查：manifest complete=true、语速都等于 --speed（默认 1.2 = 小班新语速）、manifest 里的每个文件都在且不为空、
//         文件名带内容哈希（同名文件内容必须一样——否则平板上的 CacheFirst 缓存会继续放旧录音）；
//   然后：删掉 public/voice 里新 manifest 不用的录音，复制新文件，写 manifest.json；CREDITS.md 不动（换包后手动补一节来源）。
//   打印：新增 / 删除 / 换了内容的键数，文件数，总大小。缓存更新：manifest.json 在 SW 预缓存里（内容变 → revision 变），
//   录音是新网址；旧录音由 src/offlineCache.ts pruneVoiceCache 从 zy-voice 删掉（scripts/r1544-voice-update.mjs 测）。
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, copyFileSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2); const dry = args.includes('--dry');
// --merge p:a,p:b：临时只并入这几个键（音频设计的整包还没好时，新句子先用程序自己生成的 1.2 倍速临时录音测试）；manifest.merged 记下来，整包导入时被整个替换掉
const mi = args.indexOf('--merge'); const MERGE = mi >= 0 ? args[mi + 1].split(',') : null;
const si = args.indexOf('--speed'); const SPEED = si >= 0 ? +args[si + 1] : 1.2;
const SRC = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--speed' && args[i - 1] !== '--merge');
if (!SRC) { console.error('用法：node scripts/import-voice.mjs <录音包目录> [--speed 1.2] [--dry]'); process.exit(2); }
const src = resolve(SRC), dst = resolve(dirname(fileURLToPath(import.meta.url)), '../public/voice');
const die = m => { console.error('✗ ' + m); process.exit(1); };
if (!existsSync(join(src, 'manifest.json'))) die(`${src} 里没有 manifest.json`);
const man = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8')); const old = JSON.parse(readFileSync(join(dst, 'manifest.json'), 'utf8'));
if (MERGE) {
  const fs = []; for (const k of MERGE) { const v = man.items?.[k]; if (!v) die(`源 manifest 里没有 ${k}`); const m = man.meta?.[k]; if (m?.speed !== SPEED) die(`${k} 语速 ${m?.speed} ≠ ${SPEED}`);
    for (const f of [v].flat()) { if (!/\.[0-9a-f]{8,}\.(mp3|m4a)$/.test(f) || !existsSync(join(src, f))) die(`${k}: 文件 ${f} 缺失或没有内容哈希`); fs.push(f); } }
  console.log(`并入 ${MERGE.join(', ')}（${fs.join(', ')}，语速 ${SPEED}）自 ${src}`); if (dry) process.exit(0);
  for (const k of MERGE) { const old0 = [old.items[k] ?? []].flat(); old.items[k] = man.items[k]; old.meta = { ...old.meta, [k]: man.meta[k] };
    for (const f of old0) if (!filesOf(old.items).includes(f) && existsSync(join(dst, f))) unlinkSync(join(dst, f)); }
  for (const f of fs) copyFileSync(join(src, f), join(dst, f));
  old.merged = [...(old.merged ?? []).filter(x => !MERGE.includes(x.key)), ...MERGE.map(key => ({ key, from: src, speed: SPEED, at: new Date().toISOString(), note: '临时：等音频设计整包' }))];
  writeFileSync(join(dst, 'manifest.json'), JSON.stringify(old, null, 1)); console.log('✓ 已并入'); process.exit(0);
}
if (man.complete !== true) die('manifest.complete 不是 true（还没生成完？）');
if (man.test) die('manifest 标着 test（临时包），不能当正式包导入');
const sp = man.speeds ?? {}; for (const k of ['questions', 'prompts', 'en']) if (sp[k] !== SPEED) die(`speeds.${k} = ${sp[k]}，不是 ${SPEED}`);
const badMeta = Object.entries(man.meta ?? {}).filter(([, m]) => m && typeof m.speed === 'number' && m.speed !== SPEED).map(([k]) => k);
if (badMeta.length) die(`${badMeta.length} 个键的语速不是 ${SPEED}：${badMeta.slice(0, 5).join(', ')}`);
const filesOf = it => [...new Set(Object.values(it ?? {}).flatMap(v => Array.isArray(v) ? v : [v]).filter(f => typeof f === 'string' && f))];
const files = filesOf(man.items);
const miss = files.filter(f => !existsSync(join(src, f)) || statSync(join(src, f)).size === 0); if (miss.length) die(`${miss.length} 个文件缺失或为空：${miss.slice(0, 5).join(', ')}`);
const noHash = files.filter(f => !/\.[0-9a-f]{8,}\.(mp3|m4a)$/.test(f)); if (noHash.length) die(`${noHash.length} 个文件名没有内容哈希：${noHash.slice(0, 5).join(', ')}`);
const clash = files.filter(f => existsSync(join(dst, f)) && !readFileSync(join(dst, f)).equals(readFileSync(join(src, f)))); if (clash.length) die(`${clash.length} 个同名文件内容不同（缓存会放旧录音）：${clash.slice(0, 5).join(', ')}`);
const ki = Object.keys(man.items), ko = Object.keys(old.items ?? {});
const added = ki.filter(k => !(k in old.items)), removed = ko.filter(k => !(k in man.items)), changed = ki.filter(k => k in old.items && JSON.stringify(old.items[k]) !== JSON.stringify(man.items[k]));
const keep = new Set(files); const stale = readdirSync(dst).filter(f => /\.(mp3|m4a)$/.test(f) && !keep.has(f)); const fresh = files.filter(f => !existsSync(join(dst, f)));
const bytes = files.reduce((s, f) => s + statSync(join(src, f)).size, 0);
console.log(`录音包 ${src}\n  语音 ${man.voice} / 英文 ${man.en_voice}，语速 ${SPEED}，题库 ${man.bank_version}，生成于 ${man.generated}`);
console.log(`  键 ${ko.length} → ${ki.length}：新增 ${added.length}，删除 ${removed.length}，换了内容 ${changed.length}；文件 ${files.length} 个 ${(bytes / 1048576).toFixed(2)} MB（新复制 ${fresh.length}，删掉旧的 ${stale.length}）`);
if (added.length) console.log('  新增：' + added.slice(0, 20).join(', ') + (added.length > 20 ? ' …' : ''));
if (removed.length) console.log('  删除：' + removed.slice(0, 20).join(', ') + (removed.length > 20 ? ' …' : ''));
if (dry) { console.log('（--dry：没有写入）'); process.exit(0); }
for (const f of fresh) copyFileSync(join(src, f), join(dst, f));
for (const f of stale) unlinkSync(join(dst, f));
writeFileSync(join(dst, 'manifest.json'), readFileSync(join(src, 'manifest.json')));
console.log(`✓ 已导入 public/voice（记得：CREDITS.md 补一节；跑 npx vitest run tests/r1544voice.test.ts；测试构建跑 scripts/r1544-voice-update.mjs）`);
