// Runs before every test file: adds DOM matchers like toBeInTheDocument() and unmounts what each
// test rendered.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
