#!/usr/bin/env node
// r15.4.4：把音频设计做好的录音包一步换进游戏（public/voice/）。只读源目录，不改 /workspace/tts 里的任何东西。
// 用法：node scripts/import-voice.mjs <录音包目录（有 manifest.json）> [--speed 1.2] [--except 1.2=p:a,p:b | --except 1.2=@keys.txt]… [--dry]
//   r17.5 按键语速：--except <语速>=<键列表> 可以写多次 = 这些键按这个语速校验（例：幼儿园 zf_003@1.0 包里小学/初高年级名仍是 1.2）。
//         给了 --except 就按每个键的 meta.speed 校验（包头 speeds.* 是旧值时只警告不拦）：每个键都要有 meta.speed，
//         = --speed 或 = 它登记的例外语速；登记了的例外键必须在包里、语速必须正好是登记的（防止例外清单过期）。
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
const SRC = args.find((a, i) => !a.startsWith('--') && !['--speed', '--merge', '--except'].includes(args[i - 1]));
// r17.5：--except 1.2=p:grade_1,p:grade_2（或 =@文件，一行一个键 / 逗号分隔）
const EXCEPT = new Map(); args.forEach((a, i) => { if (a !== '--except') return; const v = args[i + 1] ?? ''; const eq = v.indexOf('=');
  const sp = +v.slice(0, eq), list = v.slice(eq + 1); if (eq <= 0 || !Number.isFinite(sp) || !list) { console.error(`--except 格式：<语速>=<键,键…> 或 <语速>=@文件（收到 ${v}）`); process.exit(2); }
  const ks = (list.startsWith('@') ? readFileSync(list.slice(1), 'utf8') : list).split(/[\s,]+/).filter(Boolean);
  for (const k of ks) { if (EXCEPT.has(k) && EXCEPT.get(k) !== sp) { console.error(`${k} 登记了两个例外语速`); process.exit(2); } EXCEPT.set(k, sp); } });
const PER_KEY = EXCEPT.size > 0;
if (!SRC) { console.error('用法：node scripts/import-voice.mjs <录音包目录> [--speed 1.2] [--except 1.2=键,键…] [--dry]'); process.exit(2); }
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
const sp = man.speeds ?? {}; for (const k of ['questions', 'prompts', 'en']) if (sp[k] !== SPEED) { if (PER_KEY) console.log(`  ⚠ 包头 speeds.${k} = ${sp[k]}（按键语速模式：以每个键的 meta.speed 为准）`); else die(`speeds.${k} = ${sp[k]}，不是 ${SPEED}`); }
if (PER_KEY) {   // r17.5 按键语速：每个键都要有语速；例外清单必须和包一致
  const noSp = Object.keys(man.items ?? {}).filter(k => typeof man.meta?.[k]?.speed !== 'number'); if (noSp.length) die(`${noSp.length} 个键没有 meta.speed：${noSp.slice(0, 5).join(', ')}`);
  const exMiss = [...EXCEPT].filter(([k]) => !(k in (man.items ?? {}))); if (exMiss.length) die(`${exMiss.length} 个 --except 键不在包里：${exMiss.slice(0, 5).map(([k]) => k).join(', ')}`);
  const exBad = [...EXCEPT].filter(([k, s0]) => man.meta[k].speed !== s0); if (exBad.length) die(`${exBad.length} 个 --except 键的语速和登记的不一样：${exBad.slice(0, 5).map(([k, s0]) => `${k} 包里 ${man.meta[k].speed} ≠ ${s0}`).join(', ')}`);
}
// r17：包里登记过的例外语速（manifest.deploy.<批次>.keys + .speed，例如小班期末庆祝关 8 句 1.1 = 用户定的更慢）——只放过登记了的键、且语速和登记的一样
const declared = new Map(Object.values(man.deploy ?? {}).flatMap(d => d && typeof d === 'object' && Array.isArray(d.keys) && typeof d.speed === 'number' ? d.keys.map(k => [k, d.speed]) : []));
for (const [k, s0] of EXCEPT) declared.set(k, s0);   // r17.5：命令行例外优先于包里旧批次的登记（例：r17_term 登记 1.1，本包已改 1.0 = --speed，照常通过）
const staleDecl = [...declared].filter(([k, s0]) => !EXCEPT.has(k) && man.meta?.[k] && man.meta[k].speed !== s0).map(([k, s0]) => `${k}（登记 ${s0}，包里 ${man.meta[k].speed}）`);
if (staleDecl.length) console.log(`  ⚠ 包里旧批次登记的例外语速已不适用 ${staleDecl.length} 个（按 --speed 校验）：${staleDecl.slice(0, 12).join(', ')}${staleDecl.length > 12 ? ' …' : ''}`);
const badMeta = Object.entries(man.meta ?? {}).filter(([k, m]) => m && typeof m.speed === 'number' && m.speed !== SPEED && declared.get(k) !== m.speed).map(([k]) => k);
const exc = Object.entries(man.meta ?? {}).filter(([k, m]) => m && typeof m.speed === 'number' && m.speed !== SPEED && declared.get(k) === m.speed).map(([k, m]) => `${k}@${m.speed}`);
if (exc.length) console.log(`  登记过的例外语速 ${exc.length} 个：${exc.join(', ')}`);
if (badMeta.length) die(`${badMeta.length} 个键的语速不是 ${SPEED}：${badMeta.slice(0, 5).join(', ')}`);
{ const dist = {}; for (const m of Object.values(man.meta ?? {})) if (m && typeof m.speed === 'number') { const t = `${m.voice ?? '?'}@${m.speed}`; dist[t] = (dist[t] ?? 0) + 1; }
  console.log('  语速分布：' + Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ×${n}`).join('，')); }
const filesOf = it => [...new Set(Object.values(it ?? {}).flatMap(v => Array.isArray(v) ? v : [v]).filter(f => typeof f === 'string' && f))];
const files = filesOf(man.items);
const miss = files.filter(f => !existsSync(join(src, f)) || statSync(join(src, f)).size === 0); if (miss.length) die(`${miss.length} 个文件缺失或为空：${miss.slice(0, 5).join(', ')}`);
const noHash = files.filter(f => !/\.[0-9a-f]{8,}\.(mp3|m4a)$/.test(f)); if (noHash.length) die(`${noHash.length} 个文件名没有内容哈希：${noHash.slice(0, 5).join(', ')}`);
const clash = files.filter(f => existsSync(join(dst, f)) && !readFileSync(join(dst, f)).equals(readFileSync(join(src, f)))); if (clash.length) die(`${clash.length} 个同名文件内容不同（缓存会放旧录音）：${clash.slice(0, 5).join(', ')}`);
const ki = Object.keys(man.items), ko = Object.keys(old.items ?? {});
const added = ki.filter(k => !(k in old.items)), removed = ko.filter(k => !(k in man.items)), changed = ki.filter(k => k in old.items && JSON.stringify(old.items[k]) !== JSON.stringify(man.items[k]));
const keep = new Set(files); const stale = readdirSync(dst).filter(f => /\.(mp3|m4a)$/.test(f) && !keep.has(f)); const fresh = files.filter(f => !existsSync(join(dst, f)));
const bytes = files.reduce((s, f) => s + statSync(join(src, f)).size, 0);
console.log(`录音包 ${src}\n  语音 ${man.voice} / 英文 ${man.en_voice}，语速 ${SPEED}${PER_KEY ? `（按键；例外 ${EXCEPT.size} 键）` : ''}，题库 ${man.bank_version}，生成于 ${man.generated}`);
console.log(`  键 ${ko.length} → ${ki.length}：新增 ${added.length}，删除 ${removed.length}，换了内容 ${changed.length}；文件 ${files.length} 个 ${(bytes / 1048576).toFixed(2)} MB（新复制 ${fresh.length}，删掉旧的 ${stale.length}）`);
if (added.length) console.log('  新增：' + added.slice(0, 20).join(', ') + (added.length > 20 ? ' …' : ''));
if (removed.length) console.log('  删除：' + removed.slice(0, 20).join(', ') + (removed.length > 20 ? ' …' : ''));
if (dry) { console.log('（--dry：没有写入）'); process.exit(0); }
for (const f of fresh) copyFileSync(join(src, f), join(dst, f));
for (const f of stale) unlinkSync(join(dst, f));
writeFileSync(join(dst, 'manifest.json'), readFileSync(join(src, 'manifest.json')));
console.log(`✓ 已导入 public/voice（记得：CREDITS.md 补一节；跑 npx vitest run tests/r1544voice.test.ts；测试构建跑 scripts/r1544-voice-update.mjs）`);
