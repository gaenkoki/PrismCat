# 常用命令（Windows / PowerShell）

- 查看前端脚本: `Get-Content web/package.json`
- 启动前端开发环境: `cd web; npm run dev`
- 构建前端: `cd web; npm run build`
- 前端静态检查: `cd web; npm run lint`
- 构建 Go 主程序: `go build ./cmd/prismcat`
- 运行 Go 测试: `go test ./...`
- 启动主程序（二进制已构建时）: `./prismcat.exe` 或 `go run ./cmd/prismcat`
- 搜索文本（优先）: `rg <pattern>`
- 查看 git 状态: `git status --short`

备注: 当前会话里 shell 工具有异常时，可优先改用 Serena 做搜索、读取与编辑。