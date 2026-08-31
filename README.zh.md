# dsh-mermaid-smooth

[English](README.md) | 中文

将 DeepSeek Harness（dsh）Web 对话中的 mermaid 代码围栏**默认渲染为图**：丝滑的缩放与拖拽，每张图右上角提供图/文案切换，偏好按围栏记忆，明暗主题跟随，渲染引擎完全本地打包（零 CDN）。

- **默认成图** — 助手消息中的 mermaid 围栏一旦完整立即渲染为 SVG 图；非 mermaid 代码块不受影响。
- **丝滑交互** — 滚轮缩放以指针为锚点（单一 transform 合成 + 短过渡），拖拽平移 1:1 跟手，双击适应/复位；系统开启「减少动态效果」时全部动画禁用。
- **右上角切换** — 每张图卡片有「图/文案」切换按钮；一条消息中的多个围栏各自独立。
- **按围栏记忆** — 切换状态存于 localStorage（以围栏源码为键），刷新页面、重连后保持。
- **主题跟随** — 图随 GUI 明暗主题重新渲染。
- **安全离线** — mermaid 以 securityLevel 'strict' 运行（内置消毒、不绑点击事件），引擎打包进插件本体（零 CDN）；渲染失败的围栏保留原代码并内联错误条。卸载插件后对话原样还原。

## 截图

![1](docs/1.png)

![2](docs/2.png)

![3](docs/3.png)

## 安装

两种方式任选其一，装完重启 DSH Web 即生效（当前会话会中断，但 DSH 会话有磁盘持久化，重启后可以恢复）。

**方式一：从 GitHub 安装（固定到指定提交）**

```sh
dsh plugin --profile web add 'github:gitByteFree/dsh-mermaid-smooth#<40位commit>'
```

固定到你想装的 commit（如仓库提交历史页显示的 main HEAD），之后 main 的新改动不会静默改变已安装代码。源码安装时会在本机构建（`prepare` 脚本执行 esbuild 打包），需要 git 与 Node.js ≥ 20。

**方式二：克隆后从本地路径安装（开发迭代）**

```sh
git clone git@github.com:gitByteFree/dsh-mermaid-smooth.git
cd dsh-mermaid-smooth
dsh plugin --profile web add .
```

安装后重启 web 应用（`dsh web` 或你的 `dsh-web` 服务），使新 bundle 层生效。

## 许可

MIT
