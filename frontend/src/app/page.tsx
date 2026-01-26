import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-[0.06] [background:repeating-linear-gradient(180deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_2px,transparent_6px)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,136,255,0.10)_0%,rgba(0,0,0,0.95)_55%,rgba(0,0,0,1)_100%)]" />

      <div className="relative mx-auto max-w-5xl px-6 py-14">
        <header className="border border-blue-900/50 bg-black/60">
          <div className="flex items-center justify-start px-5 py-4">
            <div className="flex items-baseline gap-2">
              <h1 className="font-mono text-2xl tracking-wide text-blue-200">
                Shigawire Dev
              </h1>
            </div>

            <span className="ml-auto font-mono text-xs text-blue-400/70">
              SESSION CAPTURE + REPLAY
            </span>
          </div>

          <div className="border-t border-blue-900/50 px-5 py-4">
            <p className="max-w-3xl font-mono text-sm leading-6 text-slate-300">
              Record real HTTP sessions through a local proxy, redact secrets at
              capture time, and replay request timelines deterministically for
              debugging and regression checks.
            </p>

            <div className="mt-5 flex items-center gap-4">
              <Link
                href="/sessions"
                className="inline-flex items-center gap-2 border border-blue-600/70 bg-blue-600/10 px-4 py-2 font-mono text-sm text-blue-200 hover:bg-blue-600/20 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              >
                <span className="text-blue-300">▸</span>
                Open Sessions
              </Link>
            </div>
          </div>
        </header>
      </div>
    </main>
  );
}
