import { useState } from 'react'
import type { SaveRequest } from '../api/types'
import { useSaved } from '../saved/SavedContext'
import './components.css'
import { Icon } from './Icon'

// Saves or unsaves a document or answer (F9). A toggle: aria-pressed says whether it's saved.
// `name` makes the accessible name unique when a page lists many, e.g. "Save Export Controls".
export function SaveButton({ target, name }: { target: SaveRequest; name: string }) {
  const saved = useSaved()
  const item = saved.find(target)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function toggle() {
    setPending(true)
    setFailed(false)
    try {
      await (item ? saved.remove(item.id) : saved.save(target))
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <span className="save-button">
      <button
        type="button"
        className={item ? 'chip-button chip-button--on' : 'chip-button'}
        aria-pressed={item !== undefined}
        aria-label={`Save ${name}`}
        disabled={pending}
        onClick={toggle}
      >
        <Icon name="bookmark" size={16} />
        {item ? 'Saved' : 'Save'}
      </button>
      {failed && (
        <span role="alert" className="save-button__error">
          {item ? "Couldn't remove it. Try again." : "Couldn't save it. Try again."}
        </span>
      )}
    </span>
  )
}
