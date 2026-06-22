import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Seeded mock of the app's single primary query (key ["admin-data"], see
// hooks/use-admin-data.ts) so data-bound components like <Sidebar> render
// populated in static preview cards instead of an empty/loading shell.
const MOCK_ADMIN_DATA = {
  models: [],
  providers: [],
  providerModels: [],
  policies: [],
  auditLogs: [],
  apiKeys: [
    {
      id: "ak-1",
      key_name: "Production Gateway",
      key_hash_prefix: "sk-epi-a1b2",
      enabled: true,
      mapping_policies: [{}, {}],
      last_used_at: null,
      created_at: "",
    },
    {
      id: "ak-2",
      key_name: "Staging Backend",
      key_hash_prefix: "sk-epi-c3d4",
      enabled: true,
      mapping_policies: [{}],
      last_used_at: null,
      created_at: "",
    },
    {
      id: "ak-3",
      key_name: "Analytics Reader",
      key_hash_prefix: "sk-epi-e5f6",
      enabled: false,
      mapping_policies: [],
      last_used_at: null,
      created_at: "",
    },
  ],
}

export function PreviewProvider({ children }: { children?: React.ReactNode }) {
  const [client] = React.useState(() => {
    const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    c.setQueryData(["admin-data"], MOCK_ADMIN_DATA as never)
    return c
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
