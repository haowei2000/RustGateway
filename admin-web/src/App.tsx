import { IconRail } from "@/components/layout/icon-rail"
import { ListPanel } from "@/components/layout/list-panel"
import { Toaster } from "@/components/ui/toaster"
import { ContentPage } from "@/features/admin/content-page"
import { LIST_SECTIONS, useAdminStore } from "@/stores/admin-store"

function App() {
  const sidebarResource = useAdminStore((s) => s.sidebarResource)
  const showList = LIST_SECTIONS.includes(sidebarResource)

  return (
    <main className="console-shell">
      <IconRail />
      {showList ? <ListPanel /> : null}
      <ContentPage />
      <Toaster />
    </main>
  )
}

export default App
