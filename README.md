<p align="center">
  <img src="assets/favicon.svg" width="104" height="104" alt="DevChart 暗房工作台 标志">
</p>
<h1 align="center">DevChart 暗房工作台</h1>
<p align="center">查配方、配药液、分段计时，建立自己的黑白冲洗流程。</p>
<p align="center">
  <a href="#界面导览">界面导览</a> ·
  <a href="#快速体验">快速体验</a> ·
  <a href="#本地预览">本地预览</a> ·
  <a href="#离线与安装">离线与安装</a> ·
  <a href="#本地数据与隐私">数据与隐私</a>
</p>

`DevChartWebStatic` 是一个纯 HTML / CSS / JavaScript 的黑白胶片冲洗工具，不依赖 ASP.NET、Node.js、数据库或在线接口。它可以直接部署到 GitHub Pages，也可以安装到手机主屏幕离线使用。

> 显影数据来自 [The Massive Dev Chart](https://www.digitaltruth.com/devchart.php) 的本地缓存。配方、换算和估算结果只应作为起点；实际操作前请核对胶片、显影液、定影液的厂商说明，并通过测试建立自己的稳定流程。

![DevChart 配方检索：关键词、多条件筛选和可点击带入计时器的显影时间](docs/screenshots/recipes.webp)

当前快照包含 **15,307 条配方、360 个胶片名称、237 个显影液名称**，数据生成于 **2026-10-16**，不代表来源站的实时更新。站点无需构建，运行时只使用本仓库内的静态文件。

## 快速体验

1. 按下方“本地预览”启动站点，在“配方”中搜索胶片或显影液，并按规格、ISO、温度缩小范围。
2. 点击结果中对应规格的时间，核对配方信息和三段时长，再进入计时。
3. 在“配液”输入目标总量与稀释比例；在“助手”使用所需的换算、容量或水洗工具。
4. 把实际使用参数和结果写入“冲洗记录本”，定期导出 JSON 备份。

## 界面导览

以下截图来自真实浏览器：配方使用仓库内的数据，记录本使用明确标注的演示条目。没有修改或伪造工具计算结果；示例展示操作入口，不构成胶片与药液的推荐组合。点击图片可查看大图。

### 配方检索：把对应规格的时间带入流程

顶部关键词与六项筛选可以组合使用；桌面表格中分别显示 35mm、120 和页片的时间。点选某一栏的时间后，会跳转到计时页并带入配方。分享当前 URL 可以保留筛选条件。

首页截图展示 HP5 关键词查询。时间范围、双浴时间等写法会按现有规则转换，开始前仍需人工核对。

### 三段计时：核对配方，逐段确认换液

**入口：** 配方结果的时间按钮，或顶部“计时”。显影、停影、定影分别设置；阶段完成后会停下等待确认，再继续下一段。

![三段计时工作区：带入的配方、剩余时间、各阶段设置及搅动提醒](docs/screenshots/timer.webp)

### 配液：总量与多组分比例一起算

**入口：** 顶部“配液”。输入最终总量和 `1+12`、`1:12` 或 `1+1+100` 等比例，结果按组分显示；快捷按钮适合常用罐量。截图使用三组分比例展示界面，并非推荐配方。

![配液计算器：500 mL 总量、三组分比例和各组分体积结果](docs/screenshots/chemistry.webp)

<details>
<summary>暗房助手：温度换算、迫冲减感、定影及其他工具</summary>

**入口：** “助手”。各工具独立输入参数，可继续向下滚动使用互易律、试条、罐量、页片缺口、记录本和清单。参考来源与适用边界见下文原有功能说明。

![暗房助手：温度时间换算、迫冲减感估算和定影工作液管理](docs/screenshots/tools.webp)

</details>

<details>
<summary>水洗向导：完成当前动作，再确认下一步</summary>

**入口：** 助手 → 节水水洗 → 开始向导。大字显示当前倒转步骤，完成后手动确认；可随时退出。实际操作请核对所用胶片和药液的说明。

![全屏水洗步骤提示：当前倒转次数、完成确认与退出向导](docs/screenshots/wash-guide.webp)

</details>

<details>
<summary>冲洗记录本：保留参数与结果，导出备份</summary>

**入口：** 助手页面下方“冲洗记录本”。填写实际参数、观察结果和备注，保存在当前浏览器；支持 JSON 导入 / 导出与 CSV 导出。截图中的条目仅为界面演示，已通过真实 JSON 下载验证。

![冲洗记录本：演示记录、结果备注以及 JSON 和 CSV 备份入口](docs/screenshots/logbook.webp)

</details>

### 手机界面：卡片检索与计时工作区

手机上通过底部导航切换工具；检索结果以卡片呈现，仍可点击对应规格的时间带入计时器。截图使用 390 × 844 视口。

<p align="center">
  <img src="docs/screenshots/mobile-recipes.webp" width="260" alt="手机配方结果卡片：胶片、显影液及可点击的各规格时间">
  <img src="docs/screenshots/mobile-timer.webp" width="260" alt="手机计时界面：带入配方与三段计时控制">
</p>

截图资产和复现方法见 [截图说明](docs/screenshots/README.md)。截图流程使用隔离浏览器，不读取已有冲洗记录。

## 功能

### 配方检索

- 从本地 `data/charts.json` 检索，不需要访问 Digitaltruth。
- 数据文件使用 v2 字典索引格式，把重复的胶片名、显影液名、温度和时间只保存一次；15,307 条记录的当前文件由约 3.43 MB 降至约 0.5 MB，浏览器加载后会还原为完整记录。
- 可按关键词、胶片、显影液、ISO、规格、温度筛选。
- 支持按胶片、显影液或 ISO 排序，筛选条件保存在 URL 中，便于收藏和分享。
- 桌面端使用高密度表格，手机端自动转换为卡片。
- 35mm、120、页片栏中的可识别时间可以直接点击，自动跳转到计时器并带入显影时间和配方信息。
- 可识别 `9`、`9:30`、`8-10`、`4+4` 等时间写法。范围采用中间值，双浴时间采用两段之和；开始前仍应人工确认。

### 三段冲洗计时器

- 显影、停影、定影每段均可编辑。每段归零后会暂停、连续发出八声急促的高低交替警报并显示全屏确认；只有点击“继续”才会启动下一段，给操作者留出更换药液的时间。
- 支持开始、暂停、继续、跳到下一段和复位。
- 使用系统时间戳计算剩余时间，页面切到后台后不会因浏览器节流而累积明显漂移。
- 阶段结束有声音与振动提示；显影阶段可设置首次连续搅动时间和后续提醒间隔，提醒采用四声急促高低音与连续振动，降低湿手操作时漏听的概率。
- 浏览器支持时可在计时期间请求屏幕常亮。
- 完成后把时间和配方保存在本机“最近冲洗”中，最多保留 12 条。

声音、振动和屏幕常亮受浏览器及系统权限控制。iPhone/iPad 可能要求用户先点击页面才能播放提示音；锁屏后的声音行为也由系统决定，不应把网页定时器当作唯一的安全保障。

### 配液计算器

支持两液和多液比例：

- `1+12` 或 `1:12`：1 份浓缩液 + 12 份清水。
- `1+1+100`：A 液 1 份 + B 液 1 份 + 清水 100 份。
- 提供 250、300、500、600、1000、1250 mL，以及 `1+3`、`1+9`、`1+12`、`1+16`、`1+19`、`1+25`、`1+50`、`1+100` 快捷按钮。

计算公式：

```text
每份体积 = 最终总量 ÷ 各部分之和
某部分体积 = 每份体积 × 该部分份数
```

例如最终总量 500 mL、比例 `1+12`：

```text
浓缩液 = 500 ÷ 13 × 1 = 38.46 mL
清水   = 500 ÷ 13 × 12 = 461.54 mL
```

计算器只解决比例问题。部分显影液对每卷胶片有最低浓缩液用量要求，请另外核对说明书。

### 暗房助手

- **温度时间换算**：以 ILFORD 的 18–27°C 时间/温度补偿表为基准，在表内做线性插值，并按 15 秒取整。低于 5 分钟会增加显影不均匀风险。
- **迫冲 / 减感估算**：按用户设定的“每档时间变化百分比”给出起始值。默认 20% 是可编辑的经验值，不是所有胶片和药液的通用标准。
- **定影助手**：根据胶片清除时间和可选倍数计算定影时间；按工作液体积和每升参考容量记录已处理卷数、配制日期与批次使用天数。默认容量按 ILFORD Rapid Fixer 1+4 的公开容量换算，可自行修改。
- **节水水洗向导**：使用全屏步骤提示执行 ILFORD 5 / 10 / 20 次倒转水洗法，每一步完成后手动确认换水。
- **长曝光互易律**：内置 ILFORD 与 Kentmere 常见胶片的官方补偿系数，输入测光秒数后计算建议曝光时间。
- **暗房试条计时**：按 1/3、1/2 或 1 档生成等比曝光序列，并按增量连续计时；每格使用双声提示，全部完成后使用急促警报。
- **冲洗罐容量**：分别保存 135、120 和页片所需的实际容量，按数量计算总量，并可一键带入配液计算器。
- **页片缺口速查**：提供 ILFORD Ortho Plus、FP4 Plus、HP5 Plus 和 Delta 100 的简化触感示意及乳剂面方向提示；不同尺寸和批次仍应核对包装或官方图。
- **冲洗记录本**：记录胶片、显影液/稀释、时间、温度、结果与备注，最多保留 200 条；支持 JSON 导入/导出和 CSV 导出。
- **冲洗清单**：准备药液、装片、核对计时、水洗和记录等项目；状态保存在当前浏览器。
- **流程速查**：显影、停影、定影、水洗、润湿与晾干的顺序提示。

主要参考资料：

- [ILFORD Film development time/temperature compensation chart](https://www.ilfordphoto.com/wp/wp-content/uploads/2017/03/Temperature-compensation-chart.pdf)
- [ILFORD Film Reciprocity Failure Compensation](https://www.ilfordphoto.com/wp/wp-content/uploads/2024/05/Reciprocity-Failure-Compensation-v2.pdf)
- [ILFORD Notch Codes Guide](https://www.ilfordphoto.com/wp/wp-content/uploads/2017/06/Notch-Codes-Guide..pdf)
- [ILFORD Rapid Fixer technical data](https://www.ilfordphoto.com/amfile/file/download/file/1833/product/711/)
- [KODAK Processing Black-and-White Films](https://kodakprofessional.com/sites/default/files/wysiwyg/pro/resources/edbwf_0.pdf)
- [KODAK How to Process and Print Black-and-White Film](https://kodakprofessional.com/sites/default/files/wysiwyg/pro/resources/AJ-3.pdf)

所有换算和容量只作为操作起点。最终时间、稀释比例、容量与保存期限请以实际使用产品的数据表为准。

## 本地预览

不能直接双击 `index.html`，因为浏览器通常会阻止 `file://` 页面读取 JSON。请在仓库根目录启动静态服务器：

```bash
git clone https://github.com/JackerKun/DevChartWebStatic.git
cd DevChartWebStatic
python3 -m http.server 8080 --bind 127.0.0.1
```

然后访问 <http://localhost:8080/>。

站点没有构建步骤。修改 HTML、CSS 或 JavaScript 后刷新浏览器即可。如旧版 Service Worker 影响调试，可在开发者工具中更新或注销 Service Worker，再刷新页面。清除整个站点数据会同时删除本机记录，操作前请先导出记录本备份。

## 更新显影数据

以下命令属于父工程 `DevChartSpider` 的抓取器，不包含在当前独立静态仓库中。仅使用本网站不需要 .NET 或执行抓取。若持有完整父工程，请在包含 `DevChartSpiderConsole` 的父工程根目录执行：

```bash
# 使用现有缓存，只补抓缺失胶片并重新导出静态数据
dotnet run --project DevChartSpiderConsole -- refresh

# 强制刷新基础列表和所有分段缓存，再导出静态数据
dotnet run --project DevChartSpiderConsole -- refresh --force

# 不抓取，只把现有分段缓存导出为站点数据
dotnet run --project DevChartSpiderConsole -- export
```

抓取完成后，静态站只读取：

```text
DevChartWebStatic/data/charts.json
```

`DevChartWebMvc/Films/*.json` 是抓取器的分段缓存，仍用于断点续抓和失败重试；它们不是网页运行时依赖。旧 CSV 已不再使用。

导出的 `charts.json` 使用紧凑 v2 格式：`f/d/l/i/t/m` 分别保存胶片、显影液、稀释、ISO、温度与时间字典，`c` 保存数字索引组成的记录；备注链接仅保存 `devrow` 编号。网页仍兼容旧版对象数组格式，数据切换期间不会因旧缓存而无法加载。请通过上面的 `export` 或 `refresh` 命令生成文件，不要手工编辑。

目标站出现 Cloudflare 验证时，抓取程序会打开 Chrome。首次运行请在浏览器中手动完成验证，程序会复用持久化会话。可选环境变量：

- `DEVCHART_BROWSER_CHANNEL`：Playwright 浏览器频道，默认 `chrome`。
- `DEVCHART_BROWSER_PROFILE`：持久化浏览器配置目录。
- `DEVCHART_HEADLESS=true`：无头运行；Cloudflare 仍可能要求可见浏览器。
- `DEVCHART_COOKIE`：用户自行提供的 Cookie，设置后会先尝试普通 HTTP 请求。

请保持抓取间隔，避免并发或高频请求，并遵守来源站条款。

## GitHub Pages 部署

当前独立仓库没有附带 `.github/workflows/pages.yml`，不要把父工程的工作流路径当成本站运行依赖。部署内容是**本仓库根目录**，无需打包或构建。

在 GitHub 的仓库 **Settings → Pages** 中配置站点发布来源；若使用分支发布，选择实际部署分支及根目录。若使用 GitHub Actions，自行配置工作流上传本仓库根目录为站点产物。

发布时保留 `index.html`、`assets/`、`data/charts.json`、`manifest.webmanifest`、`sw.js` 和 `.nojekyll`。资源使用相对路径，可放在域名根目录或项目子路径。发布后检查配方数据能否加载，再测试离线功能。发布来源设置可参考 [GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 离线与安装

- 第一次打开时需要联网下载页面和 `charts.json`。
- Service Worker 会缓存应用外壳和最近成功读取的数据；完成首次加载后可离线检索和使用工具。
- Android Chrome、桌面 Chrome/Edge 可通过浏览器菜单安装。
- iOS/iPadOS Safari 可用“分享 → 添加到主屏幕”。
- 发布新版本时更新 `sw.js` 顶部的缓存版本名，可让旧缓存自动清理。

## 本地数据与隐私

下面的信息只保存在当前浏览器的 `localStorage`，不会上传：

- 三段计时器设置；
- 最近一次带入的配方；
- 最近 12 条已完成冲洗记录；
- 冲洗清单勾选状态；
- 定影液批次、处理卷数和容量设置；
- 135、120 与页片冲洗罐容量；
- 最多 200 条详细冲洗记录。

清除浏览器站点数据会删除这些本地记录。

## 目录

```text
DevChartWebStatic/
├── .nojekyll
├── index.html                 # 四个工具页面的单页结构
├── manifest.webmanifest       # 安装信息
├── sw.js                      # 离线缓存
├── assets/
│   ├── app.js                 # 检索、计时、计算器与本地状态
│   ├── styles.css             # 桌面与手机响应式样式
│   └── favicon.svg
├── docs/screenshots/          # 界面导览与捕获记录
├── tools/screenshots/         # 可选的截图维护工具
└── data/
    └── charts.json            # 网页唯一的显影数据源
```

## 浏览器支持与无障碍

- 建议使用当前版本 Chrome、Edge、Firefox 或 Safari。
- 页面使用原生表单、语义化标题、键盘焦点样式和 `aria-live` 状态提示。
- 在配方页按 `/` 可聚焦搜索框，按 `Esc` 可清空关键词。
- 支持系统“减少动态效果”设置。
- Wake Lock、振动、PWA 安装等增强功能不可用时，核心检索、计时和计算仍可工作。

## 数据与安全说明

- 显影配方是参考数据，来源站内容可能有录入误差或存在多个不同建议。
- 药液具有健康和环境风险。佩戴适当防护，保持通风，阅读安全数据表，并按当地规定处置废液。
- 温度补偿、推拉片估算、停影和定影默认时间不构成产品说明。重要胶片请先用测试片验证。
- 发布第三方数据前，请自行确认授权范围并遵守来源网站的使用条款。
