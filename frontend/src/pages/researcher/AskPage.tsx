import { useEffect, useRef } from 'react'
import { AskSection } from '../../components/AskSection'
import { Icon } from '../../components/Icon'
import './researcher.css'

export default function AskPage() {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="researcher">
      <header className="page-header">
        <span className="page-header__icon">
          <Icon name="chat" size={36} />
        </span>
        <div>
          <h1 className="page-header__title">Ask a Question</h1>
          <p className="page-header__intro">
            Ask in your own words and get an answer based on approved UNC research sources.
          </p>
        </div>
      </header>

      <section className="panel">
        <AskSection inputRef={inputRef} />
      </section>
    </div>
  )
}
