// Shown while GET /api/me is in flight, so pages don't flash the wrong view.
export default function LoadingScreen() {
  return (
    <div className="loading-screen" role="status">
      Loading…
    </div>
  )
}
