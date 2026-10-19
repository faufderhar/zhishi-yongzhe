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
