# AgentCanvas

---

## 中文说明（The English version follows）

### 项目简介

**AgentCanvas** 是一个面向多智能体协作场景的桌面优先可视化工作流编排工具。

它支持用户在画布上设计工作区，将节点绑定到基于 API 的 Agent 实例，运行工作流，查看协作消息，并将结果写入真实的工作区文件夹。

本项目适用于以下场景：

- 调研与证据收集
- 文书撰写与修改
- 审核驱动的返工流程
- 基于角色分工的多 Agent 协作

当前仓库由以下部分组成：

- 画布式前端界面
- 轻量级 Node.js 后端
- Tauri 桌面壳

### 核心功能

- 可视化工作流画布，支持节点拖拽与依赖连接
- 基于工作区的组织方式，一个画布对应一个工作区文件夹
- 使用 API Agent 实例，而不是依赖本机进程识别
- 内置工作流功能节点
- 支持文本、单文件、多文件三种输出模式
- 底部协作面板可查看工作流消息与执行轨迹
- 集成 Tauri 桌面能力，支持系统文件夹选择器

### 功能节点

当前内置的功能节点包括：

- `Start`
- `End`
- `Trigger`
- `Condition`
- `Switch`
- `Fork`
- `Join`
- `Merge`
- `Retry`
- `Review Loop`

### Review Loop

`Review Loop` 适合“审核 - 修改 - 再审核”的流程。

典型逻辑如下：

1. 上游节点先产出内容
2. 审核节点进行复核
3. 如果不通过，反馈意见会发送给指定的返工节点
4. 返工节点根据反馈重新修改
5. 审核节点再次复核，直到通过或达到最大轮次

### 核心概念

#### 工作区

工作区等于一张画布加一个文件夹。

每个工作区包含：

- 工作区元信息
- 节点图结构
- 工作区文件夹路径
- 执行输出结果

#### Agent 实例

Agent 实例本质上是一个配置好的 API 端点。

每个实例都可以有自己的：

- 名称
- 配置 ID
- Base URL
- API Key
- Model

即使多个实例连接的是同一个 provider，只要实例 ID 或名称不同，它们仍然会被视为不同的实例。

### 项目结构

```text
.
|-- backend/
|   |-- adapters.js
|   |-- messageBus.js
|   |-- orchestrator.js
|   |-- processScanner.js
|   `-- store.js
|-- scripts/
|-- src-tauri/
|-- app.js
|-- index.html
|-- styles.css
|-- server.js
|-- package.json
`-- README.md
```

目录说明：

- `backend/`：后端模块，包括存储、适配器、调度器和消息总线
- `scripts/`：开发辅助脚本和 Tauri 启动脚本
- `src-tauri/`：Tauri 桌面壳源码
- `app.js`、`index.html`、`styles.css`：前端界面与画布逻辑
- `server.js`：本地 HTTP 服务与 API 入口

### 快速开始

#### 浏览器模式

```bash
npm install
npm start
```

打开：

```text
http://localhost:4173
```

#### Tauri 桌面模式

运行桌面版前需要先安装本地 Rust 工具链。

推荐环境：

- Node.js 20+
- Rust stable
- Cargo
- Windows 下的 Visual Studio Build Tools

运行命令：

```bash
npm install
npm run tauri:dev
```

### 接口列表

- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/agents/scan`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/:id`
- `DELETE /api/workspaces/:id`
- `POST /api/workspaces/validate-write`
- `GET /api/bus/messages`
- `DELETE /api/bus/messages`
- `POST /api/runs`
- `GET /api/runs`
- `GET /api/runs/:id`

### 输出模式

每个节点支持以下输出模式：

- `text`：只保留运行结果文本
- `file`：写入一个文件
- `files`：将同一份结果写入多个文件

示例输出路径：

```text
docs/summary.md
exports/result.txt
```

这些路径都会相对于当前工作区文件夹进行解析。

### 示例工作流

#### 调研 -> 撰写 -> 审核

```text
Start
  -> Leader
  -> Fork
     -> Researcher
     -> Writer
  -> Join
  -> Review Loop
  -> End
```

#### 条件分支

```text
Start
  -> Planner
  -> Condition
     -> Approved branch
     -> Rework branch
```

### 当前限制

- `Fork` 在逻辑上实现了分支拆分，但后端执行目前仍以串行为主
- 审核质量依赖于提示词设计和模型质量
- 不同 OpenAI-compatible provider 对接口的支持并不完全一致
- 当前以桌面模式为主要目标，浏览器模式下原生能力较少



---

## English

### Overview

**AgentCanvas** is a desktop-first visual workflow builder for multi-agent collaboration.

It allows users to design workspaces on a canvas, bind nodes to API-based agent instances, run workflows, inspect collaboration messages, and write results into real workspace folders.

This project is intended for scenarios such as:

- research and evidence collection
- document drafting and revision
- reviewer-driven approval loops
- role-based multi-agent collaboration

The current repository combines:

- a canvas-based frontend
- a lightweight Node.js backend
- a Tauri desktop shell

### Features

- Visual workflow canvas with draggable nodes and dependency links
- Workspace-based organization, where one canvas maps to one workspace folder
- API-based agent instances instead of local process discovery
- Built-in workflow function nodes
- File output support for text, single-file, and multi-file workflows
- Collaboration panel for workflow messages and execution traces
- Tauri desktop integration with system folder picker

### Function Nodes

Current built-in function nodes:

- `Start`
- `End`
- `Trigger`
- `Condition`
- `Switch`
- `Fork`
- `Join`
- `Merge`
- `Retry`
- `Review Loop`

### Review Loop

`Review Loop` is intended for reviewer-driven revision workflows.

Typical logic:

1. upstream nodes produce draft content
2. a reviewer node evaluates the result
3. if rejected, feedback is sent back to selected rework nodes
4. rework nodes revise their outputs
5. the reviewer checks again until approved or the maximum review rounds are reached

### Core Concepts

#### Workspace

A workspace is one canvas plus one folder.

Each workspace contains:

- workspace metadata
- node graph definition
- workspace folder path
- execution outputs

#### Agent Instance

An agent instance is a configured API endpoint.

Each instance can have its own:

- name
- configured ID
- base URL
- API key
- model

Multiple instances can point to the same provider, but they are still treated as different instances if their IDs or names differ.

### Project Structure

```text
.
|-- backend/
|   |-- adapters.js
|   |-- messageBus.js
|   |-- orchestrator.js
|   |-- processScanner.js
|   `-- store.js
|-- scripts/
|-- src-tauri/
|-- app.js
|-- index.html
|-- styles.css
|-- server.js
|-- package.json
`-- README.md
```

Directory notes:

- `backend/`: backend modules for storage, adapters, orchestration, and message flow
- `scripts/`: helper scripts for development and Tauri commands
- `src-tauri/`: Tauri desktop shell source code
- `app.js`, `index.html`, `styles.css`: frontend UI and canvas logic
- `server.js`: local HTTP server and API entry

### Getting Started

#### Browser Mode

```bash
npm install
npm start
```

Open:

```text
http://localhost:4173
```

#### Tauri Desktop Mode

You need a local Rust toolchain before running the desktop build.

Recommended environment:

- Node.js 20+
- Rust stable
- Cargo
- Visual Studio Build Tools on Windows

Run:

```bash
npm install
npm run tauri:dev
```

### API Endpoints

- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/agents/scan`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/:id`
- `DELETE /api/workspaces/:id`
- `POST /api/workspaces/validate-write`
- `GET /api/bus/messages`
- `DELETE /api/bus/messages`
- `POST /api/runs`
- `GET /api/runs`
- `GET /api/runs/:id`

### Output Modes

Each node supports one of the following output modes:

- `text`: keep result in run state only
- `file`: write result to one file
- `files`: write the same result to multiple files

Example output targets:

```text
docs/summary.md
exports/result.txt
```

These paths are resolved relative to the current workspace folder.

### Example Workflows

#### Research -> Draft -> Review

```text
Start
  -> Leader
  -> Fork
     -> Researcher
     -> Writer
  -> Join
  -> Review Loop
  -> End
```

#### Conditional Branching

```text
Start
  -> Planner
  -> Condition
     -> Approved branch
     -> Rework branch
```

### Current Limitations

- Forked branches are logically separated, but backend execution is still mostly sequential
- Review quality depends on prompt quality and model quality
- Different OpenAI-compatible providers may support different endpoint sets
- Desktop mode is the primary target; browser mode has fewer native capabilities


