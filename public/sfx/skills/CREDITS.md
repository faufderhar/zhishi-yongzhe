# 技能音效 授权说明

全部 100 个文件（85 个标准版 + 15 个小班 -6 dB 版）均由 `tools/gen_skill_sfx.py` 用 numpy 正弦/噪声程序化合成、ffmpeg(libmp3lame) 编码，**未使用任何外部采样或素材库**。

- 作者：知识勇者项目 音频设计（Grok Bot 程序化合成）
- 授权：CC0 1.0 公共领域贡献 https://creativecommons.org/publicdomain/zero/1.0/
- 逐文件明细（技能、时长、响度）：`credits.csv`
- 重新生成：`python3 tools/gen_skill_sfx.py`（需 numpy、ffmpeg）
