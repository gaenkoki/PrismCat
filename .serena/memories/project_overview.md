# PrismCat 项目概览

- 目的: 自托管的 LLM API 透明代理与流量观测工具，支持按子域名转发、请求/响应日志、SSE 流式日志、回放等能力。
- 后端: Go 单体应用，入口在 `cmd/prismcat`，主要业务在 `internal/`。
- 前端: `web/` 下的 React 19 + TypeScript + Vite 应用，使用 i18n、Radix/shadcn 风格组件、Tailwind 体系。
- 存储: SQLite，本地 YAML 配置文件，默认数据目录在 `data/`。
- 关键目录:
  - `cmd/prismcat`: 可执行入口
  - `internal/api`: HTTP API
  - `internal/config`: 配置加载与保存
  - `internal/proxy`: 代理逻辑
  - `web/src/pages`: 页面
  - `web/src/components`: 前端组件
  - `web/src/lib`: API 请求与工具函数
- 运行形态: 本地二进制或 Docker。