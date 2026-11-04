# 界面截图

截图来自真实浏览器及本仓库 `data/charts.json`，覆盖桌面和 390 × 844 手机视口。配方没有改写；记录本条目明确标记为演示，不代表实际冲洗或推荐配方。所有记录保存在截图用的隔离浏览器上下文，不读取个人浏览器资料。

| 文件                  | 界面                               |
| --------------------- | ---------------------------------- |
| `recipes.webp`        | HP5 关键词检索、筛选与各规格时间   |
| `timer.webp`          | 从检索结果带入的配方与三段计时设置 |
| `chemistry.webp`      | 三组分配液计算                     |
| `tools.webp`          | 温度、迫冲、定影及水洗工具入口     |
| `wash-guide.webp`     | 全屏水洗步骤确认                   |
| `logbook.webp`        | 演示记录及备份入口                 |
| `mobile-recipes.webp` | 手机配方卡片                       |
| `mobile-timer.webp`   | 手机计时界面                       |

## 重新生成

站点运行本身不需要 Node.js。截图工具单独放在 `tools/screenshots/`，需要 Node.js 20+ 与已安装的 Google Chrome：

```bash
cd tools/screenshots
npm ci
npm run capture
```

默认写入根目录 `docs/screenshots/`。可使用 `DEVCHART_SCREENSHOT_DIR` 指定其他输出目录。工具会启动随机端口的本地静态服务器，操作实际控件，核对配方跳转、页面状态、记录本真实 JSON 下载及页面异常，结束后关闭浏览器和服务器。

`capture-report.json` 保存时间、图片尺寸与导出验证记录。更新后应逐张检查文字、结果、遮罩及取景。本文图片只记录 UI，不等同于计时精度、锁屏提醒或药液工艺的全面验收。WebP 仅用于压缩截图，没有重画控件或修改计算结果。
