import { NotFoundView } from '@/components/NotFoundView';

// Next's own 404 boundary — fires when a signed-in user (or the static
// export's 404.html) hits a route with no matching page.tsx. Rendered inside
// AppShell like any other page, so the sidebar/topbar/bottom nav stay put.
export default function NotFound() {
  return <NotFoundView />;
}
