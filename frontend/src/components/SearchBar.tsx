import { useId, useState, type FormEvent, type Ref } from 'react'
import './components.css'
import { Icon } from './Icon'

interface SearchBarProps {
  label: string
  placeholder: string
  initialValue?: string
  submitLabel: string
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
  onSubmit: (value: string) => void
}

// A labelled text input with a round submit button, used for both search and ask.
export function SearchBar({
  label,
  placeholder,
  initialValue = '',
  submitLabel,
  disabled = false,
  inputRef,
  onSubmit,
}: SearchBarProps) {
  const id = useId()
  const [value, setValue] = useState(initialValue)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = value.trim()
    if (trimmed) {
      onSubmit(trimmed)
    }
  }

  return (
    <form className="search-bar" role="search" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        type="submit"
        className="search-bar__submit"
        aria-label={submitLabel}
        disabled={disabled}
      >
        <Icon name="arrowRight" size={20} />
      </button>
    </form>
  )
}
