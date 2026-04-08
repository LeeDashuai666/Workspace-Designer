# AgentCanvas Demo

这是一个面向“多 Agent 工作区”场景的本地 demo。当前版本重点支持：

- 多工作区：一个画布对应一个独立工作区文件夹
- 多 Agent 实例：手动录入 API 配置，按实例绑定节点
- 可视化 DAG 画布：节点编辑、依赖配置、拖拽布局
- 工作区保存与切换：可创建、保存、导入、导出不同工作区
- 文件型输出：节点既可以只保留文本输出，也可以写入一个或多个文件
- 后端调度：通过 HTTP API 触发工作区运行、查看运行状态与消息总线
- Tauri 预集成：已接入桌面版目录选择器命令与 `src-tauri/` 工程骨架

## 启动方式

```bash
npm start
```

启动后打开 `http://localhost:4173`

## 当前目录结构

- `index.html` / `styles.css` / `app.js`
  前端画布与配置界面
- `server.js`
  Node HTTP 服务与 API 入口
- `src-tauri/`
  Tauri 桌面壳、Rust command 与系统目录选择器
- `backend/store.js`
  本地存储、工作区目录与 Agent 配置持久化
- `backend/orchestrator.js`
  DAG 调度与节点执行
- `backend/adapters.js`
  OpenAI-compatible API 调用适配器
- `workspaces/`
  每个工作区对应的实际文件夹
- `data/store.json`
  本地状态存储

## 工作区模型

每个工作区会保存：

- `id`
- `name`
- `description`
- `folderName`
- `folderPath`
- `nodes`

如果没有主动指定目录，`folderPath` 会落在项目内的 `workspaces/` 目录下。保存或运行工作区时，如果目录不存在，后端会自动创建。

在 Tauri 桌面版中，你可以通过系统目录选择器直接选择任意本机文件夹作为工作区根目录。

## 节点输出模式

每个节点支持以下输出方式：

- `text`
  只把结果保存在运行结果与右侧详情里
- `file`
  把结果写入一个目标文件
- `files`
  把同一份结果写入多个目标文件

`outputTargets` 需要填写相对路径，例如：

```text
docs/summary.md
exports/result.txt
```

这些文件会写入当前工作区自己的文件夹内，不会越出工作区目录。

## 后端 API

- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/agents/scan`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/:id`
- `DELETE /api/workspaces/:id`
- `POST /api/runs`
- `GET /api/runs`
- `GET /api/runs/:id`
- `GET /api/bus/messages`

## 示例：保存工作区

```json
{
  "name": "文书协作空间",
  "description": "用于拆解和产出申请材料",
  "nodes": [
    {
      "id": "n1",
      "agentId": "agent_xxx",
      "title": "生成摘要",
      "description": "输出一版申请摘要",
      "dependsOn": [],
      "outputMode": "file",
      "outputTargets": ["docs/summary.md"]
    }
  ]
}
```

## 示例：运行工作区

```json
{
  "workspace": {
    "id": "ws_demo",
    "name": "文书协作空间",
    "description": "demo",
    "nodes": [
      {
        "id": "n1",
        "agentId": "agent_xxx",
        "title": "生成摘要",
        "description": "输出 hello world",
        "dependsOn": [],
        "outputMode": "file",
        "outputTargets": ["docs/summary.md"]
      }
    ]
  }
}
```

## 说明

- 现在系统不再依赖本机进程识别，而是以“手动配置 API Agent 实例”为主
- 同一个 provider 可以创建多个实例；只要实例 `id` 或名字不同，就会被当作独立 Agent
- 运行是否成功仍然取决于你的 `Base URL`、`API Key`、`Model` 以及当前网络是否能访问对应接口
- 浏览器模式下只能手动填写工作区路径；系统级目录选择器只在 Tauri 桌面版中可用

## Tauri 桌面版

当前仓库已经包含 `src-tauri/` 骨架和 `pick_workspace_directory` command，但你本机还需要先安装 Rust 工具链后才能运行。

建议环境：

- Node.js 20+
- Rust stable
- Cargo
- Tauri CLI（项目里通过 `@tauri-apps/cli` 提供）

安装完依赖后，可用下面的命令启动桌面版：

```bash
npm install
npm run tauri:dev
```

如果只是继续跑 Web 版，仍然使用：

```bash
npm start
```
