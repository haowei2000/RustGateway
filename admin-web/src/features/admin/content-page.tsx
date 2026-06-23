import { AlertCircle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { useAdminData } from "@/hooks/use-admin-data"
import { useAdminStore } from "@/stores/admin-store"

import { ApiKeyPage } from "./api-key-page"
import { AuditPage } from "./audit-page"
import { DashboardPage } from "./dashboard-page"
import { ModelPage } from "./model-page"
import { PolicyPage } from "./policy-page"
import { ProviderPage } from "./provider-page"

function ContentPage() {
  const adminData = useAdminData()
  const sidebarResource = useAdminStore((state) => state.sidebarResource)
  const selectedSidebarItemId = useAdminStore((state) => state.selectedSidebarItemId)

  // Full-bleed screens manage their own header + scroll.
  if (sidebarResource === "dashboard") return <DashboardPage />
  if (sidebarResource === "audit") return <AuditPage />

  const detailProps = {
    data: adminData.data,
    isFetching: adminData.isFetching,
    selectedItemId: selectedSidebarItemId,
    onRefresh: () => adminData.refetch(),
  }

  return (
    <section className="console-detail scroll" aria-label="Selected item content">
      {adminData.isError ? (
        <Card className="content-error-card">
          <CardContent className="content-error-card-content">
            <AlertCircle className="icon-sm" aria-hidden="true" />
            <span>
              Failed to load admin data. Check whether `admin-api` is running on port 9000.
            </span>
          </CardContent>
        </Card>
      ) : null}

      {sidebarResource === "keys" ? <ApiKeyPage {...detailProps} /> : null}
      {sidebarResource === "providers" ? <ProviderPage {...detailProps} /> : null}
      {sidebarResource === "models" ? <ModelPage {...detailProps} /> : null}
      {sidebarResource === "routes" ? <PolicyPage {...detailProps} /> : null}
    </section>
  )
}

export { ContentPage }
