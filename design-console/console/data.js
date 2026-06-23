/* Mock data for the LLM Gateway admin console prototype.
   Theme echoes the live product (epichust-* published models, priority policy). */
(function () {
  const PROVIDERS = [
    {
      id: "pv_openai", name: "OpenAI Production", kind: "openai", icon: "database",
      baseUrl: "https://api.openai.com/v1", region: "us-east", status: "healthy",
      keyMasked: "sk-prod-····a1b2", models: 12, policies: 3,
      p95: 612, errRate: 0.21, share: 41, addedBy: "li.wei", addedAt: "Apr 2, 2026",
    },
    {
      id: "pv_deepseek", name: "DeepSeek Primary", kind: "deepseek", icon: "database",
      baseUrl: "https://api.deepseek.com/v1", region: "cn-north", status: "healthy",
      keyMasked: "sk-ds-····9f3c", models: 6, policies: 2,
      p95: 488, errRate: 0.08, share: 33, addedBy: "li.wei", addedAt: "Mar 18, 2026",
    },
    {
      id: "pv_anthropic", name: "Anthropic Fallback", kind: "anthropic", icon: "database",
      baseUrl: "https://api.anthropic.com", region: "us-west", status: "degraded",
      keyMasked: "sk-ant-····77de", models: 8, policies: 2,
      p95: 934, errRate: 1.9, share: 14, addedBy: "zhang.q", addedAt: "Mar 30, 2026",
    },
    {
      id: "pv_azure", name: "Azure OpenAI EU", kind: "azure", icon: "database",
      baseUrl: "https://epi-eu.openai.azure.com", region: "eu-central", status: "healthy",
      keyMasked: "az-eu-····0c41", models: 5, policies: 1,
      p95: 705, errRate: 0.34, share: 9, addedBy: "ops.bot", addedAt: "Apr 10, 2026",
    },
    {
      id: "pv_vllm", name: "Self-hosted vLLM", kind: "self", icon: "database",
      baseUrl: "http://10.4.2.11:8000/v1", region: "on-prem", status: "offline",
      keyMasked: "—", models: 3, policies: 1,
      p95: 0, errRate: 0, share: 3, addedBy: "ops.bot", addedAt: "Feb 9, 2026",
    },
  ];

  const MODELS = [
    { id: "em_ea8477", name: "epichust-qwen3.6-flush", type: "chat_model", policy: "priority", created: "Jun 22, 2026, 2:04 PM" },
    { id: "em_3b1f02", name: "epichust-deepseek-v4-flash", type: "chat_model", policy: "weighted", created: "Jun 19, 2026, 9:11 AM" },
    { id: "em_77ce10", name: "epichust-deepseek-pro-v4", type: "chat_model", policy: "priority", created: "Jun 12, 2026, 4:48 PM" },
    { id: "em_90a4d2", name: "epichust-embed-large", type: "embedding", policy: "single", created: "May 28, 2026, 11:02 AM" },
  ];

  const ROUTES = [
    { id: "rt1", model: "epichust-qwen3.6-flush", target: "gpt-4o", provider: "OpenAI Production", weight: 55, status: "enabled" },
    { id: "rt2", model: "epichust-qwen3.6-flush", target: "deepseek-chat", provider: "DeepSeek Primary", weight: 35, status: "enabled" },
    { id: "rt3", model: "epichust-qwen3.6-flush", target: "claude-sonnet-4", provider: "Anthropic Fallback", weight: 10, status: "enabled" },
    { id: "rt4", model: "epichust-deepseek-pro-v4", target: "deepseek-reasoner", provider: "DeepSeek Primary", weight: 100, status: "enabled" },
    { id: "rt5", model: "epichust-deepseek-v4-flash", target: "llama-3.1-70b", provider: "Self-hosted vLLM", weight: 0, status: "disabled" },
  ];

  const KEYS = [
    { id: "k1", name: "epichust-web-prod", prefix: "ek-7f3a", status: "active", rpm: 6000, scopes: ["chat", "embed"], created: "Apr 1, 2026", lastUsed: "2 min ago", reqs: "1.84M", owner: "platform" },
    { id: "k2", name: "mobile-ios", prefix: "ek-2c9d", status: "active", rpm: 1200, scopes: ["chat"], created: "Apr 14, 2026", lastUsed: "11 min ago", reqs: "412K", owner: "mobile" },
    { id: "k3", name: "batch-etl", prefix: "ek-b610", status: "active", rpm: 600, scopes: ["embed"], created: "Mar 9, 2026", lastUsed: "1 h ago", reqs: "96K", owner: "data" },
    { id: "k4", name: "partner-acme", prefix: "ek-44a1", status: "rotating", rpm: 300, scopes: ["chat"], created: "May 2, 2026", lastUsed: "yesterday", reqs: "21K", owner: "bizdev" },
    { id: "k5", name: "legacy-internal", prefix: "ek-0d8e", status: "revoked", rpm: 0, scopes: [], created: "Nov 2, 2025", lastUsed: "30 d ago", reqs: "0", owner: "—" },
  ];

  const CONFIG = {
    rate: { rpm: 6000, tpm: 2000000, burst: 200, perKey: true },
    cache: { enabled: true, ttl: 300, max: 512, semantic: true, hitRate: 38 },
    fallback: [
      { id: "f1", name: "DeepSeek Primary", on: true },
      { id: "f2", name: "OpenAI Production", on: true },
      { id: "f3", name: "Anthropic Fallback", on: true },
      { id: "f4", name: "Self-hosted vLLM", on: false },
    ],
    retry: { max: 2, backoff: 250 },
    breaker: { threshold: 50, cooldown: 30, enabled: true },
  };

  const AUDIT_OPS = [
    { id: "a1", time: "14:32:08", date: "Jun 22", actor: "li.wei", action: "update", target: "Route · epichust-qwen3.6-flush", field: "weight", before: "60 / 30 / 10", after: "55 / 35 / 10" },
    { id: "a2", time: "14:05:51", date: "Jun 22", actor: "ops.bot", action: "rotate", target: "Key · partner-acme", field: "secret", before: "ek-44a1····", after: "ek-44a1····(new)" },
    { id: "a3", time: "11:48:20", date: "Jun 22", actor: "zhang.q", action: "disable", target: "Provider · Self-hosted vLLM", field: "status", before: "enabled", after: "disabled" },
    { id: "a4", time: "09:12:03", date: "Jun 22", actor: "li.wei", action: "update", target: "Config · Cache", field: "ttl", before: "180s", after: "300s" },
    { id: "a5", time: "17:39:44", date: "Jun 21", actor: "ops.bot", action: "create", target: "Model · epichust-qwen3.6-flush", field: "—", before: "—", after: "chat_model" },
    { id: "a6", time: "16:20:10", date: "Jun 21", actor: "zhang.q", action: "delete", target: "Key · old-sandbox", field: "—", before: "ek-91fa····", after: "—" },
  ];

  const TRACES = [
    { id: "t1", time: "14:32:41", key: "epichust-web-prod", model: "epichust-qwen3.6-flush", provider: "OpenAI Production", tin: 1840, tout: 612, lat: 740, status: 200 },
    { id: "t2", time: "14:32:39", key: "mobile-ios", model: "epichust-deepseek-pro-v4", provider: "DeepSeek Primary", tin: 920, tout: 1180, lat: 1320, status: 200 },
    { id: "t3", time: "14:32:36", key: "epichust-web-prod", model: "epichust-qwen3.6-flush", provider: "Anthropic Fallback", tin: 2100, tout: 0, lat: 60, status: 429 },
    { id: "t4", time: "14:32:31", key: "batch-etl", model: "epichust-embed-large", provider: "Azure OpenAI EU", tin: 5400, tout: 0, lat: 210, status: 200 },
    { id: "t5", time: "14:32:28", key: "partner-acme", model: "epichust-qwen3.6-flush", provider: "DeepSeek Primary", tin: 640, tout: 388, lat: 520, status: 200 },
    { id: "t6", time: "14:32:22", key: "mobile-ios", model: "epichust-deepseek-v4-flash", provider: "Self-hosted vLLM", tin: 410, tout: 0, lat: 30, status: 500 },
    { id: "t7", time: "14:32:18", key: "epichust-web-prod", model: "epichust-qwen3.6-flush", provider: "OpenAI Production", tin: 1290, tout: 740, lat: 690, status: 200 },
  ];

  // hourly request volume (last 24 buckets) for the dashboard chart
  const VOLUME = [12, 14, 11, 9, 7, 6, 8, 13, 22, 34, 41, 46, 44, 39, 43, 48, 52, 47, 38, 33, 29, 24, 19, 16];

  const STATS = [
    { id: "req", label: "Requests · 24h", value: "48,210", delta: "+12.4%", up: true, icon: "activity", spark: [20, 24, 22, 30, 28, 36, 41] },
    { id: "lat", label: "p95 latency", value: "712 ms", delta: "−4.1%", up: true, icon: "gauge", spark: [30, 28, 26, 27, 24, 25, 22] },
    { id: "err", label: "Error rate", value: "0.42%", delta: "+0.08%", up: false, icon: "alertTriangle", spark: [4, 5, 4, 6, 5, 7, 8] },
    { id: "keys", label: "Active keys", value: "37", delta: "3 rotating", up: true, icon: "keyRound", spark: [33, 34, 34, 35, 36, 36, 37] },
  ];

  window.DATA = { PROVIDERS, MODELS, ROUTES, KEYS, CONFIG, AUDIT_OPS, TRACES, VOLUME, STATS };
})();
