# 音效（public/sfx/ 顶层）授权说明

技能音效见 `skills/CREDITS.md`。本目录顶层的音效：

- `sfx_k_term_celebrate.mp3`（主版）、`sfx_k_term_celebrate_alt.mp3`（备选）：小班期末庆祝关（r17 / r17.1）庆祝短乐句。
  由 `tools/gen_term_jingle.py` 用 numpy 正弦叠加（钟琴 / 铃 / 马林巴式音色）程序化合成、ffmpeg(libmp3lame) 编码，**未使用任何外部采样或素材库**。
- 作者：知识勇者项目 音频设计（Grok Bot 程序化合成）
- 授权：CC0 1.0 公共领域贡献 https://creativecommons.org/publicdomain/zero/1.0/
- 逐文件明细（时长、响度）：`credits.csv`
- 重新生成：`python3 tools/gen_term_jingle.py`（需 numpy、ffmpeg）
