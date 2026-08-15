# 中文名与官方 genres 用一次性脚本预填,标签以手写为准

新增一次性元数据丰富脚本,遍历游戏列表调用 `appdetails?l=schinese&filters=genres`(限流约 200 次/5 分钟,分多批执行),自动抓取中文名与官方 genres 写入注释文件作为建议值;用户可手写覆盖并补充社区风格标签(如魂系、肉鸽)。

原因:Steam `GetOwnedGames` API 不返回标签,中文名仅 `appdetails?l=schinese` 可获取,而 SteamSpy 等标签来源已被 Cloudflare 拦截,无稳定免费的自动标签源。tags 属于用户策展内容,以手写为准;官方 genres 仅作预填降低手工成本。该脚本不属于每日同步链路,标签等静态元数据不每日抓取。
