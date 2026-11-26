# OMP 模型路由与子 agent 委派

一份从 OMP/LCP 19.0.1 配置整理出的脱敏快照。预设只声明一个 `@role`；模型、推理档位和有序回退链集中在同一个配置文件，不在提示词里重复维护。

| 文件 | 用途 |
| --- | --- |
| [`native-routing.config.json`](native-routing.config.json) | 模型选择列表、角色与别名、推理档位、角色回退及具体模型回退 |
| [`lcp.json`](lcp.json) | 最小 LCP 启动配置，加载路由 overlay；不启用 Workbench、Risk Guard 或 Codex 账号偏好扩展 |
| [`agents/`](agents/) | 12 个子 agent 预设，覆盖只读查证、实现、审查和视觉工作 |
| [`skills/subagent-coordination/`](skills/subagent-coordination/) | 顶层会话使用的委派指南：何时内联或委派、怎么选预设、如何交接与验收 |
| [`skills/`](skills/) | 另含 `frontend-engineer` 预设对应的两份前端技能 |
| [`examples/`](examples/) | 自定义 provider 和 Codex 多账号策略的独立示例，默认不加载 |
| [`packages/host/`](packages/host/) | LCP 19.0.1 的 14 项宿主补丁、原始 diff、应用顺序和构建工具 |
| [`patches/`](patches/) | 按宿主系列生成的 4 份 Bun 补丁，安装时自动应用 |

## 接入

1. 先在独立配置目录中试用，不覆盖正在使用的 `~/.omp/agent`。已有 LCP 安装时，把 `lcp.json` 和 `native-routing.config.json` 放到该目录，设置 `PI_CODING_AGENT_DIR` 指向它。没有 LCP 安装时，用下面的源码入口；它不依赖已有的 `lcp` 二进制。
2. 把 `example-provider-N/model-name` 视为匿名路由标记，不是可请求的模型。按自己的模型目录替换它们（包括 `enabledModels`、角色、回退键和回退成员），或删除不需要的候选。保留原生 Codex 和智谱模型选择器作为配置参考；能否调用取决于本机目录和账号权限。搜索、图像、语音和决策模型需要各自匹配的能力，不使用任意聊天模型替代。
3. 预设可放到该目录的 `agents/`；只复制宿主尚未内置、同名未注册的技能到 `skills/`。能否使用预设中列出的工具或 MCP，仍由宿主和当前会话授权决定；复制预设不会授予权限。
4. 已有 LCP 时，用 `lcp-ctl config check` 和 `lcp-ctl roles --json` 核对启动配置和角色计划。这两项是离线检查，不会验证模型可用性或推理权限。确认候选均已配置，再启动会话尝试 `@default` 和一个子 agent。

需要自定义 provider 时，参考 [`models.yml`](examples/models.yml) 把相应条目合并入自己的模型目录；API key 只通过本机环境注入。需要 Codex 多账号策略时，再按 [`codex-session.config.json`](examples/codex-session.config.json) 填写自己的账号选择器，并加入 `lcp.json` 的 `overlays`。示例端点和账号均不可用，不要将填写后的文件提交。

## 从补丁源码运行宿主

使用 Bun 1.4.4 或更高版本。在本仓目录执行：

```sh
bun install --frozen-lockfile --ignore-scripts
bun run host:check
bun run omp:patched --version
```

上游包的 `dist/cli.js` 是预打包入口，不会读取这里修改的源码；`omp:patched` 直接运行打补丁后的 `src/cli.ts`。先把路由模板和委派 skill 复制到隔离目录：

```sh
export PI_CODING_AGENT_DIR="$PWD/.local/agent"
mkdir -p "$PI_CODING_AGENT_DIR/skills"
cp -R skills/subagent-coordination "$PI_CODING_AGENT_DIR/skills/"
cp native-routing.config.json "$PI_CODING_AGENT_DIR/"
```

填好隔离目录中的模型目录与路由副本后，从同一终端启动：

```sh
bun run omp:patched --config "$PI_CODING_AGENT_DIR/native-routing.config.json" --model @default
```

在这个独立目录中完成模型认证；不要从主目录复制真实凭证。子 agent 预设和两份前端 skill 已由补丁内置，不必重复安装。此入口只运行 OMP 宿主，不读取 `lcp.json`，也不加载 LCP 的 Workbench 或 Risk Guard 扩展。

### 维护补丁

[`series.json`](packages/host/series.json) 列出完整应用顺序。其中 `startup`、`role-plans`、`scenario-roles`、`managed-presets`、`subagent-context` 和 `frontend-engineer` 对应配置覆盖、角色回退、后台模型及子 agent 行为。其余宿主补丁保留在原顺序中，避免裁去后续 diff 所依赖的修改；本仓不包含这些补丁可能对接的 LCP 扩展应用。

维护源在 `packages/host/features/<feature>/patches/`。按序更新源后用 `bun run host:build` 生成聚合补丁，再用 `bun run host:check` 核对。生成文件不要手改。检查和生成默认从 Bun 安装缓存取固定版本的未打补丁包，也可用 `--pristine-root <dir>` 指定原始包目录。

快照没有包含真实账号、凭证、私有端点、原始 provider 目录、本机路径、项目记忆、会话缓存或原仓 Git 历史。
