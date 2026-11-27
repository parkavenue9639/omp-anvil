<p align="center">
  <img src="assets/anvil.svg" width="124" height="87" alt="">
</p>

<h1 align="center">OMP Anvil</h1>

<p align="center"><strong>Delegate by role. Review risky actions. Remember what matters.</strong></p>
<p align="center">
  An independent <a href="https://github.com/can1357/oh-my-pi">Oh My Pi</a> distribution with specialist subagents, role-based model fallback, Risk Guard host hooks, and classified memory.
</p>

<p align="center">
  <a href="packages/host/series.json"><kbd>Oh My Pi 19.0.1</kbd></a> ·
  <a href="https://bun.sh/"><kbd>Bun ≥ 1.4.4</kbd></a> ·
  <a href="LICENSE"><kbd>MIT</kbd></a>
</p>

<p align="center"><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#risk-guard-tool-approval">Risk Guard</a> ·
  <a href="#classified-memory">Classified memory</a> ·
  <a href="#patch-catalog">Patch catalog</a> ·
  <a href="#community-and-feedback">Community</a>
</p>

Anvil is for developers who want to run a coding agent across projects without giving every subagent the same job or every project the same memory. It builds on OMP's terminal UI, tools, and native subagents by patching the host itself, not by adding a separate task scheduler.

## Quick start

You'll need **Bun 1.4.4 or newer** and Git:

```sh
git clone https://github.com/parkavenue9639/omp-anvil.git
cd omp-anvil
bun install --frozen-lockfile --ignore-scripts
bun run omp:patched --version
```

`omp:patched` launches the patched source. The upstream prebuilt entry point, `dist/cli.js`, does not pick up these source changes.

Try Anvil with a separate agent directory so you don't overwrite your existing OMP configuration:

```sh
export PI_CODING_AGENT_DIR="$PWD/.local/agent"
mkdir -p "$PI_CODING_AGENT_DIR/skills"
cp -R skills/subagent-coordination "$PI_CODING_AGENT_DIR/skills/"
cp native-routing.config.json "$PI_CODING_AGENT_DIR/"
```

Set up authentication in that directory and edit its copy of `native-routing.config.json`. Replace the `example-provider-N/model-name` placeholders in enabled models, role bindings, and fallback chains, or remove entries you won't use. Search, image, speech, and decision models need providers with the corresponding capabilities. See [`examples/models.yml`](examples/models.yml) for custom providers; pass credentials through your local environment rather than adding them to the template.

```sh
bun run omp:patched --config "$PI_CODING_AGENT_DIR/native-routing.config.json" --model @default
```

The managed presets and two frontend skills are built in. If you already use the LCP launcher, [`lcp.json`](lcp.json) can load the same template. Neither that file nor the [Codex account-policy example](examples/codex-session.config.json) is required by the standalone source entry point.

## What Anvil adds

### Risk Guard tool approval

Anvil ships the [`approval-review` host patch](packages/host/features/approval-review/) that Risk Guard uses. Trusted extensions can register a reviewer with `pi.registerToolApprovalReviewer` for a tool call that would otherwise prompt a human. It does not override an explicit native allow or deny. Provider safety confirmations still require a human.

- If every reviewer abstains, OMP prompts as usual. Any denial wins; reviewer errors or timeouts do not grant approval.
- Approval applies only to the current call and does not persist as an authorization.

**What's included:** the public distribution ships the reviewer interface and host gate, not LCP's full Risk Guard policy extension. Without a reviewer extension loaded, normal OMP approvals still apply. This is not an operating-system sandbox.

### Classified memory

The [`memory-routing` patch](packages/host/features/memory-routing/) uses a separate, tool-free model call to extract durable facts before writing to Mnemopi. A build convention can stay in the **project bank**, a reusable preference can go to the **global bank**, a one-off detail can be **skipped**, and an uncertain item can go to a **pending queue**. Raw transcripts aren't written directly to the recall banks; this does not change session history.

Routing is off by default. Merge these settings into the local `native-routing.config.json` used in Quick start, and point `modelRoles.memory` at an available model. With Git auto-registration on, sibling worktrees share a project identity. Inspect pending items with `/memory queue`; read-only cross-project recall requires the separate `memoryRouting.crossProjectRead` setting.

```json
{
  "memory": { "backend": "mnemopi" },
  "mnemopi": { "scoping": "per-project-tagged", "llmMode": "none" },
  "memoryRouting": { "enabled": true, "autoRegisterProjects": true }
}
```

### Role-based models and fallback

`review` uses `@review`; `frontend-engineer` uses `@frontend`. Configure models, reasoning effort, and fallback order per role, then change providers without rewriting the presets. When the retry policy calls for fallback, the host uses that role's candidate chain. The plan is preserved on resume. Titles, idle recaps, and local memory processing can each use their own role.

### Specialist subagents and delegation

**12 managed presets** cover read-only investigation, focused fixes, complex implementation, independent review, and frontend engineering. When a subagent is dispatched to another worktree of the same repository, it picks up project instructions, rules, and skills from that checkout. The [delegation guide](skills/subagent-coordination/) covers when to work inline, how to split work, and how to hand off and verify results.

### Auditable, reproducible host patches

Anvil pins **OMP 19.0.1** and applies an ordered patch series to the upstream release packages. You can inspect each change, rebuild the Bun install patches, and reconcile the changes against a newer upstream release without maintaining a full copy of the upstream source.

> [!NOTE]
> Anvil is maintained independently and distributed from source. It does not require an existing LCP installation and does not include Workbench or personal deployment data.

## Patch catalog

Changes to upstream OMP 19.0.1 are listed in [`series.json`](packages/host/series.json) application order. Extension APIs are capabilities, not bundled applications that use them.

| Patch | Change | Activation |
| --- | --- | --- |
| [`fixes`](packages/host/features/fixes/) | Fixes empty-file rendering in Tern, approval context for Advisor, and cache and data paths under a custom config directory. Caches valid Devin JWTs to avoid repeated authentication. | Built in |
| [`startup`](packages/host/features/startup/) | Keeps the fast first frame with `--config` or `--trusted-extension`, while blocking submission until extensions are ready. Refreshes only the relevant catalog when a startup model can be attributed to a provider. | Built in |
| [`extension-api`](packages/host/features/extension-api/) | Lets extensions call the host judge, handle tool-result card actions, switch models when truly idle, and read the original input before rewriting hooks. | Extension API |
| [`approval-review`](packages/host/features/approval-review/) | Gives Risk Guard and other trusted reviewers a hook for calls that would otherwise prompt the user. Explicit native decisions stay in place. | Requires a trusted reviewer extension; no policy bundled |
| [`role-plans`](packages/host/features/role-plans/) | Gives each `@role` its own ordered fallback chain. Aliases can inherit the target chain. Roles and plans persist across session resumes. | Configure `modelRoles` and `retry.fallbackChains` |
| [`scenario-roles`](packages/host/features/scenario-roles/) | Uses independent roles for titles, idle recaps, and local memory processing rather than borrowing the foreground model. | Configure `@title`, `@recap`, and `@memory` as needed |
| [`managed-presets`](packages/host/features/managed-presets/) | Binds managed agents to a single `@role` rather than a model ID or effort. Adds role selection to `/agents` and Alt+P, and limits `creative` to its declared tools. | Built-in presets and UI |
| [`memory-routing`](packages/host/features/memory-routing/) | Classifies Mnemopi writes into project, global, skip, or pending. Keeps raw transcripts out of recall banks and supports optional read-only cross-project recall. | `memoryRouting.enabled` is off by default; cross-project reads are separate |
| [`message-converters`](packages/host/features/message-converters/) | Lets extensions change how custom messages reach the model, including after history restoration, without rewriting the stored journal. | Extension API |
| [`thinking-state`](packages/host/features/thinking-state/) | Exposes configured thinking mode, the last automatic resolution, and the effective effort separately. Restores the configured mode on resume. | Host state and extension API |
| [`extension-completion`](packages/host/features/extension-completion/) | Lets a registered tool make a single tool-free `ctx.complete` call to an exact model. No conversation history, foreground model switch, or role fallback. | Extension API |
| [`executor-session-lifecycle`](packages/host/features/executor-session-lifecycle/) | `--resume-exact` acquires the writer lease first. Trusted extensions can persist executor inputs, inspect processing receipts, and coordinate shutdown. | Host CLI and trusted extension API |
| [`subagent-context`](packages/host/features/subagent-context/) | Discovers instructions, skills, and rules from the target checkout. Dispatch can bind `cwd` to the workspace or a registered sibling worktree. Agents that cannot spawn do not receive `task`. | Subagent dispatch |
| [`frontend-engineer`](packages/host/features/frontend-engineer/) | Adds the managed frontend preset and two bundled skills. It can inherit a limited read-only Figma or Context7 MCP surface from the parent, without creating connections or granting credentials. | Select `frontend-engineer` |

## Repository layout

| Path | Purpose |
| --- | --- |
| [`packages/host/series.json`](packages/host/series.json) | Upstream pin and patch application order |
| [`packages/host/features/`](packages/host/features/) | Maintained feature diffs |
| [`patches/`](patches/) | Four generated Bun install patches |
| [`agents/`](agents/) · [`skills/`](skills/) | Role presets, delegation guide, and supporting skills |
| [`native-routing.config.json`](native-routing.config.json) · [`examples/`](examples/) | Reusable templates without real accounts or private endpoints |

## Community and feedback

- **Anvil issues and suggestions:** use [Anvil Issues](https://github.com/parkavenue9639/omp-anvil/issues) and see the [contributing guide](CONTRIBUTING.md) before submitting a patch.
- **Upstream Oh My Pi:** [website](https://omp.sh/) · [official Discord](https://discord.gg/4NMW9cdXZa) · [GitHub Discussions](https://github.com/can1357/oh-my-pi/discussions). Share OMP ecosystem projects and tips in [Show and tell](https://github.com/can1357/oh-my-pi/discussions/categories/show-and-tell). These are upstream community spaces, not Anvil support channels.

## Contributing and license

Edit the feature source, run `bun run host:build` to regenerate the installation patches, and verify with `bun run host:check`. Do not edit `patches/` by hand. See the [contributing guide](CONTRIBUTING.md) for patch upgrades, synchronization, and isolated validation.

Anvil is [MIT licensed](LICENSE). The upstream license and copyrights are preserved in [`packages/host/LICENSE.upstream`](packages/host/LICENSE.upstream).
