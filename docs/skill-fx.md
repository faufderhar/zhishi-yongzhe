# 技能特效接入（r5，v0.3.7）

- 数据：`scripts/gen-skills.py` 从 `/workspace/playtest/skills/data.py` 生成 `src/game/skills.data.ts` 与 `docs/skill-assets.md`。ID = `<k|p12|p36|j1|h1>_<charId>_<n>`（n 为 data.py 顺序），与 `public/sfx/skills-manifest.json`（音效文件名多 `sfx_skill_` 前缀）和 `public/fx/skills/manifest.json` 一一对应（单测校验）。
- 美术：`public/fx/skills/<id>.webp + <id>.json`（4 列序列帧，peak_frame 为命中帧），图标 `public/fx/skills/icons/icon_<id>.webp`（256，显示 40/32 px）；原件 `/workspace/art/skills/`，QA 报告 `public/fx/skills/qa_report.md`。
- 播放：`src/fx/skillFx.ts playSkill()`。攻击/控制/演出：中心 = 施法者与目标连线中点；护体/恢复：中心 = 施法者。命中帧（peak_frame）回调结算数字。混合按 json（additive→plus-lighter / screen / normal），小班与小学 1–2 一律 normal。超过本次上限（小班 1.0 s）时提高帧率播完整张。
- 懒加载：每场战斗只预取本角色本学段的 3–4 个技能（`preloadSkillArt`），不进预缓存；运行时 CacheFirst（`zy-anim`）。
- 回退：250 ms 内未就绪或加载失败 → 程序化特效（9 种 recipe，粒子按学段上限，帧率 <45 时减半）。
- 减少动画：只保留横幅（含图标）+ 图标淡入淡出，无位移、无粒子、无序列帧。
- 替换美术：覆盖同名 webp/json 并更新 manifest.json 即可；替换音效：覆盖 `public/sfx/skills/sfx_skill_<id>.mp3`。
