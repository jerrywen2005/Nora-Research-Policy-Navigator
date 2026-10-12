import { useState } from 'react'
import { ResearcherHome } from './ResearcherHome'
import { SearchPage } from './SearchPage'
import { TopicPage } from './TopicPage'

type View = { page: 'home' } | { page: 'topic'; slug: string } | { page: 'search'; query: string }

// Switches between the researcher pages without a router. This is a stand-in until the app shell
// adds react-router; then the routes (/, /topics/:slug, /search?q=) render the pages directly
// and pass the same callbacks as navigate() calls.
export function ResearcherPortal() {
  const [view, setView] = useState<View>({ page: 'home' })

  function go(next: View) {
    setView(next)
    window.scrollTo({ top: 0 })
  }

  const home = () => go({ page: 'home' })

  switch (view.page) {
    case 'topic':
      return <TopicPage slug={view.slug} onBack={home} />
    case 'search':
      return (
        <SearchPage
          query={view.query}
          onSearch={(query) => go({ page: 'search', query })}
          onBack={home}
        />
      )
    default:
      return (
        <ResearcherHome
          onSelectTopic={(slug) => go({ page: 'topic', slug })}
          onOpenSearch={() => go({ page: 'search', query: '' })}
        />
      )
  }
}
