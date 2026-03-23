# 任务完成前检查

- 如果改了前端页面或前端 API 类型，至少检查 `web/src/pages`、`web/src/components`、`web/src/lib/api.ts` 的调用一致性。
- 如果改了后端配置或 API，检查 `internal/config`、`internal/api` 以及前端对应字段是否同步。
- 前端改动优先运行 `cd web; npm run build`，有条件时再跑 `cd web; npm run lint`。
- 后端改动优先运行 `go test ./...` 或至少 `go build ./cmd/prismcat`。
- 清理临时文件，尤其是 `.claude/` 下预览脚本、日志等非源码产物。
- 提交前再次确认 diff 是否最小化，避免顺手格式化或无关修改。