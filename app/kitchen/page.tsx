"use client"
import { useCallback, useEffect, useState } from "react"

type OrderItem = { item: string; qty: number; completed?: boolean }

type OrderRow = { id: number; car_id: string; items: OrderItem[]; status: "pending" | "done"; created_at: string }

function parseNum(s: string): number {
  const m = /\d+/.exec(String(s) || "")
  return m ? Number(m[0]) : 0
}

function formatCarLabel(s: string): string {
  if (/^car-\d{3}$/.test(s)) return s
  const n = parseNum(s)
  if (n > 0) return `car-${String(n).padStart(3, "0")}`
  return "car-001"
}

export default function KitchenPage() {
  const [pending, setPending] = useState<OrderRow[]>([])
  const [done, setDone] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDbWarning, setShowDbWarning] = useState(true)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const r = await fetch("/api/orders", { cache: "no-store" })
      const j = (await r.json()) as { pending: OrderRow[]; done: OrderRow[]; error?: string }
      if (!r.ok) throw new Error(j.error || "failed")
      setPending(j.pending || [])
      setDone(j.done || [])
    } catch (e: any) {
      setError(e?.message || "failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      await load()
    })()
    const h = setInterval(() => {
      if (mounted) load()
    }, 5000)
    return () => {
      mounted = false
      clearInterval(h)
    }
  }, [load])

  const markDone = useCallback(
    async (id: number) => {
      setError(null)

      const orderToComplete = pending.find((order) => order.id === id)
      if (orderToComplete) {
        setPending((prev) => prev.filter((order) => order.id !== id))
        setDone((prev) => [...prev, { ...orderToComplete, status: "done" as const }])
      }

      try {
        const r = await fetch(`/api/orders/${id}/done`, { method: "POST" })
        const j = await r.json()
        if (!r.ok) throw new Error(j?.error || "failed")
      } catch (e: any) {
        if (orderToComplete) {
          setDone((prev) => prev.filter((order) => order.id !== id))
          setPending((prev) => [...prev, orderToComplete])
        }
        setError(e?.message || "failed")
      }
    },
    [pending],
  )

  const Section = ({ title, rows }: { title: string; rows: OrderRow[] }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-yellow-400">{title}</h3>
        <span className="bg-yellow-400 text-black px-2 py-1 rounded-full text-sm font-bold">{rows.length}</span>
      </div>
      <div className="space-y-4">
        {rows.map((order) => {
          const totalItems = order.items.reduce((sum, item) => sum + item.qty, 0)

          return (
            <div key={order.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {order.status === "pending" ? (
                    <input
                      type="checkbox"
                      onChange={() => markDone(order.id)}
                      className="w-5 h-5 text-yellow-400 bg-gray-800 border-gray-600 rounded focus:ring-yellow-400 focus:ring-2"
                    />
                  ) : (
                    <div className="w-5 h-5 bg-green-500 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                  <span className="bg-yellow-400 text-black px-3 py-1 rounded-full font-bold text-sm">
                    {formatCarLabel(order.car_id)}
                  </span>
                  <span className="text-gray-400 text-sm">#{order.id}</span>
                </div>
                <div className="text-sm text-gray-400">{totalItems} items</div>
              </div>

              <div className="space-y-2">
                {order.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center justify-between p-2 rounded border border-gray-700">
                    <span className={`${order.status === "done" ? "line-through text-gray-500" : "text-white"}`}>
                      {item.item}
                    </span>
                    <span className="bg-yellow-400 text-black px-2 py-1 rounded-full text-xs font-bold">
                      x{item.qty}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {rows.length === 0 && <div className="text-center py-8 text-gray-500 italic">No orders</div>}
      </div>
    </div>
  )

  return (
    <div
      className="min-h-screen bg-black text-white p-4 sm:p-6"
      style={{
        backgroundImage: `radial-gradient(circle, rgba(255, 193, 7, 0.1) 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-yellow-400">Kitchen</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <a
            href="/"
            className="border border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black px-3 py-2 text-sm rounded transition-colors"
          >
            Drive-Thru
          </a>
          <button
            onClick={load}
            disabled={loading}
            className="border border-gray-600 text-white hover:bg-gray-700 px-3 py-2 text-sm rounded transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {showDbWarning && (
        <div className="bg-black border border-yellow-400/30 p-4 rounded mb-6" style={{ background: 'rgba(255, 193, 7, 0.1)' }}>
          <div className="flex justify-between items-start gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">ℹ️</span>
                <strong className="text-yellow-400">Note</strong>
              </div>
              <div className="text-sm text-white/90">
                Supabase free tier pauses after 7 days of inactivity. If no orders appear, the database may be temporarily paused. The demo still works for new orders!
              </div>
            </div>
            <button 
              onClick={() => setShowDbWarning(false)}
              className="text-white/60 hover:text-white text-xl px-2 bg-transparent border-0 cursor-pointer"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {error && <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
        <Section title="Pending" rows={pending} />
        <Section title="Completed" rows={done} />
      </div>
    </div>
  )
}
