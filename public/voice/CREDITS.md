# Voice credits — 知识勇者 recorded read-aloud (幼儿园小班)

## Model
- **Name:** [hexgrad/Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh)
- **Weights file:** `kokoro-v1_1-zh.pth`
- **SHA256:** `b1d8410fa44dfb5c15471fd6c4225ea6b4e9ac7fa03c98e8bea47a9928476e2b`
- **Runtime:** kokoro 0.9.4 / misaki 0.9.4 (Python), espeak-ng for G2P
- **License:** Apache License 2.0 (model card). Chinese training data provided under license by LongMaoData (龙猫数据), per the model card.

## Voices used in this pack
- Chinese: `zf_002` (Kokoro zh female)
- English segments: `af_maple` (Kokoro en female)
- Speed: **1.2** for question stems, options, prompts, and English segments (user request 2026-10-19; was 1.5 on 2026-10-17)

## Generation
- Date: 2026-10-19 (America/Los_Angeles), release r15.4.4 (bank 小班 = v31 content; 834 keys / 529 mp3)
- Pronunciation: /workspace/tts/pron_zh.tsv (57 overrides incl. 8 r15.4.4 lines) + tts_subst.tsv
- One clip (p:res_k_again) is the same-recipe render made by 游戏程序 (zf_002, 1.2, same chain); KE-049#opt0 re-posted at −16.5 LUFS to keep limiter GR < 4 dB
- Post chain: `v2.1-trim50dB-50/150ms-lim-2dBFS@96k-makeup-iter-ln@96k-16I-1.5TP-mp3-40k`
- Format: MP3 mono 24 kHz 40 kbps CBR; loudness target −16 LUFS; true peak ≤ −1.5 dBTP
- Bank: 题库_幼儿园小班.json (read-only)

## Use
Intended for the 知识勇者 family learning game (non-commercial family use). Model weights remain under Apache-2.0; respect LongMaoData attribution for the Chinese data as stated on the model card.

## r15.4 additions (2026-10-17)
- 95 new shared prompts for 小班 lines that contain variables, expanded from game data (src/game/voiceLines.ts → /workspace/tts/prompts_dynamic.json → `batch.py --prompt-list`): character names, 「X，出发！」, tutorial greeting, skill lines, 开心值 n/m, monster names going home / laughing, stage/grade labels, numbers 1–20, 「我来帮你看看！是…哦！」 pieces. Same voice zf_002, speed 1.5, same post chain, true-peak audit (≤ −1.5 dBTP).
- 19 keys re-generated after 题库审核 小班读音抽查_v1 (pron_zh.tsv +13 rows; tts_subst.tsv 嘿哟→嘿呦, TTS-only).

## r15.4.4 interim update (2026-10-19, superseded by the full 1.2 pack below)
- Bank 题库_幼儿园小班.json v31: 12 new questions + K-038 tts_text (「两个苹果」) recorded; KC-028 option 「▭」 (shape symbol only) is no longer recorded.
- Prompt fixes from 题库审核 小班读音复查_v2: 开心值「两个」, 点一点 / 水滴 / 前一关 / 小火车 / 亮亮 / 请把手机 pronunciation, 「快要来啦，等一等哦」 instead of 「敬请期待」.
- Same model, voice zf_002, speed 1.5 and post chain; only changed keys regenerated (list: /workspace/tts/out_r1544/zf_002/changes_r1544.csv). 833 keys / 528 mp3.

## r15.4.4 full re-render at speed 1.2 (2026-10-19, 音频设计)
- Whole pack (834 keys / 529 mp3, 4.18 MB) regenerated at speed 1.2 per user request; replaces the 1.5 pack and the interim 1.2 p:res_k_again clip. Includes all 题库审核 pronunciation corrections, bank v31 content and the new 第二局 line (p:res_k_again).
- Imported with `node scripts/import-voice.mjs /workspace/tts/deploy/voice --speed 1.2` (content-hashed file names, so old cached clips are never reused; stale zy-voice cache entries are pruned on update).
- Browser speechSynthesis fallback for 小班 scales its rate with the pack speed (×1.2).

## r16 — 幼儿园中班 (K2) pack (2026-10-19, 音频设计)
- Imported with `node scripts/import-voice.mjs /workspace/tts/deploy/voice --speed 1.2`
- Same model (Kokoro-82M-v1.1-zh, Apache-2.0; Chinese data © LongMaoData per model card), voices `zf_002` / `af_maple`, speed 1.2 and post chain as the 小班 pack above
- Content: 中班 question stems / options (pack built from 题库 v36; game bank v42) + 小班 + prompts — combined pack, 2004 keys / 1162 mp3 (10.4 MB); identical texts share one file
- Pronunciation: /workspace/tts/pron_zh.tsv + K2 overrides (才露 = lù, 先长出 = zhǎng, confirmed by 题库审核)
- Pending: K2E-016#opt0–2 (options became text in a later bank version; system voice fallback until added)

## r16 — full pack incl. 大班 (K3) (2026-10-19 16:06 PDT, 音频设计)
- Imported with `node scripts/import-voice.mjs /workspace/tts/deploy/voice --speed 1.2`: 3253 keys / 1862 mp3 (16.9 MB); pack banks K1 v34 · K2 v42 · K3 v43 (game bank v43; K1/K2 question content unchanged v42→v43)
- Same model (Kokoro-82M-v1.1-zh, Apache-2.0; Chinese data © LongMaoData per model card), voices `zf_002` / `af_maple`, speed 1.2, post chain as above; pron_zh.tsv 57 overrides
- Adds K2E-016#opt0–2 (no longer pending), new renders of p:retry / p:think, and 大班 keys (大班 is hidden in r16; mp3s are runtime-cached only, so they are never downloaded until K3 opens)

## r16 — final pack for bank v44 (generated 2026-10-19 16:57 PDT, 音频设计)
- Imported with `node scripts/import-voice.mjs /workspace/tts/deploy/voice --speed 1.2`: 3253 keys / 1862 mp3 (16.92 MB); pack banks K1 v34 · K2 v44 · K3 v44 (game bank v44)
- Re-recorded for v44 量词 个→只: K2N-033#stem (→ K2N-033_stem.560350450b.mp3), K3C-058/066/069#stem; 4 old files removed. Same model / voices / speed / post chain as above

## r16 — final pack for bank v45 (generated 2026-10-19 17:42 PDT, 音频设计)
- Imported with `node scripts/import-voice.mjs /workspace/tts/deploy/voice --speed 1.2`: 3253 keys / 1862 mp3 (16.93 MB); pack banks K1 v34 · K2 v44 · K3 v45 (game bank v45; K1/K2 text unchanged since v44)
- Re-recorded for 大班 v45: K3D-018, K3L-011, K3N-025 stems (3 old files removed). 大班 stays hidden in r16

## r16.2 — pack for bank v51 (generated 2026-10-19 23:50 PDT, 音频设计)
- Imported with `node scripts/import-voice.mjs /workspace/tts/deploy/voice --speed 1.2`: 3253 keys / 1896 mp3 (17.19 MB); pack label K1 v51 · K2 v51 · K3 v51 (game bank v51)
- 106 keys re-recorded (K1 19, K2 52, K3 35; mostly option text from the v51 option-bias fixes; list: /workspace/tts/analysis/v51_changes.md); 82 new files, 48 old files removed. Same model / voices / speed / post chain as above; pron additions 鱼干 / 小鱼干 / 高高的 / 掉光光

## r17 — +15 prompts (generated 2026-10-20 10:19 PDT, 音频设计)
- Imported with `node scripts/import-voice.mjs /workspace/tts/deploy/voice --speed 1.2`: 3268 keys / 1911 mp3 (17.31 MB); pack label K1 v51 · K2 v51 · K3 v51 · r17 prompts (game bank v56)
- New: p:happy_total_1..5 (开心值一共 m 个), p:res_k_first_1..10 (自己答对 N 题; 2 → 两). Same model / voices / speed / post chain as above
- Not yet re-recorded for bank v56: 18 option keys whose text changed in v55 (tests/fixtures/r17_voice_stale_v56.json); the game skips a clip whose recorded text no longer matches the shown text
- r17 (2026-10-20 18:55 PDT, 音频设计): +8 小班期末庆祝关 prompts p:k_term1_intro / k_term_heart / k_term_retry / k_term1_end / k_term1_medal / k_term2_intro / k_term2_end / k_term2_medal at speed 1.1 (user decision: gentler; declared in manifest deploy.r17_term). Pack now 3276 keys / 1919 mp3 (17.45 MB)
- r17 (2026-10-20, 音频设计): + K3C-071 stem (options 右边/左边 reuse 中班 clips). 3279 keys / 1920 mp3. Interim pack: 28 option keys changed in bank v56/v57 are being re-recorded (final import pending)
- r17 final (2026-10-20 19:14 PDT, 音频设计): pack label K1 v57 · K2 v57 · K3 v57 · r17 prompts · r17 term — 28 option keys re-recorded for bank v57 (K1 4, K2 14, K3 10; list /workspace/tts/analysis/v57_changes.md); 3279 keys / 1924 mp3 (17.54 MB), 20 new files, 16 old removed
