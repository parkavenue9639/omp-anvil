<p align="center">
  <img src="assets/anvil.svg" width="124" height="87" alt="">
</p>

<h1 align="center">OMP Anvil</h1>

<p align="center"><strong>按角色委派，按风险审查，按项目留存记忆。</strong></p>
<p align="center">
  独立的 <a href="https://github.com/can1357/oh-my-pi">Oh My Pi</a> 发行版，提供专用子 agent、角色模型回退、Risk Guard 宿主接口与分类记忆。
</p>

<p align="center">
  <a href="packages/host/series.json"><kbd>Oh My Pi 19.0.1</kbd></a> ·
  <a href="https://bun.sh/"><kbd>Bun ≥ 1.4.4</kbd></a> ·
  <a href="LICENSE"><kbd>MIT</kbd></a>
</p>

<p align="center"><a href="README.md">English</a> · <strong>简体中文</strong></p>

<p align="center">
  <a href="#快速上手">快速上手</a> ·
  <a href="#risk-guard-工具审批">Risk Guard</a> ·
  <a href="#分类记忆">分类记忆</a> ·
  <a href="#补丁目录">补丁目录</a> ·
  <a href="#社区与反馈">社区</a>
</p>

Anvil 面向需要长期维护编码 agent 的开发者：把实现和审查交给不同专长的子 agent，让受信扩展接入原生工具审批，只将适合长期保留的事实写入对应记忆库。它直接修改 OMP 宿主，不是在上面再套一层任务调度器。

## 快速上手

需要 **Bun 1.4.4 或更高版本**和 Git。在仓库根目录运行：

```sh
git clone https://github.com/parkavenue9639/omp-anvil.git
cd omp-anvil
bun install --frozen-lockfile --ignore-scripts
bun run omp:patched --version
```

`omp:patched` 从打过补丁的源码启动。上游包的预打包入口 `dist/cli.js` 不会读取这些源码修改。

首次试用时，将路由模板和委派 skill 复制到隔离目录，不覆盖自己的 OMP 配置：

```sh
export PI_CODING_AGENT_DIR="$PWD/.local/agent"
mkdir -p "$PI_CODING_AGENT_DIR/skills"
cp -R skills/subagent-coordination "$PI_CODING_AGENT_DIR/skills/"
cp native-routing.config.json "$PI_CODING_AGENT_DIR/"
```

在隔离目录里完成认证并编辑 `native-routing.config.json` 副本。`example-provider-N/model-name` 是示例选择器，请在模型列表、角色和回退链中替换为已配置的模型，或移除不用的候选。搜索、图像、语音和决策模型需要相应的供应商能力。自定义 provider 可参考 [`examples/models.yml`](examples/models.yml)，将密钥通过本机环境注入，不写进模板。

```sh
bun run omp:patched --config "$PI_CODING_AGENT_DIR/native-routing.config.json" --model @default
```

受管预设和两份前端 skill 已内置。已有 LCP 启动器的用户也可以使用 [`lcp.json`](lcp.json) 加载同一模板；该文件和 [Codex 账号策略示例](examples/codex-session.config.json) 都不是独立源码入口的前置条件。

## Anvil 改了什么

### Risk Guard 工具审批

Anvil 随宿主交付 Risk Guard 所用的 [`approval-review` 补丁](packages/host/features/approval-review/)。受信扩展可以通过 `pi.registerToolApprovalReviewer` 审查原本会弹出人工确认的工具调用。原生明确的允许或拒绝不被改写，provider 安全确认仍由人处理。

- 审查者全部弃权时，保留原生确认；任一审查者拒绝则拒绝。审查错误或超时也不会放行。
- 批准只对本次调用有效，不会保存为长期授权。

**交付边界：**公开版包含审批接口与门禁行为，不附带 LCP 的完整 Risk Guard 策略扩展。未加载审查扩展时，工具仍走 OMP 原生审批；这不是操作系统沙箱。

### 分类记忆

[`memory-routing` 补丁](packages/host/features/memory-routing/) 在向 Mnemopi 写入前，先用独立、无工具的模型调用提取长期事实。比如，某个仓库的构建约定留在**项目库**，跨项目通用的工作偏好可进**全局库**，一次性细节可**跳过**，不确定内容可进入**待决队列**。原始对话不会直接写入召回库；会话历史不受此规则影响。

默认关闭。在快速上手所用的本地 `native-routing.config.json` 中合并下列字段，并将 `modelRoles.memory` 指向可用模型。开启 Git 自动登记后，同一仓库的 worktree 共用项目身份。通过 `/memory queue` 查看待决项；跨项目只读召回需另开 `memoryRouting.crossProjectRead`。

```json
{
  "memory": { "backend": "mnemopi" },
  "mnemopi": { "scoping": "per-project-tagged", "llmMode": "none" },
  "memoryRouting": { "enabled": true, "autoRegisterProjects": true }
}
```

### 角色模型与回退

代码审查时，`review` 预设绑定 `@review`；前端实现时，`frontend-engineer` 绑定 `@frontend`。模型、推理档位和回退顺序由你为角色配置，换 provider 不必重写预设。推理遇到符合回退策略的故障时，宿主使用该角色的候选链；恢复会话时仍保留原角色计划。标题、空闲回顾和本地记忆也能各用自己的角色。

### 子 agent 分工与委派

内置 **12 个受管预设**，覆盖只读调查、局部修复、复杂实现、独立审查和前端工程。发到同仓的其他 worktree 时，子 agent 从目标检出加载项目规则和技能。配套的 [委派指南](skills/subagent-coordination/) 讲清什么时候该自己做、什么时候该拆任务，以及怎样交接和验收。

### 可审查、可重建的宿主补丁

Anvil 固定上游 **OMP 19.0.1**，在官方发行包上按顺序应用补丁。你可以看清每项宿主改动、按原顺序重建 Bun 安装补丁，也能在升级上游时逐项核对差异，无须维护一份完整的上游源码副本。

> [!NOTE]
> Anvil 独立于上游维护，当前从源码分发，无须本机已有的 LCP 二进制。本仓不包含 Workbench 或个人部署数据。

## 补丁目录

以下按 [`series.json`](packages/host/series.json) 的应用顺序列出相对上游 OMP 19.0.1 的变化。标为「扩展接口」的条目是宿主提供的能力，不代表 Anvil 随附了使用这些接口的扩展应用。

| 补丁 | 具体变化 | 如何生效 |
| --- | --- | --- |
| [`fixes`](packages/host/features/fixes/) | 修复 Tern 原生卡片读取空文件时的崩溃、Advisor 自动审批的上下文传递，以及自定义配置目录下的数据和缓存定位；缓存有效的 Devin JWT，减少重复鉴权。 | 宿主内置 |
| [`startup`](packages/host/features/startup/) | 使用 `--config` 或 `--trusted-extension` 时仍可先绘制首屏，等扩展就绪再接收提交；若能识别启动模型所属 provider，只刷新相关模型目录。 | 宿主内置 |
| [`extension-api`](packages/host/features/extension-api/) | 扩展可调用宿主裁判模型、处理工具结果卡片点击、等会话真正空闲再切换模型，以及获取输入改写前的原文。 | 扩展接口 |
| [`approval-review`](packages/host/features/approval-review/) | Risk Guard 所用的宿主门禁：审查原本需要人工确认的工具调用；原生明确的允许或拒绝不变。 | 需加载受信审查扩展；本仓不附带策略 |
| [`role-plans`](packages/host/features/role-plans/) | 每个 `@role` 拥有自己的有序回退链；别名未配置单独回退时可继承目标角色的链。角色和候选计划随会话保存与恢复。 | 配置 `modelRoles` 与 `retry.fallbackChains` |
| [`scenario-roles`](packages/host/features/scenario-roles/) | 可给会话标题、空闲回顾和本地记忆处理分配独立角色，避免后台任务借用前台模型。 | 按场景配置 `@title`、`@recap`、`@memory` |
| [`managed-presets`](packages/host/features/managed-presets/) | 受管子 agent 只绑定一个纯 `@role`，不写死模型或推理档位。在 `/agents` 和 Alt+P 中为受管预设选择角色；限制 `creative` 的工具范围。 | 内置预设和原生界面 |
| [`memory-routing`](packages/host/features/memory-routing/) | 在 Mnemopi 写入前对候选内容分类，决定写入项目库或全局库、跳过或进入待决队列；支持按权限跨项目只读检索。原始对话不会直接写入召回库。 | `memoryRouting.enabled` 默认关闭；跨项目读取另行启用 |
| [`message-converters`](packages/host/features/message-converters/) | 扩展可定制自定义消息进入模型上下文时的表示，恢复历史后也适用；不改写原始会话记录。 | 扩展接口 |
| [`thinking-state`](packages/host/features/thinking-state/) | 扩展能区分用户配置的推理模式、最近一次自动解析结果和当前实际档位；配置的模式可随会话恢复。 | 宿主状态与扩展接口 |
| [`extension-completion`](packages/host/features/extension-completion/) | 注册工具执行期间可用 `ctx.complete` 向指定模型发起一次无工具推理。请求不带会话历史，不切换主模型，也不走角色回退链。 | 扩展接口 |
| [`executor-session-lifecycle`](packages/host/features/executor-session-lifecycle/) | `--resume-exact` 先取得写入锁，再打开指定会话。受信扩展可持久化执行器输入、核对处理回执及协调停止，不必靠进程退出状态猜测会话进度。 | 宿主 CLI 与受信扩展接口 |
| [`subagent-context`](packages/host/features/subagent-context/) | 子 agent 能发现目标检出的项目说明、技能与规则；派发时可通过 `cwd` 绑定当前工作区或同仓的已注册 worktree。明确禁止再次派发的预设不会获得 `task` 工具。 | 子 agent 派发 |
| [`frontend-engineer`](packages/host/features/frontend-engineer/) | 内置前端工程预设及两份配套技能。前端会话可从父会话继承限定的 Figma / Context7 只读 MCP 方法；不会自动建立连接或授予账号权限。 | 选择 `frontend-engineer` 预设 |

## 仓库结构

| 路径 | 用途 |
| --- | --- |
| [`packages/host/series.json`](packages/host/series.json) | 上游版本固定点与补丁应用顺序 |
| [`packages/host/features/`](packages/host/features/) | 按宿主特性维护的原始 diff |
| [`patches/`](patches/) | 由补丁系列生成的四份 Bun 安装补丁 |
| [`agents/`](agents/) · [`skills/`](skills/) | 角色预设、委派指南与配套技能 |
| [`native-routing.config.json`](native-routing.config.json) · [`examples/`](examples/) | 可复用配置模板，不含实际账号或私有端点 |

## 社区与反馈

- **Anvil 的问题和建议**：发到 [Anvil Issues](https://github.com/parkavenue9639/omp-anvil/issues)；提交补丁前可先看 [贡献指南](CONTRIBUTING.md)。
- **Oh My Pi 上游**：[官网](https://omp.sh/) · [官方 Discord](https://discord.gg/4NMW9cdXZa) · [GitHub Discussions](https://github.com/can1357/oh-my-pi/discussions)。OMP 生态项目和使用经验可在 [Show and tell](https://github.com/can1357/oh-my-pi/discussions/categories/show-and-tell) 分享。这些是上游社区，不是 Anvil 的官方支持渠道。

## 贡献与许可证

修补宿主时改维护源，使用 `bun run host:build` 重新生成安装补丁，再运行 `bun run host:check`。不要直接编辑 `patches/`。补丁升级、变更同步和隔离验证见[贡献与维护指南](CONTRIBUTING.md)。

项目使用 [MIT 许可证](LICENSE)；上游许可证及版权声明保留在 [`packages/host/LICENSE.upstream`](packages/host/LICENSE.upstream)。
