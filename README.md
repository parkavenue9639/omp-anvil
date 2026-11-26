# OMP Anvil

**基于 [Oh My Pi](https://github.com/can1357/oh-my-pi) 的深度定制编码 Agent 发行版。**

Anvil 以官方发布的 OMP **19.0.1** 为基线，将宿主修改维护成可审查、可重建的有序补丁，并交付能独立运行的宿主、子 agent 预设与协作技能。项目升级时审查的是补丁与上游版本之间的差异，不需要维护一份完整的上游源码副本。

## Anvil 改了什么

- **宿主补丁**：14 项特性覆盖启动、扩展接口、模型路由、原生界面、记忆路由和子 agent 生命周期。维护源与 Bun 安装产物分开。
- **角色模型与回退**：用 `@role` 表达任务需求；模型、推理档位和回退顺序由配置决定。角色计划随会话保留，标题、空闲回顾和记忆处理可使用独立模型。
- **受管子 agent**：12 个专用预设覆盖侦察、实现、审查、视觉和前端工程；预设绑定角色，不把模型 ID 写进提示词。
- **委派与协作**：`subagent-coordination` 指南说明什么时候该委派、如何分工、回收和验收。前端预设附带工程及工具边界技能，不会自动获得外部服务权限。

Anvil 当前采用源码分发，不依赖本机已有的 LCP 二进制。这个仓库交付 OMP 宿主和可复用的定制，不包含 Workbench 或 Risk Guard 扩展应用，也不包含个人部署和运行数据。

## 快速上手

需要 **Bun 1.4.4 或更高版本**和 Git。在仓库根目录运行：

```sh
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

## 仓库结构

| 路径 | 用途 |
| --- | --- |
| [`packages/host/series.json`](packages/host/series.json) | 上游版本固定点与补丁应用顺序 |
| [`packages/host/features/`](packages/host/features/) | 按宿主特性维护的原始 diff |
| [`patches/`](patches/) | 由补丁系列生成的四份 Bun 安装补丁 |
| [`agents/`](agents/) · [`skills/`](skills/) | 角色预设、委派指南与配套技能 |
| [`native-routing.config.json`](native-routing.config.json) · [`examples/`](examples/) | 可复用配置模板，不含实际账号或私有端点 |

## 贡献与许可证

修补宿主时改维护源，使用 `bun run host:build` 重新生成安装补丁，再运行 `bun run host:check`。不要直接编辑 `patches/`。补丁升级、变更同步和隔离验证见[贡献与维护指南](CONTRIBUTING.md)。

项目使用 [MIT 许可证](LICENSE)；上游许可证及版权声明保留在 [`packages/host/LICENSE.upstream`](packages/host/LICENSE.upstream)。
