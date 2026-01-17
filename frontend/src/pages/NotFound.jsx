import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-3 text-center">
      <div className="text-3xl font-semibold">Page not found</div>
      <div className="text-fg-muted">The page you’re looking for doesn’t exist.</div>
      <div className="flex justify-center">
        <Link to="/">
          <Button variant="secondary">Go home</Button>
        </Link>
      </div>
    </div>
  )
}
