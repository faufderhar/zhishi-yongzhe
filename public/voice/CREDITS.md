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
- Speed: **1.5** for question stems, options, prompts, and English segments (user-confirmed 2026-10-17)

## Generation
- Date: 2026-10-17 (America/Los_Angeles)
- Post chain: `v2.1-trim50dB-50/150ms-lim-2dBFS@96k-makeup-iter-ln@96k-16I-1.5TP-mp3-40k`
- Format: MP3 mono 24 kHz 40 kbps CBR; loudness target −16 LUFS; true peak ≤ −1.5 dBTP
- Bank: 题库_幼儿园小班.json (read-only)

## Use
Intended for the 知识勇者 family learning game (non-commercial family use). Model weights remain under Apache-2.0; respect LongMaoData attribution for the Chinese data as stated on the model card.

## r15.4 additions (2026-10-17)
- 95 new shared prompts for 小班 lines that contain variables, expanded from game data (src/game/voiceLines.ts → /workspace/tts/prompts_dynamic.json → `batch.py --prompt-list`): character names, 「X，出发！」, tutorial greeting, skill lines, 开心值 n/m, monster names going home / laughing, stage/grade labels, numbers 1–20, 「我来帮你看看！是…哦！」 pieces. Same voice zf_002, speed 1.5, same post chain, true-peak audit (≤ −1.5 dBTP).
- 19 keys re-generated after 题库审核 小班读音抽查_v1 (pron_zh.tsv +13 rows; tts_subst.tsv 嘿哟→嘿呦, TTS-only).

## r15.4.4 update (2026-10-19)
- Bank 题库_幼儿园小班.json v31: 12 new questions + K-038 tts_text (「两个苹果」) recorded; KC-028 option 「▭」 (shape symbol only) is no longer recorded.
- Prompt fixes from 题库审核 小班读音复查_v2: 开心值「两个」, 点一点 / 水滴 / 前一关 / 小火车 / 亮亮 / 请把手机 pronunciation, 「快要来啦，等一等哦」 instead of 「敬请期待」.
- Same model, voice zf_002, speed 1.5 and post chain; only changed keys regenerated (list: /workspace/tts/out_r1544/zf_002/changes_r1544.csv). 833 keys / 528 mp3.
