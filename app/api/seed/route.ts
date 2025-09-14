import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabaseServer"

const DEMO: { car_id: string; items: { item: string; qty: number }[] }[] = [
  {
    car_id: "car-001",
    items: [
      { item: "ByteBurger", qty: 2 },
      { item: "Code Cola", qty: 1 },
    ],
  },
  {
    car_id: "car-002",
    items: [
      { item: "NanoFries", qty: 1 },
      { item: "Quantum Nuggets", qty: 1 },
    ],
  },
  { car_id: "car-003", items: [{ item: "Debug Shake", qty: 2 }] },
]

export async function POST(): Promise<NextResponse> {
  try {
    console.log("[api] POST /api/seed")
    const supabase = getServiceClient()
    const { error } = await supabase
      .from("orders")
      .insert(DEMO.map((x) => ({ car_id: x.car_id, items: x.items, status: "pending" })))
    if (error) throw error
    console.log("[api] seed inserted", { rows: DEMO.length })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[api] POST /api/seed error", { message: e?.message })
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 })
  }
}
