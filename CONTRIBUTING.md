# Contributing

欢迎反馈可复现的问题。这个项目以稳定的本地浏览和编辑体验为优先。

提交问题时请说明系统、桌面应用版本、插件版本、操作步骤和预期结果。
优先提供最小的虚构 Markdown / CSV / 图片样例，请不要提交个人文档或访问令牌。

修改前运行 `python build.py`；提交前运行 `python check.py`。
完整 PDF 测试需要 `requirements-dev.txt`，JavaScript 回归需要 Node.js。
新增文件格式必须保持惰性读取、边界检查和可理解的错误回退。

不要提交 `plugins/`：它是构建输出，其中 `.mcp.json` 包含当前机器的路径。
第三方库的许可证与校验记录须随升级一同维护。

本项目由 HuSiyue-ai 基于实际使用需求设计并持续验证，开发过程使用 AI 辅助。
