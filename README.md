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

## 接入

1. 先在独立配置目录中试用，不覆盖正在使用的 `~/.omp/agent`。把 `lcp.json` 和 `native-routing.config.json` 放到该目录，设置 `PI_CODING_AGENT_DIR` 指向它。LCP 的 `lcp-ctl` 和运行时由已有安装提供，本仓不包含宿主补丁或安装器。也可把路由文件作为支持 `--config` 的 OMP 宿主 overlay 使用；受管预设校验、闭合角色回退等行为以宿主能力为准。
2. 把 `example-provider-N/model-name` 视为匿名路由标记，不是可请求的模型。按自己的模型目录替换它们（包括 `enabledModels`、角色、回退键和回退成员），或删除不需要的候选。保留原生 Codex 和智谱模型选择器作为配置参考；能否调用取决于本机目录和账号权限。搜索、图像、语音和决策模型需要各自匹配的能力，不使用任意聊天模型替代。
3. 预设可放到该目录的 `agents/`；只复制宿主尚未内置、同名未注册的技能到 `skills/`。能否使用预设中列出的工具或 MCP，仍由宿主和当前会话授权决定；复制预设不会授予权限。
4. 用 `lcp-ctl config check` 检查启动配置，再用 `lcp-ctl roles --json` 核对角色计划。后者是离线检查，不会验证模型可用性或推理权限。确认候选均已配置，再启动会话尝试 `@default` 和一个子 agent。

需要自定义 provider 时，参考 [`models.yml`](examples/models.yml) 把相应条目合并入自己的模型目录；API key 只通过本机环境注入。需要 Codex 多账号策略时，再按 [`codex-session.config.json`](examples/codex-session.config.json) 填写自己的账号选择器，并加入 `lcp.json` 的 `overlays`。示例端点和账号均不可用，不要将填写后的文件提交。

快照没有包含真实账号、凭证、私有端点、原始 provider 目录、本机路径、项目记忆、会话缓存或原仓 Git 历史。
