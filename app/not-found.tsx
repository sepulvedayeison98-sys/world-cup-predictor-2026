import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">404</span>
      <h1 className="text-xl font-bold text-white">Esta página no existe</h1>
      <p className="max-w-md text-sm text-zinc-400">
        El enlace puede estar vencido o la ruta cambió al reorganizar la
        plataforma por competiciones.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
      >
        Ir al inicio
      </Link>
    </div>
  )
}
