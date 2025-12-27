import { NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabaseServer"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params
    console.log("[api] POST /api/orders/:id/done", { id })
    const idNum = Number(id)
    if (!Number.isFinite(idNum) || idNum <= 0) {
      console.warn("[api] invalid id for done", { id })
      return NextResponse.json({ error: "invalid-id" }, { status: 400 })
    }
    const supabase = getServiceClient()
    const { error } = await supabase.from("orders").update({ status: "done" }).eq("id", idNum)
    if (error) throw error
    console.log("[api] order marked done", { id: idNum })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[api] POST /api/orders/:id/done error", { message: e?.message })
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 })
  }
}
