/**
 * SSR API base URL helper.
 *
 * Server components and route handlers should call `serverApiBase()` instead of
 * reading `NEXT_PUBLIC_BACKEND_URL` directly.  Inside Docker Compose the web
 * service sets `API_INTERNAL_URL=http://api:8000` so SSR fetches stay on the
 * internal network and never leave the compose stack — faster, no TLS, no
 * public-DNS dependency at build/render time.
 *
 * Browser/client code should continue to read `NEXT_PUBLIC_BACKEND_URL`
 * directly (baked at build time, accessible on window).
 */
export function serverApiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://localhost:8000'
  );
}
