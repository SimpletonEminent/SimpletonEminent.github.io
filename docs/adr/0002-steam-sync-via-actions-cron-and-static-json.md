# Steam 数据同步采用 Actions 定时抓取 + 静态 JSON,而非运行时 API

每日数据同步不使用客户端运行时 fetch,而是 GitHub Actions cron 工作流抓取 Steam Web API,生成 `public/steam_games.json`,提交后触发站点重新部署,构建期由组件以 `readFileSync` 读取。

原因:静态构建期读取避免运行时网络依赖,数据在 git 历史中可追溯;Steam API key 只存在于 Actions secrets,不进客户端。失败时工作流中止,保留上一次成功的数据,线上画廊不会变空。
