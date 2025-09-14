import { NextResponse } from "next/server"

export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ error: "Not Found This api has been removed! " }, { status: 404 })
}
