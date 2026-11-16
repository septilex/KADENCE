'use client'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#090912] p-6 text-center text-white">
    <h1 className="text-2xl font-semibold">Something interrupted your music universe</h1>
    <p>Please try again to return to your charts.</p>
    <button onClick={reset} className="rounded-full border border-white/30 px-6 py-3">Try again</button>
  </main>
}
