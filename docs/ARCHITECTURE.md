# Architecture

本项目按部署方案拆成数据面、控制面、管理端和基础设施层。

## 数据面：pingora-gateway

职责：

- 接收 `POST /v1/chat/completions`。
- 校验调用方 `Authorization: Bearer <api-key>`。
- 对 API Key 做 SHA-256 hash，不记录明文。
- 按 API Key 读取可用 Epichust Model、限速和最大 token 策略。
- 通过 Epichust Model 查找该 Key 允许使用的一个或多个 Provider 模型来源。
- 替换上游 `Authorization` 为 Provider 持有的 OpenAI-compatible API Key。
- 原样透传请求体和响应体，保留 SSE streaming 能力。
- 暴露 `/healthz` 与 Prometheus `/metrics`。
- 输出结构化 JSON 审计日志。

运行时配置先来自环境变量，后续接入 Redis 本地缓存：

```text
gateway:api_key:{sha256}
gateway:api_key_policy:{api_key_id}
gateway:epichust_model:{epichust_model_id}
gateway:model_sources:{api_key_id}:{epichust_model_id}
gateway:rate_limit:{api_key_id}:{epichust_model_id}:{window}
gateway:provider_key:{key_ref}
```

## 控制面：axum-admin-api

职责：

- 管理 Epichust Model，这是业务侧请求体 `model` 字段可见的模型名。
- 管理 Provider，每个 Provider 表示购买的 OpenAI-compatible API 接口和服务端保存的上游 Key。
- 创建 Provider 时同步上游 `/v1/models`，保存 provider_models。
- 在 Provider 下创建模型映射，把一个供应商模型映射到一个 Epichust Model。
- 管理 API Key：先创建 Key，再在某个 Key 下添加 Epichust Model；每个 Key 下的 Epichust Model 配置 RPM、单次最大 token、每日 token 上限，并选择一个或多个已映射供应商来源。
- 按 API Key 和 Epichust Model 聚合请求数、token 用量和成本。
- 查询审计日志和操作日志。
- 将策略变更同步到 Redis。
- 使用 PostgreSQL 持久化配置和元数据。

当前代码提供路由和响应模型骨架，方便后续接入 SQLx/SeaORM、JWT、RBAC。

## 管理端：admin-web

职责：

- Model Management：创建和维护 Epichust Model、模型能力选项和默认 token 配置。
- Provider Management：创建 Provider，查看供应商模型同步结果，并维护供应商模型到 Epichust Model 的 mapping。
- Key Management：查看 API Key 配置和 usage，在选中的 Key 下添加 Epichust Model 配额，并选择该 Epichust Model 可用的多个 Provider 模型来源。
- 审计视图后续按 API Key、Epichust Model、Provider 和供应商模型过滤。

前端通过 `/admin-api/v1/*` 访问控制面。

## 部署

- 开发/演示：`deploy/docker-compose.yml`
- 生产：`deploy/helm/llm-gateway`
- 数据库初始化：`deploy/sql/001_init.sql`
