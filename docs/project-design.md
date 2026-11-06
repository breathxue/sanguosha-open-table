# 三国杀自由牌桌 · 项目设计

2026-11-06 · 作者：ethanzhangxiangyu-oss（由 Claude 协助整理）

> 在线版本：https://claude.ai/artifact/3W1Qp2UGeWL5SuqGdkrqCS

## 项目概述

这是一张给固定牌友用的线上三国杀牌桌：服务器只同步每个人的操作，出牌、判定、结算、胜负全部由玩家口头裁定，代码里没有规则引擎。产品定位是「线下桌游的线上替代」，而不是自动化对战游戏。

- 目标用户：凑不齐线下局的小圈子，4 到 8 人一桌，通过房间号或邀请链接入座。
- 核心理念：任意可见牌可以移到任意区域，没有「这张牌不能放这里」的拦截；手牌仅本人可见，其余区域全桌公开。
- 内容范围：74 位武将（标准包、风林火山、凌统和 18 位姬系列女版，含技能文案、势力、体力上限，与 public/hero/ 下的牌面图片一一对应）和一副标准普通牌，牌堆各自洗乱倒扣。
- 运行形态：单进程 Node 服务，房间全部保存在内存中，服务重启即清空；目前部署在 http://159.75.6.38/ 做公开测试。
- 代码规模：前后端 TypeScript 约 5,600 行，另有约 5,800 行 CSS；仓库 [breathxue/sanguosha-open-table](https://github.com/breathxue/sanguosha-open-table)，截至 2026-11-05 共 7 次提交，当前版本 bb8bc7b。

## 技术栈与工具链

全栈 TypeScript，前后端共用一份类型定义，没有数据库、没有 UI 框架、没有测试。

| 层 | 选型 | 版本 | 说明 |
| --- | --- | --- | --- |
| 语言 | TypeScript | 5.9 | `strict` 全开，ESM，`noUnusedLocals` 等严格选项 |
| 前端框架 | React + React DOM | 19.2 | 函数组件 + Hooks，无路由库、无状态库 |
| 前端构建 | Vite + `@vitejs/plugin-react` | 7.2 | 开发服务器 5173，`/api` 和 `/ws` 代理到 3000 |
| 样式 | 原生 CSS |  | 单文件 `src/styles.css`，约 5,800 行，响应式适配手机 |
| 后端框架 | Express | 4.21 | 三个 REST 接口 + 静态文件，`compression` 压缩 |
| 实时通信 | ws | 8.18 | 路径 `/ws`，文本 JSON 消息，30 秒心跳 |
| 运行时 | Node.js | ≥ 20.19，服务器 22.14 | 开发用 `tsx` 直接跑 TS |
| 打包 | esbuild | 0.28 | 后端打成单文件 `server.cjs`（本次 PR 新增） |
| 进程管理 | systemd |  | 服务器上 `sanguosha.service`，仓库内另有 Dockerfile 方案 |
| 包管理 | npm |  | `concurrently` 并行启动前后端开发服务 |

npm 脚本：`dev` 同时起后端和 Vite；`build` 先 `tsc --noEmit` 再 `vite build`；`start` 自动构建后用 tsx 启动；`deploy` 调用 `deploy.sh`。

缺失的工具：没有测试框架、ESLint、Prettier、CI，类型检查是唯一的自动化质量门槛。

## 系统架构

```
┌──────────────────────────────┐      POST 拿 Session       ┌──────────────────────────────┐
│ 浏览器 · React 19            │ ─────────────────────────▶ │ Node 进程 · server/index.ts  │
│  App.tsx 屏幕切换            │      GET 页面资源          │  Express REST /api/rooms     │
│  Home / Lobby / GameScreen   │ ─────────────────────────▶ │  静态文件 dist/              │
│  useRoomSocket 重连/心跳     │  动作 / 聊天 ──────────▶   │  ws 服务器 /ws 校验·心跳·限流 │
│  localStorage 会话           │ ◀────── 裁剪后的全量状态   │  RoomStore（内存 Map）       │
└──────────────────────────────┘                            └──────────────────────────────┘
                                                             systemd · CentOS 8.5 · 端口 80
```

浏览器先用 HTTP 换取 Session，再用它建立 WebSocket；之后每个动作经 ws 进入 RoomStore 校验执行，服务端按每个玩家的可见范围裁剪后把完整状态推回所有在线连接。

## 目录结构与模块职责

代码分三层：`server/` 是权威状态和所有校验，`src/shared/` 是前后端共用的协议类型，`src/client/` 是纯展示和交互。后端不导入任何前端代码，前端不包含任何规则判断。

| 路径 | 行数 | 职责 |
| --- | --- | --- |
| `server/index.ts` | 248 | 进程入口：Express 路由、静态文件、WebSocket 接入、限流、心跳、优雅退出 |
| `server/rooms.ts` | 711 | `RoomStore`：房间增删、入座离座、动作校验与执行、按玩家裁剪视图、广播、闲置回收 |
| `server/cards.ts` | 123 | 建牌：普通牌蓝图×花色点数随机分配，武将牌由蓝图生成，洗牌用 `crypto.randomInt` |
| `server/generals.ts` | 1,064 | 74 位武将的静态数据：势力、体力、技能文案和标签 |
| `src/shared/types.ts` | 129 | 协议契约：`TableState`、`TableAction`、`ClientMessage`、`ServerMessage`、`ZoneRef` 及常量 |
| `src/App.tsx` | 169 | 顶层路由：按是否有会话、是否收到状态、房间阶段切换四个屏幕；管理 toast 和 URL 中的 `room` 参数 |
| `src/client/useRoomSocket.ts` | 161 | WebSocket 连接、指数退避重连、心跳、网络事件监听、致命错误码识别 |
| `src/client/api.ts` | 62 | 三个 REST 调用的封装和 `ApiError` |
| `src/client/session.ts` | 57 | 会话和昵称存 localStorage，刷新页面后恢复座位 |
| `src/client/gameState.ts` | 81 | 对 `TableState` 的只读查询：定位牌、可见牌集合、区域名称与计数 |
| `src/client/dnd.ts` | 39 | 桌面端 HTML5 拖拽的 payload 序列化 |
| `src/client/useTouchCardDrag.ts` | 227 | 手机端长按 280 ms 抬起、`elementFromPoint` 命中投放区 |
| `src/client/components/GameScreen.tsx` | 529 | 牌桌主屏：选牌、拖拽、移动对话框、弃牌区、武将详情、离开确认 |
| `src/client/components/HomeScreen.tsx` | 335 | 首页：昵称、自定义房间号创建、输入房间号加入 |
| `src/client/components/LobbyScreen.tsx` | 211 | 等待大厅：座位列表、邀请链接复制、开始牌局 |
| 其余 13 个组件 | 约 1,500 | `PlayerBoard`、`PlayingCard`、`Piles`、`MoveDialog`、`SidePanel`、`TopBar` 等展示组件 |
| `src/styles.css` | 5,801 | 全部样式，10 个媒体查询，最小适配 430 px，支持减弱动效和粗指针设备 |
| `Dockerfile` / `docker-compose.yml` |  | 容器化方案，当前服务器未使用 |
| `deploy.sh` |  | 本次 PR 新增，见部署一节 |

## 领域模型

所有状态就是一个 `Room` 对象，牌是唯一实体，区域只是存放牌 id 的数组。「移动一张牌」就是从一个数组删掉 id 再插到另一个数组，这是整个系统最核心的抽象。

| 实体 | 字段 | 说明 |
| --- | --- | --- |
| Room | `code` 5 位、`hostId`、`phase`（lobby / playing）、`revision`、`players[]`、`cards: Map`、`decks{general, normal}`、`discard[]`、`playerZones: Map`、`logs[]`、`chat[]`、`sockets: Map`、`cleanupTimer` | 房间号字母表去掉了易混淆的 0 O 1 I；日志上限 160 条，聊天 100 条 |
| RoomPlayer | `id`、`name` ≤ 12 字、`seat`、`hp` 初始 4、`token` 24 字节随机、`joinedAt` | `token` 是唯一凭证，没有账号体系 |
| PlayerZones | `hand[]`、`equipment[]`、`judgment[]`、`general[]` | 每个玩家四个区域，存牌 id |
| Card | `id`、`deck`、`name`、`category`（basic / trick / equipment / general）、`suit`、`rank`、`kingdom`、`hp`、`skills[]` | 武将牌和普通牌同一结构，武将多出势力、体力、技能三个字段 |
| ZoneRef | `deck`（含 top / bottom）、`discard`、`player + zone` | 所有动作的目标地址，前后端共用 |

普通牌共 104 张，按蓝图数量展开后用固定步长循环分配花色和点数，因此花色点数不对应标准牌库。武将牌 74 张，来自标准包、风林火山、一将成名（凌统）和姬系列女版，不含神武将，每张对应 public/hero/<武将名>.jpg。

可见性规则是服务端在 `viewFor` 里按玩家裁剪的，前端从未拿到不该看的数据：

- 手牌：只有本人拿到 `hand[]`，其他人只拿到 `handCount`。
- 牌堆：只下发剩余张数，没有任何牌 id，所以前端无法猜牌堆顺序。
- 装备区、判定区、武将区、弃牌区：全桌公开。
- 移动限制：只能移动自己能看见的牌，即自己的手牌和所有公开牌；别人的手牌不能动，牌堆内部的牌只能通过 `moveTop` 取顶。
- 日志脱敏：涉及手牌或牌堆的移动只记录张数，不记录牌名。

生命周期：创建或加入不存在的房间号都会建房；最后一人离开即删房；房主离开由座位最小者接任；所有人断线后 2 小时无人回来则自动删房。

## 通信协议

HTTP 只用于进房拿凭证，进房后一切走 WebSocket。服务端每次状态变化都向每个在线玩家推送一份完整的、按他裁剪过的 `TableState`，没有增量同步。

| 接口 | 请求 | 响应 |
| --- | --- | --- |
| `POST /api/rooms` | `{playerName, roomCode?}` | 201 `Session`，`roomCode` 重复返 409 |
| `POST /api/rooms/:code/join` | `{playerName}` | 201 `Session`；房间不存在则自动创建；满员或重名返 409 |
| `GET /api/rooms/:code` |  | `RoomSummary`，不存在返 404 |
| `GET /api/health` |  | `{ok, rooms, time}` |
| `GET /ws?room=&token=` | WebSocket 升级 | 凭证无效以 4003 关闭 |

`Session` 包含 `roomCode`、`playerId`、`token`、`playerName`，前端存 localStorage，刷新或重连时原样带回。

客户端消息五种：`action`（携带 `TableAction`）、`start`、`leave`、`chat`、`ping`。服务端消息四种：`state`、`error`、`left`、`pong`。

`TableAction` 六种，是整个牌桌的全部操作面：

- `move`：把一组牌 id 移到一个 `ZoneRef`，一次最多 100 张。
- `moveTop`：把某牌堆顶的一张移到 `ZoneRef`，摸牌和翻牌都是它。
- `shuffle`：洗某个牌堆。
- `adjustHp`：给任意玩家体力加减，单次 ± 10 以内，范围 0 到 99。
- `setHp`：把任意玩家体力直接设为某值，0 到 99，供「按武将设体力」按钮使用。
- `setTeam`：把任意玩家标为红队、蓝队或清除标记，大厅阶段也可用，纯展示。

连接维护：服务端 30 秒 ping 一次，两次未应答即断开；客户端 25 秒发一次应用层 `ping`。断线后客户端按 0.8 秒起步、最大 10 秒的指数退避重连，监听浏览器 `online` 事件立即重试。关闭码 4001（已离开）、4003（凭证无效）、4004（房间已结束）视为致命，不重连，直接清会话回首页。

限流：每连接 5 秒内最多 40 个动作、8 秒内最多 8 条聊天；HTTP 请求体上限 32 KB，WebSocket 单消息上限 32 KB。HTTP 接口本身没有限流。

## 前端设计

前端没有全局状态库：服务端推来的 `TableState` 就是唯一数据源，组件只做展示和发送动作，不在本地预演结果。每个动作的生效都要等下一次 `state` 推送，所以没有乐观更新和回滚逻辑。

屏幕切换由 `App.tsx` 按三个条件决定，没有路由库：

1. 没有会话：`HomeScreen`，输昵称、建房或输房间号加入。
2. 有会话但还没收到状态：`ConnectingScreen`，显示连接或重连中。
3. 房间在 lobby 阶段：`LobbyScreen`，座位列表、复制邀请链接、开始牌局。
4. 房间在 playing 阶段：`GameScreen`，牌桌主屏。

`GameScreen` 是最重的组件，持有八个本地 UI 状态：选中的牌 id 集合、移动对话框来源、弃牌区是否展开、离开确认、侧边栏开关、武将详情、桌面拖拽中、触控拖拽中。它把 `send` 包装成 `dispatch(action)` 传给子组件。

| 组件 | 职责 |
| --- | --- |
| `TopBar` | 房间号、连接状态徽标、侧边栏和离开按钮 |
| `PlayerBoard` | 一个玩家的四个区域加体力按钮；自己的板子展开手牌，别人的只显示张数 |
| `Piles` | 两个牌堆和弃牌区；点击摸牌，拖动时显示牌堆顶和牌堆底两个投放区 |
| `PlayingCard` | 单张牌的渲染，武将牌按势力配色，带详情按钮 |
| `DropZone` | 统一的投放区容器，用 `data-drop-zone` 属性序列化 `ZoneRef`，桌面和触控共用 |
| `MoveDialog` | 选中牌后「移动至…」的目标选择，含牌堆顶底选项 |
| `SidePanel` | 操作记录和聊天，手机端为抽屉 |
| `GeneralDetailModal` | 武将技能全文 |

拖拽有两套实现，最终都落到同一个 `move` 或 `moveTop` 动作：

- 桌面：HTML5 Drag and Drop，payload 用自定义 MIME 类型序列化，并同时写入 `text/plain` 兼容。
- 触屏：移动浏览器不触发原生拖拽事件，所以 `useTouchCardDrag` 监听 pointer 事件，长按 280 ms 抬起，移动超过 10 px 取消长按判定，松手时用 `elementFromPoint` 找最近的投放区；快速点击仍走选牌逻辑。

其他约定：所有错误和提示走 `notify` 弹 toast，最多同时三条；邀请链接是 `?room=房间号`，打开时若与本地会话的房间不同则清会话；昵称单独存 localStorage 供下次预填。

## 部署与运维

生产环境是一台腾讯云 2 核 1.7 GB 的 CentOS 8.5 机器，单进程 Node 直接监听 80 端口，没有反向代理、没有 HTTPS、没有域名。仓库自带的 Docker 方案并未使用。

| 项 | 服务器现状 |
| --- | --- |
| 目录 | `/opt/sanguosha/app/`：`server.cjs` 单文件后端约 1.4 MB，`dist/` 前端产物；`/opt/sanguosha/node/` 自带 Node 22.14 |
| 进程 | systemd `sanguosha.service`，专用用户 `sanguosha`，开机自启，崩溃 3 秒后重启 |
| 加固 | `NoNewPrivileges`、`PrivateTmp`、`ProtectSystem=full`、`ProtectHome`，仅保留 `CAP_NET_BIND_SERVICE` |
| 网络 | 22 和 80 对外开放，firewalld 当前关闭，SSH 已改为仅密钥登录 |
| 健康检查 | `GET /api/health` 返回房间数和时间戳 |
| 版本标识 | 服务器上无 git 仓库，现有构建于 2026-11-05 21:15，经比对与仓库 bb8bc7b 一致 |

发布流程由 `deploy.sh` 承担，在本地执行：

1. 安装依赖，`npm run build` 做类型检查和前端构建。
2. esbuild 把 `server/index.ts` 打成 `server.cjs`，连同 `dist/` 和 `BUILD_INFO`（commit、分支、是否 dirty、构建时间）放入 `.deploy/app/`。
3. `tar` 经 ssh 上传到 `/opt/sanguosha/app.<时间戳>`。
4. 服务器上原子切换：旧 `app` 改名 `app.prev`，新目录改名 `app`，重启服务。
5. 轮询健康检查最多 15 秒，失败则打印日志并自动切回 `app.prev`。

`./deploy.sh --rollback` 手动回滚，`--dry-run` 只构建不上传，`DEPLOY_HOST` 等环境变量可指向其他机器。该脚本在 [PR #1](https://github.com/breathxue/sanguosha-open-table/pull/1) 中，尚未合并。

重启即清空所有房间，所以每次发布都会打断正在进行的牌局，建议在没有房间时发布，可先看 `/api/health` 的 `rooms` 字段。

## 现存问题与风险

代码质量整体良好，输入校验和可见性控制做得比较仔细。下面是从代码和部署中发现的具体问题，按严重程度排序。

| 严重度 | 问题 | 位置 | 影响 |
| --- | --- | --- | --- |
| 高 | 只通过 HTTP 建房、从不连 WebSocket 的房间永不回收 | `rooms.ts` `detachSocket` | 清理定时器只在断开时设置，脚本连续调用 `POST /api/rooms` 可无限占用内存，1.7 GB 机器很快被打满 |
| 高 | HTTP 接口没有限流 | `index.ts` | 配合上一条，建房和加入都可被刷；自动建房的加入接口让任意 5 位字符串都能占房 |
| 高 | 明文 HTTP，凭证在 URL 查询参数里 | 部署 + `useRoomSocket.ts` | 同一网络可窥探 token 冒充玩家；浏览器对非 HTTPS 页面限制剪贴板和分享 API |
| 中 | 没有任何自动化测试 | 全仓库 | `performAction` 的移动和可见性规则是核心逻辑，改动只能靠手测 |
| 中 | 每次动作向每个玩家推送全量状态 | `rooms.ts` `broadcast` | 含 160 条日志和 100 条聊天，8 人桌每个动作序列化 8 次；当前规模可接受，房间多了会成瓶颈 |
| 中 | 重启即丢失所有房间 | 架构 | 发布和崩溃都会打断牌局，玩家会被踢回首页 |
| 中 | 服务器防火墙关闭，没有反向代理 | 部署 | Node 直接暴露在公网，没有请求日志、连接数限制和 TLS 终结 |
| 低 | 任何玩家可改任何人体力、任何人可开局 | `rooms.ts` | 符合「无规则」设计，但对陌生人开放时会被捣乱小；当前定位是熟人局，可接受 |
| 低 | 单文件 CSS 5,800 行 | `styles.css` | 样式没有和组件对应，改动时难以判断影响面 |
| 低 | 服务器部署方式与仓库 Docker 方案脱节 | 部署 | `server.cjs` 的打包命令之前不在仓库里，`deploy.sh` 合并后解决 |

第一条的修复很小：建房时就启动一个较短的定时器，若在例如 2 分钟内没有任何 WebSocket 接入则删房。第二条可用按来源 IP 的令牌桶限流，或在前面加 Nginx 的 `limit_req`。

## 演进路线

建议先把现有单机架构做稳，再考虑持久化和规模。当前定位是熟人局，单进程内存模型在可预见的用量下足够，不必过早引入数据库或多实例。

**短期，不改架构**

- [ ] 合并 `deploy.sh`，打通本地到服务器的发布和回滚。
- [ ] 修复未接入房间永不回收的问题，给 HTTP 接口加按 IP 限流。
- [ ] 给 `performAction` 和 `viewFor` 写单元测试（Vitest 与 Vite 同源，接入成本最低），覆盖移动规则和可见性。
- [ ] 加 ESLint 和 GitHub Actions，PR 自动跑 `typecheck`、lint 和测试。
- [ ] 服务器重新打开防火墙，前面加 Nginx 或 Caddy 做反向代理，配域名和 HTTPS，Node 改回监听 127.0.0.1:3000。

**中期，提升体验**

- [ ] 状态快照落盘：每次 `touch` 后把房间序列化到本地文件或 SQLite，启动时恢复，让发布不再打断牌局。
- [ ] 增量同步：日志和聊天改为只推新增条目，或按 `revision` 做差分。
- [ ] 房主权限开关：可选限制只有本人能改自己体力、只有房主能开局和洗牌。
- [ ] CSS 按组件拆分或改用 CSS Modules。
- [ ] 扩展包和神武将作为可选牌堆，建房时勾选。

**长期，只在用量增长后考虑**

- [ ] 多实例：房间状态迁到 Redis，按房间号做一致性路由或用 Redis Pub/Sub 转发广播。
- [ ] 观战模式和回放：操作日志已经是事件流，改成事件溯源即可支持。
- [ ] 可选规则辅助：在不强制的前提下提示判定、距离等，保持「服务器不拦截」的核心理念。
