# 更新工作流通过 workflow_dispatch 触发部署,而非 PAT

数据更新工作流(cron)提交 `steam_games.json` 时,`GITHUB_TOKEN` 提交的 commit 不会触发 `on: push` 的部署工作流(防递归设计)。方案对比:PAT(需额外配置 secret,有权限风险) vs 单工作流(数据不进 git 历史) vs workflow_dispatch。

选定 workflow_dispatch:更新工作流提交后用 `gh workflow run deploy.yml` 显式触发部署,deploy.yml 增加 `workflow_dispatch` 触发源。无需额外 secret、数据保留在 git 历史、职责清晰。
