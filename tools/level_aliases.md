# 关卡 id 迁移
关卡 id = `科目|类型|首题 grade:id`，不含单元名。题库改版（题目停用、移册、单元重组）可能让某关首题变化 → id 变化。
发布新题库前：用旧题库和新题库各导出一次关卡题池（见 git 历史里 tests/_dump.test.ts 的做法），对每个消失的旧 id
找同科目、同类型、题池重合度最高的新关卡，追加到 `src/game/levelAliases.json`（新 id → [旧 id…]，只增不删）。
地图读取星级时取 `max(本 id, 旧 id…)`（levels.ts `starOf`）。

## r6（题库 v9.1 + 题少课合并）
- 旧关卡（v8 题库 + r5 规则）中在新规则下不再存在的 id，按「同科目、同类型、题池重合最多」追加到 `src/game/levelAliases.json`（新 id → 旧 id 列表），星级取最大值继承。
- 临时合并关（`Level.parts`）：得星时同时写入各课单独成关的 id；某课题数 ≥ 6 自动拆回后，用自己的 id 读到星级。见 tests/r6.test.ts「题少课合并」。
