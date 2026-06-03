import { AlertCircle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { useAdminData } from "@/hooks/use-admin-data"
import { useAdminStore } from "@/stores/admin-store"

import { ApiKeyPage } from "./api-key-page"
import { ModelPage } from "./model-page"
import { ProviderPage } from "./provider-page"

function ContentPage() {
  const adminData = useAdminData()
  const sidebarResource = useAdminStore((state) => state.sidebarResource)
  const selectedSidebarItemId = useAdminStore((state) => state.selectedSidebarItemId)

  return (
    <section className="content-page" aria-label="Selected sidebar item content">
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

      {sidebarResource === "keys" ? (
        <ApiKeyPage
          data={adminData.data}
          isFetching={adminData.isFetching}
          selectedItemId={selectedSidebarItemId}
          onRefresh={() => adminData.refetch()}
        />
      ) : null}
      {sidebarResource === "providers" ? (
        <ProviderPage
          data={adminData.data}
          isFetching={adminData.isFetching}
          selectedItemId={selectedSidebarItemId}
          onRefresh={() => adminData.refetch()}
        />
      ) : null}
      {sidebarResource === "models" ? (
        <ModelPage
          data={adminData.data}
          isFetching={adminData.isFetching}
          selectedItemId={selectedSidebarItemId}
          onRefresh={() => adminData.refetch()}
        />
      ) : null}
    </section>
  )
}

export { ContentPage }
