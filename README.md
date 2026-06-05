# Rust Pingora LLM Gateway

这是一个按 `rust_pingora_llm_gateway_deployment_plan.md` 搭建的 OpenAI-compatible Chat API 代理网关骨架。当前产品模型分成 **Model Management**、**Provider Management** 和 **Key Management** 三个核心管理面：

- Model Management：先创建业务侧暴露的 Epichust Model，例如 `epichust-chat`，并维护模型能力选项、默认最大 token 等元数据。
- Provider Management：创建你购买的 OpenAI-compatible Provider，保存上游 API Key 与接口地址，拉取供应商 `/v1/models`，再把供应商模型映射到某个 Epichust Model。
- Key Management：先创建业务方 API Key，查看 Key 配置和 usage；进入某个 Key 后再添加 Epichust Model。每个 Key 下的 Epichust Model 都可以配置限速、单次 token、每日 token 上限，并选择一个或多个已映射的供应商模型来源。

仓库按数据面、控制面、管理端和部署资产拆分：

```text
gateway/             Rust + Pingora 数据面，代理 /v1/chat/completions
admin-api/           Rust + Axum 控制面，提供管理后台 API
admin-web/           React + TypeScript + Vite 管理端
crates/common/       共享领域模型、API Key hash、审计结构
deploy/              Docker Compose、Helm、SQL 初始化脚本
```

## 本地运行

```bash
cp .env.example .env
# 修改 .env 里的 OPENAI_API_KEY
docker compose -f deploy/docker-compose.yml up -d --build
```

服务入口：

```text
Gateway:   http://localhost:8080
Metrics:   http://localhost:9090
Admin API: http://localhost:9000
Admin Web: http://localhost:3000/admin
```

调用示例：

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer local-internal-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"epichust-chat","messages":[{"role":"user","content":"hello"}]}'
```

## Rust 验证

Pingora 依赖链需要本机有 `cmake`：

```bash
brew install cmake
```

```bash
cargo fmt --all
cargo check --workspace
```

## 架构说明

第一版骨架已落地以下能力：

- `pingora-gateway`：健康检查、Prometheus 指标、API Key hash 鉴权、Provider Key 替换、结构化审计日志、SSE 透传保留。
- `axum-admin-api`：健康检查、ready 检查、Epichust Model、Provider、供应商模型、模型映射、API Key 配额、用量和审计日志 API 骨架。
- `admin-web`：React + TypeScript + Vite + TanStack Query + Zustand + shadcn/ui 管理端，覆盖模型、Provider、映射、Key 和 usage 查看。
- `deploy`：本地 Docker Compose、生产 Helm chart、PostgreSQL 初始化表结构。

Admin API 已切到 PostgreSQL 数据源；下一步可以让 Gateway 从 Redis 加载 API Key 的 Epichust Model 配额、Provider Key 和可用模型来源映射。
