import type { Ref } from 'react'
import './components.css'
import { SearchBar } from './SearchBar'

interface AskPanelProps {
  examples: string[]
  loading: boolean
  inputRef?: Ref<HTMLInputElement>
  onAsk: (question: string) => void
}

// The question box with example questions. Picking an example asks it straight away.
export function AskPanel({ examples, loading, inputRef, onAsk }: AskPanelProps) {
  return (
    <div className="ask-panel">
      <SearchBar
        label="Ask a question"
        placeholder='Ask a question, e.g., "Do I need IRB approval for a survey?"'
        submitLabel="Ask"
        disabled={loading}
        inputRef={inputRef}
        onSubmit={onAsk}
      />
      <p className="ask-panel__note">Answers come from UNC Research policies and guidance.</p>
      <p className="ask-panel__examples-label">Example questions</p>
      <ul className="ask-panel__examples">
        {examples.map((example) => (
          <li key={example}>
            <button type="button" className="chip" disabled={loading} onClick={() => onAsk(example)}>
              {example}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
