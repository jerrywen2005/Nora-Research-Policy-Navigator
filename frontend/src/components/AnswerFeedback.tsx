import { useId, useState, type FormEvent } from 'react'
import { clearRating, rateAnswer } from '../pages/researcher/researcherApi'
import './components.css'
import { Icon } from './Icon'

const MAX_COMMENT = 1000

// Helpful / not helpful on an answer (F7). Clicking the selected button again removes the
// rating. "Not helpful" offers an optional comment, which is what the admin dashboard needs to
// see why answers miss.
export function AnswerFeedback({ questionId }: { questionId: number }) {
  const [helpful, setHelpful] = useState<boolean | null>(null)
  const [commenting, setCommenting] = useState(false)
  const [comment, setComment] = useState('')
  const [commentSent, setCommentSent] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const commentId = useId()

  async function attempt(action: () => Promise<void>) {
    setPending(true)
    setFailed(false)
    try {
      await action()
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  const rate = (value: boolean) =>
    attempt(async () => {
      if (helpful === value) {
        await clearRating(questionId)
        setHelpful(null)
        setCommenting(false)
      } else {
        await rateAnswer(questionId, { helpful: value, comment: null })
        setHelpful(value)
        setCommenting(!value)
        setComment('')
      }
      setCommentSent(false)
    })

  const sendComment = (event: FormEvent) => {
    event.preventDefault()
    return attempt(async () => {
      await rateAnswer(questionId, { helpful: false, comment: comment.trim() || null })
      setCommenting(false)
      setCommentSent(true)
    })
  }

  return (
    <div className="answer-feedback">
      <div className="answer-feedback__row" role="group" aria-label="Was this answer helpful?">
        <span className="answer-feedback__prompt">Was this helpful?</span>
        <button
          type="button"
          className={helpful === true ? 'chip-button chip-button--on' : 'chip-button'}
          aria-pressed={helpful === true}
          disabled={pending}
          onClick={() => rate(true)}
        >
          <Icon name="thumbUp" size={16} />
          Helpful
        </button>
        <button
          type="button"
          className={helpful === false ? 'chip-button chip-button--on' : 'chip-button'}
          aria-pressed={helpful === false}
          disabled={pending}
          onClick={() => rate(false)}
        >
          <Icon name="thumbDown" size={16} />
          Not helpful
        </button>
      </div>

      {commenting && (
        <form className="answer-feedback__comment" onSubmit={sendComment}>
          <label htmlFor={commentId}>What was missing or wrong? (optional)</label>
          <textarea
            id={commentId}
            rows={2}
            maxLength={MAX_COMMENT}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <button type="submit" className="button button--secondary" disabled={pending}>
            Send
          </button>
        </form>
      )}

      <p className="answer-feedback__status" aria-live="polite">
        {failed && <span className="save-button__error">Couldn't send your feedback. Try again.</span>}
        {!failed && helpful !== null && !commenting && (commentSent ? 'Thanks, your comment was sent.' : 'Thanks for your feedback.')}
      </p>
    </div>
  )
}
