import { Link } from 'react-router'

export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        There's no page at this address. <Link to="/">Go to the home page</Link>.
      </p>
    </>
  )
}
