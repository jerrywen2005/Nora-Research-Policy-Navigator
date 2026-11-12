import { Route, Routes } from 'react-router'
import RequireAuth from './auth/RequireAuth'
import RequireRole from './auth/RequireRole'
import AppLayout from './layout/AppLayout'
import NotFound from './layout/NotFound'
import { adminNav, researcherNav } from './layout/navItems'
import AdminOverview from './pages/admin/AdminOverview'
import ContentManagementPage from './pages/admin/ContentManagementPage'
import DocumentEditorPage from './pages/admin/DocumentEditorPage'
import PolicyLibraryPage from './pages/admin/PolicyLibraryPage'
import AskPage from './pages/researcher/AskPage'
import BrowsePage from './pages/researcher/BrowsePage'
import DocumentPage from './pages/researcher/DocumentPage'
import HomePage from './pages/researcher/HomePage'
import SavedPage from './pages/researcher/SavedPage'
import SearchPage from './pages/researcher/SearchPage'
import TagPage from './pages/researcher/TagPage'
import TopicPage from './pages/researcher/TopicPage'
import SignIn from './pages/SignIn'
import SavedProvider from './saved/SavedProvider'

// Every page in the app. Sign-in is public and stands alone. Everything else
// needs sign-in, and /admin also needs the admin role. Researcher and admin
// pages render inside AppLayout with their own nav; researcher pages also share the user's
// saved items (SavedProvider). Unknown paths fall
// through to NotFound inside whichever area they're under.
export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />

      <Route element={<RequireAuth />}>
        <Route element={<SavedProvider />}>
          <Route element={<AppLayout navLabel="Researcher" nav={researcherNav} />}>
            <Route index element={<HomePage />} />
            <Route path="browse" element={<BrowsePage />} />
            <Route path="browse/:slug" element={<TopicPage />} />
            <Route path="tags/:slug" element={<TagPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="ask" element={<AskPage />} />
            <Route path="saved" element={<SavedPage />} />
            <Route path="documents/:id" element={<DocumentPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>

        <Route path="admin" element={<RequireRole role="admin" />}>
          <Route element={<AppLayout navLabel="Admin" nav={adminNav} />}>
            <Route index element={<AdminOverview />} />
            <Route path="library" element={<PolicyLibraryPage />} />
            <Route path="content" element={<ContentManagementPage />} />
            <Route path="documents/:id" element={<DocumentEditorPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
