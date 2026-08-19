# 首次游玩(估):以最早成就解锁时间近似

## 背景

用户希望展示每款游戏的首次游玩时间,提出可用 Steam 成就 API 的最早成就解锁时间来推算。经核实:Steam Web API 不提供"首次游玩"字段(`GetOwnedGames` 仅有 playtime/last_played);`GetPlayerAchievements/v1` 返回的每个成就带 `unlocktime`(Unix 秒),已解锁成就的最小 `unlocktime` 即为最早成就解锁时间——它是首次游玩的**下界近似**,可能偏晚(成就后补的游戏、先玩很久才解锁的游戏会失真)。**规则:外部 AI 讨论结果与内部规格冲突时,以本 ADR 与内部规格为准。**

## 决策

1. **字段与采集**:`public/steam_achievements.json` 每款有成就的游戏新增 `firstUnlockAt`(Unix 秒,最早成就解锁时间);`check-achievements.mjs` 采集(该脚本已在调用此 API,新增成本≈0)。
2. **展示**:气泡底部元数据行,位于「发售年份」与「游玩年份」之间,标签「首次游玩(估)」,格式 `YYYY-MM-DD`,北京时间(UTC+8,中国无夏令时,固定偏移转换,不依赖浏览器时区)。
3. **无数据**:无成就系统 / 成就全锁定 / 查询失败的游戏不显示该字段,行内自动消失。
4. **数据通道**:自动成就文件(与手写注释文件分离,ADR-0005);手动重跑 `check-achievements.mjs` 刷新。最早解锁时间只增不减(新解锁不会早于已有最早),数据永久稳定,无需每日同步。
5. **手写关系**:不开放手写补充(单一来源);与手写 `play_year`(游玩年份)并排展示,不一致时**以手写游玩年份为准**(内部规格:手写数据优先于自动推算)。
6. **范围**:只加气泡 meta;卡片与排序不动。

## 原因

- 诚实标注:字段本质是成就解锁时间,直接叫"首次游玩"会误导。
- 单一时钟:unlocktime 为 UTC 时间戳,展示统一按北京时间,避免浏览器时区差异。

## 影响

- `scripts/check-achievements.mjs`(采集 `firstUnlockAt`)
- `public/steam_achievements.json`(数据格式扩展)
- `src/lib/steam-data.ts`(`MergedGame.first_achievement_at` 合并)
- `src/components/SteamGallery.astro`(气泡 meta 展示)
- `CONTEXT.md`(术语「首次游玩(估)」)、`docs/steam-gallery-ops.md`
