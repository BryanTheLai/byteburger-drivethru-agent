import { NextResponse } from "next/server"

export async function GET(): Promise<NextResponse> {
  console.log("[api] GET /api/conversation-token")
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID
  if (!apiKey || !agentId) {
    console.error("[api] conversation-token missing env", { hasApiKey: !!apiKey, hasAgentId: !!agentId })
    return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID" }, { status: 500 })
  }
  const url = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`
  console.log("[api] requesting token", { url })
  const resp = await fetch(url, {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  })
  if (!resp.ok) {
    console.error("[api] token fetch failed", { status: resp.status })
    return NextResponse.json({ error: "Failed to get conversation token" }, { status: 500 })
  }
  const body = (await resp.json()) as { token: string }
  console.log("[api] token issued", { length: body?.token?.length ?? 0 })
  return NextResponse.json({ token: body.token })
}
