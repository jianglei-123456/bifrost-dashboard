# Bifrost Dashboard（管理端）

Bifrost 的家庭媒体库管理端 Web 应用（Vue Dashboard），消费 bifrost-core 提供的管理 REST（`/api/**`）。领域词（库根 / 音乐目录 / 图书目录 / 曲目 / 艺术家 / 专辑 / 扫描 / 指纹 / 缺失文件 / 封面 / 收藏 / 评分 / 索引分组 / 管理 REST）以 bifrost-core 的 CONTEXT.md 为准；本文件只收录管理端独有的术语。后端工程位于本仓库的**兄弟目录** `../bifrost-core`（相对本目录，勿记绝对路径）；1.0.0 起本仓库的构建产物打进后端镜像、托管在 `/admin/`，但仓库与构建仍然独立。

## 品牌

**彩虹桥（Bifrost）**:
品牌名，取北欧神话联通九界的彩虹桥之意，寓意平台联通音乐 / 影音 / 图书三类媒体。设计语言围绕"桥 · 联通"展开，媒体导航为三类预留分区（1.0.0 交付音乐与图书，影音预留）。
_Avoid_: 桥梁（工程隐喻）、bifrost（代码名，不用于用户可见文案）

## 发布与部署

**管理端基址（/admin）**:
1.0.0 起管理端产物的生产基址：`vite build --base=/admin/`，与 bifrost-core 打进同一镜像并由其后端托管（`/` 与 `/admin` 302 到 `/admin/`）。路由 base 必须写成 `createWebHistory(import.meta.env.BASE_URL)`——vue-router 无参时只认 `<base href>`，会退化成 `/`，在 `/admin/` 下刷新任何页面都匹配不到路由。开发期 BASE_URL 为 `/`，`pnpm dev` 行为不变。
_Avoid_: 根路径部署、hash 路由、生产反向代理（不需要：同源同镜像）

## 界面与交互

**管理端（Dashboard）**:
面向管理员的 Web 控制台，与消费 Subsonic 协议的第三方客户端（Feishin、DSub、Symfonium 等）相对。
_Avoid_: 后台、控制台（易与浏览器控制台混淆）

**登录态（Sign-in）**:
管理员口令经 localStorage 持久化、有效期 1 天的持有形态（见 docs/adr/0002-auth-model.md）；无服务端会话，每次 API 请求附带 Basic 认证凭据，封面请求附带 Subsonic 令牌参数。刷新页面保持登录，过期 / 退出 / 401 即清除。
_Avoid_: 会话（暗示服务端 session）、登录（"登录"是动作）

**总览（Overview）**:
音乐库统计与扫描状态的仪表盘首页（首页一词指代不明，总览特指此页）。
_Avoid_: 首页、Dashboard（歧义）

**媒体浏览（Browse）**:
按艺术家 / 专辑 / 曲目三层浏览媒体库的操作域；列表支持分页、搜索与索引分组过滤。
_Avoid_: 媒体库（媒体库是数据本身，不是操作域）

**音乐库（Music Library）**:
音乐目录管理与音乐扫描**合一**的页面（路由 `/music-library`）；旧的「库根管理」+「扫描管理」双页已合并进此页：列出音乐目录、启停、增删改、单目录 / 全部扫描与上次统计。数据源 `/api/music-roots`。
_Avoid_: 库根管理、扫描管理（旧双页命名）

**图书库（Book Library）**:
图书目录管理与图书扫描**合一**的页面（路由 `/books/roots`），与音乐库对称；图书扫描是异步的，进行中由顶栏下的扫描状态条提示。数据源 `/api/book-roots`。
_Avoid_: 图书库根（旧名）

**缺失曲目（Missing Track）**:
沿用 core 定义（文件消失被隐藏的曲目），管理端在浏览列表中默认隐藏。**当前没有显式的查看 / 清理入口**——`/api/tracks` 不支持 `isAvailable` 过滤，需后端补参数后再增补入口。
_Avoid_: 删除（删除是管理端对记录的显式清理动作，与缺失不同）

**收藏与评分（Star & Rate）**:
对曲目 / 专辑 / 艺术家三态收藏与 1–5 分评分的标注操作；评分 0 表示取消。
_Avoid_: 喜欢、加星、打分（评分是领域词 rating 的展示形态）
