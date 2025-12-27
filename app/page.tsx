"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useConversation } from "@elevenlabs/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const MENU = [
  { name: "ByteBurger", price: 8.00 },
  { name: "NanoFries", price: 4.00 },
  { name: "Quantum Nuggets", price: 6.00 },
  { name: "Code Cola", price: 2.00 },
  { name: "Debug Shake", price: 5.00 },
] as const

type ItemName = (typeof MENU)[number]["name"]

type OrderItem = { item: ItemName; qty: number }

type OrderRow = { id: number; car_id: string; items: OrderItem[]; status: "pending" | "done"; created_at: string }

function parseCarNumber(s: string): number {
  const m = /car-(\d{3,})/.exec(s)
  return m ? Number(m[1]) : 0
}

function formatCarId(n: number): string {
  return `car-${String(n).padStart(3, "0")}`
}

export default function Page() {
  const [micMuted, setMicMuted] = useState(false)
  const [started, setStarted] = useState(false)
  const [carId, setCarId] = useState<string>("car-001")
  const [receipt, setReceipt] = useState<{ id: number; car_id: string; created_at: string; items: OrderItem[] } | null>(
    null,
  )
  const [manual, setManual] = useState<Record<ItemName, number>>({
    ByteBurger: 0,
    NanoFries: 0,
    "Quantum Nuggets": 0,
    "Code Cola": 0,
    "Debug Shake": 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stateRef = useRef({})
  const [sessionStart, setSessionStart] = useState<number | null>(null)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [uiEnded, setUiEnded] = useState(false)
  const [showPopup, setShowPopup] = useState(true)
  const [showDbWarning, setShowDbWarning] = useState(true)

  const ensureMicPermission = useCallback(async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) return
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      try {
        stream.getTracks().forEach((t) => t.stop())
      } catch {}
    } catch (e) {
      throw e
    }
  }, [])

  const unlockAudioOutput = useCallback(async () => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      if (ctx.state === "suspended") {
        await ctx.resume()
      }
      const buffer = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(ctx.destination)
      src.start(0)
      setTimeout(() => {
        try {
          src.disconnect()
          ctx.close?.()
        } catch {}
      }, 0)
    } catch {}
  }, [])

  const maximizeMediaElements = useCallback(() => {
    try {
      const els = Array.from(document.querySelectorAll("audio, video")) as HTMLMediaElement[]
      for (const el of els) {
        try {
          el.volume = 1
          ;(el as any).playsInline = true
          el.setAttribute("playsinline", "true")
          el.autoplay = true
          el.muted = false
          el.controls = false
        } catch {}
      }
    } catch {}
  }, [])

  const friendlyError = useCallback((e: any): string => {
    const name = String(e?.name || "")
    const msg = String(e?.message || e || "failed")
    if (name === "NotAllowedError" || /denied|permission/i.test(msg)) {
      return "Please enable microphone access permissions in your browser settings, then reload and try again."
    }
    if (name === "NotFoundError" || /no.*mic|not.*found/i.test(msg)) {
      return "No microphone detected. Please connect a microphone and try again."
    }
    if (/audio.*(context|playback).*blocked|autoplay/i.test(msg)) {
      return "Audio playback was blocked by the browser. Tap Order again after interacting with the page and ensure your device volume is turned up."
    }
    return msg
  }, [])

  const conversation = useConversation({
    micMuted,
    volume: 1,
    clientTools: {
  place_order_after_confirmation: async ({
        items,
      }: { items: { item: string; qty: number }[] }): Promise<string> => {
        try {
          console.log("[ui] clientTool place_order_after_confirmation called", { items })
          const usedCarId = /^car-\d{3}$/.test(carId) ? carId : formatCarId(parseCarNumber(carId) || 1)
          const payload = {
            car_id: usedCarId,
            items: items.map((x) => ({ item: x.item as ItemName, qty: Math.max(1, Math.floor(Number(x.qty) || 1)) })),
          }
          const resp = await fetch("/api/orders", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
          const body = (await resp.json()) as { id?: number }
          if (!resp.ok || !body?.id) {
            console.error("[ui] place_order_after_confirmation failed", { status: resp.status, body })
            return "error"
          }
          console.log("[ui] place_order_after_confirmation ok", { id: body.id })
          setReceipt({ id: body.id, car_id: usedCarId, created_at: new Date().toISOString(), items: payload.items })
          setUiEnded(true)
          try {
            setStarted(false)
          } catch {}
          try {
            const key = "endTimer"
            const anyRef = stateRef as React.MutableRefObject<Record<string, any>>
            if (anyRef.current[key]) {
              try {
                clearTimeout(anyRef.current[key])
              } catch {}
            }
            console.log("[ui] scheduling endTimer (5s) after place_order_after_confirmation")
            anyRef.current[key] = setTimeout(() => {
              console.log("[ui] endTimer fired — ending session")
              try {
                ;(conversation as any)?.endSession?.()
              } catch {}
              try {
                setStarted(false)
              } catch {}
            }, 10000)
          } catch {}
          try {
            window.dispatchEvent(
              new CustomEvent("elevenlabs-client-tool", { detail: { tool: "place_order_after_confirmation", parameters: payload } }),
            )
          } catch {}
          return `order-recorded:${body.id}`
        } catch {
          console.error("[ui] place_order_after_confirmation exception")
          return "error"
        }
      },
    },
  })
  const { isSpeaking, status } = conversation

  const totalQty = useMemo(() => Object.values(manual).reduce((a, b) => a + (b || 0), 0), [manual])

  const calculateTotal = useCallback((items: OrderItem[]) => {
    return items.reduce((total, item) => {
      const menuItem = MENU.find((m) => m.name === item.item)
      return total + (menuItem ? menuItem.price * item.qty : 0)
    }, 0)
  }, [])

  const computeNextCarId = useCallback(async (): Promise<string> => {
    try {
      console.log("[ui] computeNextCarId")
      const r = await fetch("/api/orders", { cache: "no-store" })
      const j = (await r.json()) as { pending: OrderRow[]; done: OrderRow[] }
      const all = [...(j.pending || []), ...(j.done || [])]
      let max = 0
      for (const row of all) max = Math.max(max, parseCarNumber(row.car_id))
      const candidate = max + 1
      console.log("[ui] next car", { candidate })
      return formatCarId(candidate || 1)
    } catch {
      console.warn("[ui] computeNextCarId fallback")
      return "car-001"
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const next = await computeNextCarId()
      if (mounted) setCarId(next)
    })()
    return () => {
      mounted = false
    }
  }, [computeNextCarId])

  const start = useCallback(async () => {
    console.log("[ui] start clicked")
    setError(null)
    setLoading(true)
    setUiEnded(false)
    try {
      try {
        localStorage.clear()
      } catch {}
      try {
        setMicMuted(false)
      } catch {}
      await ensureMicPermission()
      await unlockAudioOutput()
      const r = await fetch("/api/conversation-token", { cache: "no-store" })
      const j = (await r.json()) as { token?: string; error?: string }
      if (!j.token) throw new Error(j.error || "no-token")
      console.log("[ui] token received", { length: j.token.length })
      await conversation.startSession({
        conversationToken: j.token,
        connectionType: "webrtc",
      })
      maximizeMediaElements()
      setStarted(true)
    } catch (e: any) {
      const msg = friendlyError(e)
      setError(msg)
      console.error("[ui] start error", { name: e?.name, message: e?.message })
    } finally {
      setLoading(false)
    }
  }, [conversation, carId, ensureMicPermission, unlockAudioOutput, maximizeMediaElements, friendlyError])

  const stop = useCallback(async () => {
    console.log("[ui] stop clicked")
    try {
      if ((conversation as any)?.endSession) await (conversation as any).endSession()
    } catch {}
    setStarted(false)
  }, [conversation])

  const confirmManual = useCallback(async () => {
    console.log("[ui] confirmManual")
    setError(null)
    setLoading(true)
    try {
      const items: OrderItem[] = []
      for (const menuItem of MENU) {
        const qty = Math.max(0, Math.floor(Number(manual[menuItem.name]) || 0))
        if (qty > 0) items.push({ item: menuItem.name, qty })
      }
      if (items.length === 0) throw new Error("empty")
      const resp = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ car_id: carId, items }),
      })
      const body = (await resp.json()) as { id?: number; error?: string }
      if (!resp.ok || !body?.id) throw new Error(body?.error || "failed")
      console.log("[ui] manual order ok", { id: body.id })
      setReceipt({ id: body.id, car_id: carId, created_at: new Date().toISOString(), items })
    } catch (e: any) {
      setError(e?.message || "failed")
      console.error("[ui] manual order error", { message: e?.message })
    } finally {
      setLoading(false)
    }
  }, [manual, carId])

  const nextCar = useCallback(async () => {
    console.log("[ui] nextCar")
    try {
      localStorage.clear()
    } catch {}
    setReceipt(null)
    setUiEnded(false)
    const next = await computeNextCarId()
    setCarId(next)
  }, [computeNextCarId])

  useEffect(() => {
    console.log("[ui] status", status)
    if (status !== "connected") setStarted(false)
  }, [status])

  useEffect(() => {
    console.log("[ui] isSpeaking", isSpeaking)
  }, [isSpeaking])

  useEffect(() => {
    console.log("[ui] started", started)
  }, [started])

  useEffect(() => {
    maximizeMediaElements()
  }, [status, isSpeaking, maximizeMediaElements])

  useEffect(() => {
    const key = "endTimer"
    const anyRef = stateRef as React.MutableRefObject<Record<string, any>>
    return () => {
      if (anyRef.current[key]) {
        try {
          clearTimeout(anyRef.current[key])
        } catch {}
        anyRef.current[key] = null
      }
    }
  }, [])

  useEffect(() => {
    const key = "quietTimer"
    const anyRef = stateRef as React.MutableRefObject<Record<string, any>>
    if (receipt && started && !isSpeaking) {
      console.log("[ui] scheduling quietTimer (5s) — receipt present and agent quiet")
      if (anyRef.current[key]) {
        try {
          clearTimeout(anyRef.current[key])
        } catch {}
      }
      anyRef.current[key] = setTimeout(() => {
        console.log("[ui] quietTimer fired — ending session")
        try {
          ;(conversation as any)?.endSession?.()
        } catch {}
        try {
          setStarted(false)
        } catch {}
      }, 5000)
    } else {
      if (anyRef.current[key]) {
        try {
          clearTimeout(anyRef.current[key])
        } catch {}
        anyRef.current[key] = null
      }
    }
    return () => {
      if (anyRef.current[key]) {
        try {
          clearTimeout(anyRef.current[key])
        } catch {}
        anyRef.current[key] = null
      }
    }
  }, [receipt, started, isSpeaking, conversation])

  useEffect(() => {
    const key = "duration"
    const anyRef = stateRef as React.MutableRefObject<Record<string, any>>
    if (started) {
      const start = Date.now()
      setSessionStart(start)
      setSessionSeconds(0)
      if (anyRef.current[key]) {
        try {
          clearInterval(anyRef.current[key])
        } catch {}
      }
      anyRef.current[key] = setInterval(() => {
        setSessionSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)))
      }, 1000)
    } else {
      if (anyRef.current[key]) {
        try {
          clearInterval(anyRef.current[key])
        } catch {}
        anyRef.current[key] = null
      }
    }
    return () => {
      if (anyRef.current[key]) {
        try {
          clearInterval(anyRef.current[key])
        } catch {}
        anyRef.current[key] = null
      }
    }
  }, [started])

  return (
    <>
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recommendation</DialogTitle>
            <DialogDescription>
              For the best experience with voice ordering, please use a desktop computer with stable WiFi in a quiet room.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="button primary" onClick={() => setShowPopup(false)}>
              OK
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="container vstack">
      {showDbWarning && (
        <div className="card" style={{ 
          background: 'rgba(255, 193, 7, 0.1)', 
          border: '1px solid rgba(255, 193, 7, 0.3)',
          marginBottom: 16,
          position: 'relative'
        }}>
          <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div className="vstack" style={{ gap: 8 }}>
              <div className="hstack" style={{ gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '1.2em' }}>ℹ️</span>
                <strong style={{ color: 'rgb(255, 193, 7)' }}>Note</strong>
              </div>
              <div className="small" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                Supabase free tier pauses after 7 days of inactivity. Voice ordering and manual ordering still work — order history may be temporarily unavailable.
              </div>
            </div>
            <button 
              onClick={() => setShowDbWarning(false)}
              style={{ 
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                fontSize: '1.2em',
                padding: '4px 8px',
                minWidth: 'auto'
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="row" style={{ alignItems: "center", marginBottom: 16 }}>
        <div className="col">
          <h2>ByteBurger Drive-Thru</h2>
        </div>
        <div className="col" style={{ display: "flex", justifyContent: "flex-end" }}>
          <a className="link" href="/kitchen" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Kitchen
          </a>
        </div>
      </div>

      <div
        className="hstack"
        style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}
      >
        <span className="badge">{carId.toUpperCase()}</span>
        <div className="hstack" style={{ gap: 16, flexWrap: "wrap" }}>
          <div className="hstack" style={{ gap: 8, alignItems: "center" }}>
            <span className={`badge ${status === "connected" && started && !uiEnded ? "status-connected" : "status-ended"}`} title={`Agent is ${status}`}>
              Agent
            </span>
          </div>
          <div className="hstack" style={{ gap: 8, alignItems: "center" }}>
            <span className={`badge ${micMuted ? "status-ended" : "status-connected"}`}>
              You
            </span>
          </div>
        </div>
      </div>

      <div className="card vstack">
        <div className="hstack" style={{ gap: 12, justifyContent: "space-between" }}>
          {!started || uiEnded ? (
            <button className="button primary" onClick={start} disabled={loading} style={{ flex: 1 }}>
              Order
            </button>
          ) : (
            <button className="button" onClick={stop} style={{ flex: 1 }}>
              ⏹️ Stop
            </button>
          )}
          <button className="button" onClick={nextCar} style={{ flex: 1 }}>
            Next
          </button>
          <button
            className="button"
            onClick={() => {
              console.log("[v0] toggle mic", { to: !micMuted })
              setMicMuted((v) => !v)
            }}
            style={{ flex: 1 }}
          >
            {micMuted ? "🔇" : "🔊"}
          </button>
        </div>
        {error ? <div className="small error-text">{error}</div> : null}
        {sessionStart !== null && (uiEnded || status !== "connected" || !started) ? (
          <div className="small" title={`Session duration: ${sessionSeconds}s`}>Call ended • {sessionSeconds}s</div>
        ) : null}
      </div>

      {receipt && (
        <div className="card vstack">
          <h3>🧾 Receipt</h3>
          <div className="vstack">
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <strong>Order #{receipt.id}</strong>
              <span className="badge">{receipt.car_id.toUpperCase()}</span>
            </div>
            <div className="small">{new Date(receipt.created_at).toLocaleString()}</div>
            <div className="separator" />
            <div className="list">
              {receipt.items.map((item, idx) => {
                const menuItem = MENU.find((m) => m.name === item.item)
                const itemTotal = menuItem ? menuItem.price * item.qty : 0
                return (
                  <div key={idx} className="hstack" style={{ justifyContent: "space-between" }}>
                    <span>
                      {item.item} x{item.qty}
                    </span>
                    <span>${itemTotal.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
            <div className="separator" />
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <span>Total Items</span>
              <span>{receipt.items.reduce((a, b) => a + b.qty, 0)}</span>
            </div>
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <strong>Grand Total</strong>
              <strong>${calculateTotal(receipt.items).toFixed(2)}</strong>
            </div>
            <div className="separator" />
            <div>Order placed. Please proceed to the next counter.</div>
          </div>
        </div>
      )}

      <div className="card vstack">
        <h3>🍔 Menu</h3>
        <div className="list">
          {MENU.map((menuItem) => (
            <div
              className="hstack"
              key={menuItem.name}
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <span>{menuItem.name}</span>
              <div className="hstack" style={{ gap: 16, alignItems: "center" }}>
                <span className="small">${menuItem.price.toFixed(2)}</span>
                <input
                  type="number"
                  min={0}
                  value={manual[menuItem.name]}
                  onChange={(e) =>
                    setManual((s) => ({ ...s, [menuItem.name]: Math.max(0, Math.floor(Number(e.target.value || 0))) }))
                  }
                  style={{ width: 64 }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="separator" />
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <span className="small">Items: {totalQty}</span>
          <button className="button primary" onClick={confirmManual} disabled={loading || totalQty === 0}>
            Confirm Manually
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
