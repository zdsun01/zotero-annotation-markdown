# Zotero Annotation Markdown — 图片与表格增强版

[English](README.md) | 简体中文

在 Zotero 批注评论中直接粘贴截图、表格，并在预览下方继续写文字。

本修改版由 [zdsun01](https://github.com/zdsun01) 维护，基于 **[qrkks](https://github.com/qrkks)** 开发的 **[Zotero Annotation Markdown](https://github.com/qrkks/zotero-annotation-markdown)**。Markdown 渲染、数学公式、快速编辑器等基础能力来自原作者及上游贡献者；本仓库新增剪贴板图片、表格转换和预览下方续写功能。这是独立维护的衍生版本，并非原作者的官方发布。

当前版本：**`0.15.4-clipboard.6`**。开发目标环境：**Windows / Zotero 10.0.6**。

## 本版新增功能

| 功能 | 效果 |
| --- | --- |
| 截图直接粘贴 | 在批注评论中按 **Ctrl+V**，将截图保存为 Zotero 图片附件，并插入 Markdown 图片引用。 |
| 图片、表格下方续写 | 点击预览底部的 **继续输入文字…**，保留上方预览，在下方输入框继续写说明。 |
| 复制粘贴表格 | 将 Excel、Word、网页提供的 HTML 表格转换为可编辑的 Markdown 表格，也支持规则的制表符分列文本。 |
| 表格排版预览 | 保存后显示表格边框，较宽的表格可以横向滚动。 |
| 粘贴与保存衔接 | 导入截图时等待保存完成，处理按 Esc、失焦等时序；保存失败时保留草稿。 |
| 按 Delete 删除整条批注 | 修复预览显示后焦点残留在隐藏评论框中导致快捷键失效的情况；编辑文字时仍按正常方式删除文字。 |

保留上游的 Markdown、LaTeX 公式、浮动大纲、彩色高亮及可选 SVG 功能。详细说明见[使用指南](docs/zh-CN/user-guide.md)。

## 构建与安装

上述增强功能包含在**本仓库源码**中。原项目的插件市场版本和官方 Release 不包含这些修改。

使用 Node.js 24，以及 `package.json` 指定版本的 pnpm：

```powershell
git clone https://github.com/zdsun01/zotero-annotation-markdown.git
cd zotero-annotation-markdown
pnpm install --frozen-lockfile
pnpm run package
```

1. 构建后得到 `dist/zotero-annotation-markdown.xpi`。
2. 在 Zotero 中打开 **工具 → 插件**，安装该 XPI，然后重启 Zotero。
3. 在插件设置中开启 **使用快速批注评论编辑器** 和 **将页面批注弹窗渲染为 Markdown**。

本版沿用原插件 ID，安装时会替换原版。`-clipboard.` 版本关闭上游自动更新，避免增强功能被覆盖。重新安装原作者的 XPI 可恢复原版，此后可在插件管理器中重新开启自动更新。

## 使用方法

### 粘贴截图与继续输入

1. 复制截图，点击批注评论，在编辑框内按 **Ctrl+V**。
2. 等待图片保存完成，按 **Esc** 或点击其他位置，查看图片预览。
3. 点击预览下方的 **继续输入文字…**，继续写说明，也可以再粘贴截图或表格。
4. 按 **Esc** 或点击其他位置，保存新增内容。

图片保存为 Zotero 的普通附件：与 PDF 位于同一文献条目下；独立 PDF 的图片保存到文献库顶层。批注中使用附件的稳定引用。同步沿用 Zotero 文件同步设置，其他电脑需要安装此修改版并下载对应附件。删除批注中的图片引用不会自动删除图片附件。手机原生阅读器和导出的 PDF 不会自动嵌入这些预览图片。

支持 PNG、JPEG、GIF、WebP，**每张不超过 8 MiB**。

### 粘贴表格

从 Excel、Word 或网页复制一个表格，在批注编辑框按 **Ctrl+V**，再按 **Esc** 查看表格。如果剪贴板同时包含 HTML 表格与截图，会优先使用可编辑的表格。纯文本表格至少需要两行、两列，以制表符分列，且每行列数一致。

- 第一行作为表头，保留文字和行列位置。
- 合并单元格展开为普通网格，文字保留在左上格，其余占位格留空。
- 单元格内换行显示为 `⏎`；不保留字体、颜色、内嵌图片和电子表格计算功能。
- 限制为 **200 行、50 列、2,000 个网格单元**；多个表格、嵌套表格或混合正文选区不执行表格转换。

完整编辑界面仍使用 Markdown 源码，本版不是完整的所见即所得编辑器。

### 删除整条批注

关闭右键菜单，选中批注并处于预览状态时，按 **Delete**，效果与菜单中的「删除」一致：删除整条批注，包括对应的高亮或便笺，而不只是清空评论或删除单张图片。正在可见输入框中编辑文字时，Delete 仍只删除文字。删除走 Zotero 原有命令，可通过 Zotero 撤销；截图附件仍保留在文献库中。

从 `0.15.4-clipboard.6` 起，也支持图中这种情况：**点击 PDF 下划线后，空评论框自动聚焦，在尚未输入或粘贴内容时按 Delete，删除该下划线批注**。已有评论、续写框，以及已经开始输入过的评论框仍保持文字编辑行为；输入后再清空也不会因此删除下划线。

## 验证情况与问题反馈

已通过 `pnpm run verify`：**49 个测试文件、1,253 项测试**，以及类型检查、文档检查、构建和打包。截图粘贴已由用户在 Zotero 10.0.6 中确认可用；预览下方续写、表格粘贴和 Delete 补救有自动化测试，真实 Zotero 中的 Delete、各来源应用到 Zotero 的表格 Ctrl+V 和跨设备同步仍待人工验证。清单沿用上游的 Zotero 9 兼容声明，但本版新增功能尚未在 Zotero 9 中验证。

本修改版的问题请提交到[本仓库 Issues](https://github.com/zdsun01/zotero-annotation-markdown/issues)，附上 Zotero 版本、插件版本和复现步骤。示例表格或批注请使用不含隐私的内容。

## 文档与原作者引用

- [使用指南](docs/zh-CN/user-guide.md)
- [架构说明](docs/zh-CN/architecture.md)与[开发指南](docs/zh-CN/development.md)
- [更新日志](CHANGELOG.md)
- [图片验证记录](docs/test-evidence/2026-10-20-clipboard-images.md)与[表格验证记录](docs/test-evidence/2026-10-20-clipboard-tables.md)
- **原作者：**[qrkks](https://github.com/qrkks)
- **原项目：**[qrkks/zotero-annotation-markdown](https://github.com/qrkks/zotero-annotation-markdown)
- **修改起点：**上游提交 [`d203ea5`](https://github.com/qrkks/zotero-annotation-markdown/commit/d203ea5)
- **本修改版维护者：**[zdsun01](https://github.com/zdsun01)

感谢原作者和上游贡献者提供的基础实现。本仓库保留的原有演示图片和上游文档也来自原项目。

## 许可证

本项目继续采用 **[AGPL-3.0-or-later](LICENSE)**，保留原作者的 **Copyright (c) 2026 qrkks** 声明。[NOTICE](NOTICE) 中保留原项目声明并注明本修改版的来源与新增功能。

原项目已发布的 v0.15.4 及更早版本采用 MIT，相应的[历史 MIT 声明](licenses/MIT-legacy.txt)予以保留；这不代表当前修订版可选择 MIT 授权。第三方组件保留各自的许可证。打包的 XPI 包含许可声明及对应的项目、依赖源码快照，详见包内 `SOURCE.txt`。
