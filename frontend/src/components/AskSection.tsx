import { useState, type Ref } from 'react'
import type { AskResponse } from '../api/types'
import { ask } from '../pages/researcher/researcherApi'
import { AnswerCard } from './AnswerCard'
import { AskPanel } from './AskPanel'
import './components.css'

const EXAMPLE_QUESTIONS = [
  'Do I need IRB approval for my study?',
  'Can I share de-identified data?',
  'What is considered human subjects research?',
  'How do I disclose a conflict of interest?',
  'Where can I find data use agreements?',
]

type AskState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; response: AskResponse }

// The ask panel plus the answer to the last question. Used on the home page and the Ask page.
export function AskSection({ inputRef }: { inputRef?: Ref<HTMLInputElement> }) {
  const [state, setState] = useState<AskState>({ status: 'idle' })

  async function handleAsk(question: string) {
    setState({ status: 'loading' })
    try {
      setState({ status: 'done', response: await ask({ question, topic: null }) })
    } catch {
      setState({ status: 'error' })
    }
  }

  return (
    <>
      <AskPanel
        examples={EXAMPLE_QUESTIONS}
        loading={state.status === 'loading'}
        inputRef={inputRef}
        onAsk={handleAsk}
      />
      <div aria-live="polite">
        {state.status === 'loading' && <p className="status">Looking through sources…</p>}
        {state.status === 'error' && (
          <p className="status status--error">Something went wrong. Please try again.</p>
        )}
        {state.status === 'done' && <AnswerCard response={state.response} />}
      </div>
    </>
  )
}
