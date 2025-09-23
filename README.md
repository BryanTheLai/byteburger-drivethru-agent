# ByteBurger Drive-Thru 🍔

A minimal, blunt guide for the ByteBurger Drive-Thru voice ordering demo.

This repository contains a Next.js frontend + server routes, an ElevenLabs conversational agent client, and a Supabase-backed kitchen. The goal: speak an order to an agent, confirm counts, the agent records the order via a client tool and the kitchen UI shows pending/done orders.

## TL;DR (if you want to run it now) ⚡

- Create a Supabase project and run the SQL in `docs/supabase-setup.md` (creates `orders` table).
- Create an ElevenLabs Conversational Agent and add the client tool `place_order_after_confirmation` or `record_order` as documented below.
- Create a `.env.local` with the required env vars (see below).
- Run:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000` for the Drive‑Thru UI and `http://localhost:3000/kitchen` for the Kitchen UI.

## What this repo is 🧩


## Architecture Diagram
```dot
digraph Architecture {
  rankdir=LR
  node [shape=box]

  Frontend -> ConversationTokenService
  Frontend -> AgentClient
  AgentClient -> OrderService
  OrderService -> Supabase
  KitchenUI -> Supabase
}
}

## Minimal Requirements ✅

- Node 18+
- Supabase project (with `orders` table)
- ElevenLabs account with Conversational AI Agents and API access

## Env variables 🔐

Create `.env.local` at the project root (do NOT commit):

```text
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_agent_id
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` must be the service role key (server-only) so server routes can insert rows.
- `ELEVENLABS_AGENT_ID` is the agent you create in the ElevenLabs Dashboard.

## Supabase: SQL (what to run) 🗄️

Copy the SQL in `docs/supabase-setup.md` into Supabase SQL editor. The table schema is:

```sql
create table public.orders (
  id serial primary key,
  car_id text not null,
  items jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
```

Optional: add indexes on `status` or `created_at` if you want faster kitchen queries.

## ElevenLabs Agent: set up the client tool and system prompt 🤖

You must create an agent in the ElevenLabs Dashboard and add one client tool. The code in this repo expects the tool name `place_order_after_confirmation` but the docs mention `record_order` in places — pick one name and be consistent in the Dashboard and `.env` usage. The recommended tool config is below.

Client tool name: `place_order_after_confirmation`

JSON schema (copy exactly):

```json
{
  "type": "object",
  "properties": {
    "car_id": { "type": "string" },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "item": { "type": "string" },
          "qty": { "type": "integer", "minimum": 1 }
        },
        "required": ["item","qty"]
      },
      "minItems": 1
    }
  },
  "required": ["car_id","items"]
}
```

System prompt (use in the agent):

```
You are the ByteBurger Drive-Thru agent.

Menu (only these 5 items are available):
- ByteBurger
- NanoFries
- Quantum Nuggets
- Code Cola
- Debug Shake

Rules:
- Always keep responses short and snappy.
- When the user orders, repeat back exact counts to confirm (e.g., "2 ByteBurgers and 1 Code Cola. Is that correct?").
- Only after the user clearly confirms, call the client tool `place_order_after_confirmation` with the current `car_id` and the confirmed items.
- Do NOT invent or accept any items outside the menu.
- If asked for something else, politely say it’s not available and offer the menu items.
- After tool call, say it’s been placed, please move to the next counter. Then end the call.
```

Important: The agent must NOT call the tool until the user confirms. Your tool should only be called on an explicit confirmation.

## Files you should care about (quick map) 🗺️

- `app/page.tsx` — Drive‑Thru UI (agent client, WebRTC startup, client tools wiring, local UI for receipt and car_id management).
- `app/kitchen/page.tsx` — Kitchen UI (fetches from Supabase, mark done, seed demo orders).
- `app/api/conversation-token/route.ts` — Returns ElevenLabs conversation token using `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`.
- `lib/supabaseServer.ts` — Supabase server client helper (uses `SUPABASE_SERVICE_ROLE_KEY`).
- `docs/elevenlabs-agent.md` — Detailed agent instructions for Dashboard.
- `docs/supabase-setup.md` — Supabase SQL to create `orders` table.

If anything looks wrong here, grep the repo for the file names above.

## Behavior and important details ℹ️

- Menu is hardcoded to exactly 5 items (see the system prompt). The agent and UI should reject any other item names.
- `car_id` is a string like `car-001`, `car-002` and increments for each successful order.
- The Drive‑Thru UI will compute the next `car_id` client-side by checking existing orders and defaulting to `car-001`.
- Every new session (for a demo) should `localStorage.clear()` before starting to avoid stale state.

## How the flow works (step-by-step) ▶️

1. Load Drive‑Thru page, click `Start Voice Order`.
2. The page calls `GET /api/conversation-token` to get a conversation token from ElevenLabs. (See `app/api/conversation-token/route.ts`.)
3. It starts a WebRTC session with the agent using `@elevenlabs/react`.
4. You speak the order (or use the manual input fallback). The agent repeats counts and asks for confirmation.
5. You say `Yes` (or explicit confirm). Only then the agent calls the client tool `place_order_after_confirmation` (with `car_id` and `items`).
6. The client tool in the browser calls the Next.js backend route that inserts the order into Supabase.
7. The Drive‑Thru UI shows a receipt and the kitchen UI will show the pending order within ~5s refresh.

## Run and develop 🚀

Install and run the dev server:

```powershell
npm install
npm run dev
```

Open browser at `http://localhost:3000` and `http://localhost:3000/kitchen`.

Tips for local testing:

- Clear localStorage before demo: open Console → `localStorage.clear()`.
- Use a real microphone; grant permissions.
- If WebRTC fails, use manual fallback on the Drive‑Thru page (simple form to build order quantities).

## Testing & demo helpers 🧪

- Kitchen page has a `Seed Demo Orders` button to pre-populate pending orders for demos.
- Kitchen auto-refreshes every ~5 seconds — use this to simulate staff watching the queue.

## Troubleshooting 🛠️

- 500 from `GET /api/conversation-token`: ensure `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` are set.
- Orders not appearing in kitchen: ensure `SUPABASE_SERVICE_ROLE_KEY` is set and `orders` table exists.
- Agent accepts invalid items: check the agent system prompt & tool schema in the ElevenLabs Dashboard — the prompt must list only the 5 menu items.

## Security notes 🔒

- Never commit `.env.local` or service role keys.
- Server routes use the Supabase service role key — keep that out of client code and public repos.

## Minimal checklist before demo ✅

1. Run SQL in `docs/supabase-setup.md`.
2. Add `.env.local` with the four env vars above.
3. Create an ElevenLabs agent and add the client tool with the JSON schema and system prompt above.
4. Start dev server and test a single order.
5. Use `localStorage.clear()` before each new person/car for demos.