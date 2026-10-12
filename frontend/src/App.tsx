import { Route, Routes } from 'react-router'
import RequireAuth from './auth/RequireAuth'
import RequireRole from './auth/RequireRole'
import AppLayout from './layout/AppLayout'
import NotFound from './layout/NotFound'
import { adminNav, researcherNav } from './layout/navItems'
import AdminOverview from './pages/admin/AdminOverview'
import AskPage from './pages/researcher/AskPage'
import BrowsePage from './pages/researcher/BrowsePage'
import DocumentPage from './pages/researcher/DocumentPage'
import HomePage from './pages/researcher/HomePage'
import SearchPage from './pages/researcher/SearchPage'
import TopicPage from './pages/researcher/TopicPage'
import SignIn from './pages/SignIn'

// Every page in the app. Sign-in is public and stands alone. Everything else
// needs sign-in, and /admin also needs the admin role. Researcher and admin
// pages render inside AppLayout with their own nav. Unknown paths fall
// through to NotFound inside whichever area they're under.
export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout navLabel="Researcher" nav={researcherNav} />}>
          <Route index element={<HomePage />} />
          <Route path="browse" element={<BrowsePage />} />
          <Route path="browse/:slug" element={<TopicPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="ask" element={<AskPage />} />
          <Route path="documents/:id" element={<DocumentPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="admin" element={<RequireRole role="admin" />}>
          <Route element={<AppLayout navLabel="Admin" nav={adminNav} />}>
            <Route index element={<AdminOverview />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
