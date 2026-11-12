// Runs before every test file: adds DOM matchers like toBeInTheDocument(), unmounts what each
// test rendered, and fills in browser APIs jsdom lacks.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom does no layout and has no ResizeObserver. Charts measure their container with it
// (useElementWidth), so report a fixed width and let them draw.
class FixedWidthResizeObserver {
  callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe() {
    this.callback([{ contentRect: { width: 600 } } as ResizeObserverEntry], this as never)
  }

  unobserve() {}

  disconnect() {}
}

globalThis.ResizeObserver = FixedWidthResizeObserver
