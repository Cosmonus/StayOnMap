// Right-side panel showing property list or property detail
// Slides in over the map — controlled by uiStore.sidebarOpen

export default function Sidebar({ children }) {
  // TODO: const { sidebarOpen } = useUiStore()
  return (
    <aside className="absolute right-0 top-0 bottom-0 z-10 w-96 bg-white shadow-lg transform transition-transform">
      {children}
    </aside>
  )
}
