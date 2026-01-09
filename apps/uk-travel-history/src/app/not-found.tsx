import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-[100svh] bg-white text-zinc-950">
      <div className="mx-auto flex min-h-[100svh] max-w-5xl items-center px-6 py-16">
        <div className="w-full">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700">
              404
            </span>
            <span
              className="h-1 w-1 rounded-full bg-zinc-300"
              aria-hidden="true"
            />
            <p className="text-sm text-zinc-600">
              This page could not be found.
            </p>
          </div>

          <h1 className="mt-6 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            We couldn’t find the page you’re looking for
          </h1>
          <p className="mt-3 max-w-prose text-pretty text-base leading-7 text-zinc-600">
            The link may be broken, or the page may have been moved. You can go
            back home, or try a quick search.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            >
              Go to homepage
            </Link>
          </div>

          <div className="mt-10 border-t border-zinc-200 pt-6">
            <p className="text-xs text-zinc-500">
              Tip: check the URL for typos, or use your browser’s back button.
            </p>
          </div>
        </div>

        {/* subtle decoration */}
        <div className="relative hidden w-full max-w-sm shrink-0 sm:block">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-zinc-100 blur-2xl" />
          <div className="absolute right-10 top-20 h-40 w-40 rounded-full bg-zinc-100 blur-2xl" />
          <div className="relative ml-auto aspect-square w-56 rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex h-full flex-col justify-between p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-600">
                  Status
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                  Not found
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">404</p>
                <p className="mt-1 text-xs text-zinc-600">
                  The requested route doesn’t exist.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
