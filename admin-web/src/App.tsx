import { Sidebar } from "@/components/layout/sidebar"
import { ContentPage } from "@/features/admin/content-page"

function App() {
  return (
    <main className="app-shell">
      <div className="app-layout">
        <Sidebar />
        <ContentPage />
      </div>
    </main>
  )
}

export default App
