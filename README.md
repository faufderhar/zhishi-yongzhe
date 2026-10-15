# 知识勇者 v1（家用平板答题闯关）
React + TS + Vite PWA + IndexedDB。安卓平板为主，iPad 同等兼容。

## 运行
```
npm install
npm run dev -- --host            # 开发：平板访问 http://<电脑IP>:5173
npm run build && npx vite preview # 预览：http://<电脑IP>:4173（vite.config 已开 host）
npm test                          # vitest：题库校验/计数、判题、章节、自适应、错题本、时长、战斗
node scripts/shots.mjs            # 端到端截图 + 断言（需 preview 在 4173）
URL=http://localhost:8099/ node scripts/offline-check.mjs   # 断网可玩检查
```
离线包：`/workspace/zhishi-yongzhe-v1.zip`（dist + serve.mjs/serve.py + 启动脚本 + 使用说明.txt）。

## 结构
- `public/banks/bank_<年级>.json`：内置题库（复制自 /workspace/questions/题库_*.json 完整版，K1/1–6/7/10）。更新题库：重新复制后 build。
- `src/game/questions.ts` 校验/归一化/判题（分数按数值、容差、多选），`csv.ts` CSV 导入导出
- `grades.ts` 年级段配置（时限、简易模式、朗读、每日时长默认值）
- `levels.ts` 章节/关卡生成与星级，`adaptive.ts` 难度阶梯与选题，`wrongbook.ts` 盒子法，`playtime.ts` 时长/密码
- `battle.ts` + `balance.ts` 战斗数值；`src/ui/*` 界面；`src/db.ts` IndexedDB（含备份/恢复）
- 美术：`public/art/`，同名覆盖即可换；`python3 tools/compress_art.py` 生成 webp + 量化 png
