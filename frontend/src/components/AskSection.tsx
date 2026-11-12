import { useState, type Ref } from 'react'
import type { AskResponse } from '../api/types'
import { ask } from '../pages/researcher/researcherApi'
import { AnswerCard } from './AnswerCard'
import { AnswerFeedback } from './AnswerFeedback'
import { AskPanel } from './AskPanel'
import { SaveButton } from './SaveButton'
import { useSaved } from '../saved/SavedContext'
import './components.css'

// Questions the policies answer well (see `python -m app.rag eval` in the backend).
const EXAMPLE_QUESTIONS = [
  'How far in advance must a postdoc request an extension of the five-year term?',
  'Can I get consent orally instead of a signed form?',
  'Who owns the data from my research?',
  'How often do investigators need FCOI training?',
  'Is ITAR relevant to my lab?',
]

type AskState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; response: AskResponse }

// The ask panel plus the answer to the last question. Used on the home page and the Ask page.
export function AskSection({ inputRef }: { inputRef?: Ref<HTMLInputElement> }) {
  const [state, setState] = useState<AskState>({ status: 'idle' })
  const saved = useSaved()

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
        {state.status === 'loading' && <p className="status">Reading the research policies… this can take 10 seconds.</p>}
        {state.status === 'error' && (
          <p className="status status--error">Something went wrong. Please try again.</p>
        )}
        {state.status === 'done' && (
          <AnswerCard
            // A new question gets fresh feedback buttons.
            key={state.response.question_id}
            response={state.response}
            actions={
              <>
                <AnswerFeedback
                  questionId={state.response.question_id}
                  // If this answer is saved, the Saved page shows the new rating too.
                  onChange={(feedback) => saved.setRating(state.response.question_id, feedback)}
                />
                <SaveButton target={{ question_id: state.response.question_id }} name="this answer" />
              </>
            }
          />
        )}
      </div>
    </>
  )
}
