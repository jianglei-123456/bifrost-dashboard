# Bifrost Dashboard（彩虹桥 · 管理端）

Bifrost 家庭媒体库的管理端 Web 应用，消费 [bifrost-core](https://github.com/placeholder/bifrost-core) 的管理 REST（`/api/**`）。

> **彩虹桥**：源于北欧神话联通九界的彩虹桥。这里，它联通你的音乐、影音与图书 —— v1 交付音乐，影音/图书分区已在导航预留。

## 技术栈

Vue 3 · TypeScript · Vite · Pinia · Vue Router · Element Plus · ECharts（vue-echarts）· Vitest · ESLint + Prettier · pnpm

## 快速开始

```bash
pnpm install          # 安装依赖（npmmirror 源）
pnpm dev              # 开发服务器 http://localhost:5173（/api、/rest 代理到 :18080）
pnpm build            # 类型检查 + 生产构建（vue-tsc -b && vite build）
pnpm test             # Vitest 单测
pnpm lint / format    # ESLint / Prettier
```

**联调前置**：先启动后端（bifrost-core，`./mvnw -pl bifrost-bootstrap -am spring-boot:run`，端口 18080）。登录使用后端初始管理员口令（env `BIFROST_AUTH_INITIAL_PASSWORD` 或已有库的既有口令）。

## 目录结构

```
src/
├── api/          # 契约层：axios 封装（信封解包/Basic 注入/401 处理）+ 按域模块 + 类型
├── stores/       # Pinia：auth（登录态，localStorage 持久化 1 天）、musicScan（音乐扫描状态，顶栏轮询）、book（图书 + 图书扫描）
├── utils/        # auth（Basic/盐）、subsonic（令牌/封面 URL）、format（格式化）
├── layout/       # AppLayout + 侧栏（彩虹桥签名/媒体分区）+ 顶栏（扫描呼吸灯）
├── components/   # CoverArt / StarButton / RatingStars / TrackTable / AlbumCard / StatCard
├── views/        # 登录 · 总览 · 音乐库 · 图书库 · 艺术家/专辑/曲目(含详情) · 搜索 · 歌单(含详情) · 图书(含详情) · 账号 · 系统
├── styles/       # tokens.css（设计 token，源自 docs/design.md）+ base.css
└── test/         # Vitest 全局 setup
```

## 关键决策（详见 docs/adr/）

| 决策 | 说明 |
| --- | --- |
| [0001 封面走 Subsonic](docs/adr/0001-cover-art-via-subsonic.md) | `/api` 无封面端点；封面 URL 经 `/rest/getCoverArt.view?id=al-<id>`，用登录口令派生 Subsonic 令牌（`t=md5(口令+salt)`，salt 每会话随机） |
| [0002 认证模型](docs/adr/0002-auth-model.md) | 无登录端点；登录页验证 `GET /api/user`，凭据持久化到 localStorage、有效期 1 天（刷新保持登录，过期/退出/401 清除），axios 拦截器注入 Basic 头；同源部署绕开后端零 CORS |

## 文档

- [设计系统 docs/design.md](docs/design.md) —— 深空聆听室 · 彩虹桥（色板/字体/布局/签名元素）
- [领域词表 CONTEXT.md](CONTEXT.md) —— 复用 bifrost-core 词表 + 管理端专属术语
- [后端契约事实表 docs/bifrost-core-api-facts.md](docs/bifrost-core-api-facts.md) —— 由后端源码勘察得出的 `/api/**` 契约（信封/分页/认证/端点/字段）
- 后端领域词表：`bifrost-core/CONTEXT.md`；后端契约规划：`bifrost-core/doc/m1/task/04-管理REST.md`
