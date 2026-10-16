# public/sfx

- `manifest.json`：`{ "sfx": [...] }`，由 `src/fx/assets.ts` 读取，条目为相对 `public/sfx/` 的文件名（无扩展名默认 .mp3）。
- `skills/`：85 个角色技能音效 `sfx_skill_<stage>_<characterId>_<n>.mp3`（标准版 -16 LUFS，≤1.2 s）；`skills/kindergarten/` 为小班 15 个技能的 -6 dB 版本。已登记进 `manifest.json`（带 `skills/` 前缀和 .mp3 扩展名）。
- `skills-manifest.json`：技能 ID → 文件/学段/角色/技能中文名 映射，程序按技能播放时用它查文件。
- 授权：`skills/CREDITS.md`、`skills/credits.csv`（全部自制合成 CC0）。生成脚本 `tools/gen_skill_sfx.py`。

## 技能音效接入（r5）
- 播放：`src/fx/assets.ts` 的 `sfx(id, { kinder })`，`id` 为技能 ID（如 `j1_suansuan_2`，与 `src/game/skills.data.ts`、`public/fx/skills/manifest.json` 一致）；小班读 `kindergarten` 字段。
- 懒加载：首次释放时才 fetch + decodeAudioData，内存最多保留 24 个 AudioBuffer；不进 Service Worker 预缓存（`globIgnores: sfx/skills/**`），运行时 CacheFirst（`zy-sfx-skills`，最多 110 条），听过的离线可重放。
- 回退：清单缺项 / 404 / 解码失败 → 合成占位音（按学科）。
- 音量：受家长页「音效」开关和音量控制；技能音效再乘 0.5（−6 dB），小班文件本身再 −6 dB（合计 −12 dB）。
- 体积：`skills/` 85 个 + `skills/kindergarten/` 15 个，合计约 1.3 MB（单个 ≤1.2 s，96 kbps 单声道）。
