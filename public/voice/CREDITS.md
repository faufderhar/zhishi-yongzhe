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
