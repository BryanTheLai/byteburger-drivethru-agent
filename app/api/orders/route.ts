import { type NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabaseServer"

type OrderItem = { item: string; qty: number }

type OrderRow = {
  id: number
  car_id: string
  items: OrderItem[]
  status: "pending" | "done"
  created_at: string
}

export async function GET(): Promise<NextResponse> {
  try {
    console.log("[api] GET /api/orders")
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from("orders")
      .select("id, car_id, items, status, created_at")
      .order("created_at", { ascending: false })
    if (error) throw error
    const rows = (data || []) as OrderRow[]
    console.log("[api] orders fetched", { count: rows.length })
    const pending = rows.filter((r) => r.status === "pending")
    const done = rows.filter((r) => r.status === "done")
    return NextResponse.json({ pending, done })
  } catch (e: any) {
    console.error("[api] GET /api/orders error", { message: e?.message })
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { car_id: string; items: OrderItem[] }
    console.log("[api] POST /api/orders", {
      car_id: body?.car_id,
      itemsCount: Array.isArray(body?.items) ? body.items.length : 0,
    })
    if (!body?.car_id || !Array.isArray(body?.items) || body.items.length === 0) {
      console.warn("[api] invalid body for /api/orders")
      return NextResponse.json({ error: "invalid-body" }, { status: 400 })
    }
    // Basic validation
    const allowed = new Set(["ByteBurger", "NanoFries", "Quantum Nuggets", "Code Cola", "Debug Shake"])
    for (const it of body.items) {
      if (typeof it?.item !== "string" || typeof it?.qty !== "number" || it.qty < 1 || !allowed.has(it.item)) {
        console.warn("[api] invalid item", { item: it?.item, qty: it?.qty })
        return NextResponse.json({ error: "invalid-items" }, { status: 400 })
      }
    }
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from("orders")
      .insert({ car_id: body.car_id, items: body.items, status: "pending" })
      .select("id")
      .single()
    if (error) throw error
    console.log("[api] order inserted", { id: (data as any)?.id })
    return NextResponse.json({ id: (data as any).id as number })
  } catch (e: any) {
    console.error("[api] POST /api/orders error", { message: e?.message })
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 })
  }
}
