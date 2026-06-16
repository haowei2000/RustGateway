import { Sidebar } from "@/components/layout/sidebar"
import { SidebarResizeHandle } from "@/components/layout/sidebar-resize-handle"
import { ContentPage } from "@/features/admin/content-page"

function App() {
  return (
    <main className="app-shell">
      <div className="app-layout">
        <Sidebar />
        <SidebarResizeHandle />
        <ContentPage />
      </div>
    </main>
  )
}

export default App
