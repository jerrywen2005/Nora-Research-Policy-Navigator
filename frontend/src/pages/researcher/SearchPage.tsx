import { useEffect, useRef } from 'react'
import { DocumentResultCard } from '../../components/DocumentResultCard'
import { Icon } from '../../components/Icon'
import { SearchBar } from '../../components/SearchBar'
import './researcher.css'
import { getDocuments } from './researcherApi'
import { useLoad } from './useLoad'

interface SearchPageProps {
  query: string
  onSearch: (query: string) => void
  onBack: () => void
}

// Keyword search over policies, guidance and FAQs. An empty query shows just the search box.
export function SearchPage({ query, onSearch, onBack }: SearchPageProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useLoad(query, () =>
    query ? getDocuments({ q: query }) : Promise.resolve(null),
  )

  useEffect(() => {
    if (!query) {
      inputRef.current?.focus()
    }
  }, [query])

  return (
    <div className="researcher researcher-page">
      <button type="button" className="button button--link back-link" onClick={onBack}>
        <Icon name="arrowLeft" size={16} /> Home
      </button>

      <header className="page-header">
        <span className="page-header__icon">
          <Icon name="search" size={36} />
        </span>
        <div>
          <h1 className="page-header__title">Search Policies & Guidance</h1>
          <p className="page-header__intro">Find a policy, procedure, or guidance document.</p>
        </div>
      </header>

      <div className="researcher-main">
        <SearchBar
          key={query}
          label="Search policies and guidance"
          placeholder="Search by keyword, e.g., informed consent"
          submitLabel="Search"
          initialValue={query}
          inputRef={inputRef}
          onSubmit={onSearch}
        />

        <div aria-live="polite">
          {results.status === 'loading' && <p className="status">Searching…</p>}
          {results.status === 'error' && (
            <p className="status status--error">Search failed. Please try again.</p>
          )}
          {results.status === 'ready' && results.data && (
            <>
              <p className="result-count">
                {results.data.total} {results.data.total === 1 ? 'result' : 'results'} for “{query}”
              </p>
              {results.data.total === 0 ? (
                <p className="status">
                  No documents matched. Try different keywords, browse by topic, or ask a question.
                </p>
              ) : (
                <ul className="result-list">
                  {results.data.items.map((doc) => (
                    <li key={doc.id}>
                      <DocumentResultCard document={doc} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
