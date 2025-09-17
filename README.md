@elevenlabs-agent.md @supabase-setup.md @README.md 


# ByteBurger Drive-Thru Voice Ordering System



An app for voice-driven drive-thru ordering using ElevenLabs Conversational AI Agent + CRUD backend (Supabase).
You play the customer ("car-001", "car-002", …), talk to the Agent, confirm order, then the system records the order in database; kitchen staff views pending and done orders.



---



## 🎯 Overview & Goals



* Use an **ElevenLabs Agent** with a client tool `place_order_after_confirmation` to take simple orders from customers.
* Hardcoded menu of exactly **5 items**: ByteBurger, NanoFries, Quantum Nuggets, Code Cola, Debug Shake.
* Each car/session has its own **car\_id**, auto-incremented (car-001, car-002, …).
* Agent must repeat back order counts for confirmation before calling the tool.
* Once confirmed, store order in Supabase.
* Two screens:



  1. **Drive-Thru UI** (customer side): talk to agent, simulate car, fake receipt, next car.
  2. **Kitchen UI**: view orders (pending & done), mark done, refresh every 5 seconds.
* Include a mute button and voice animation to show speaking state of both the user and the agent.


---



## 🍲 Menu



* ByteBurger
* NanoFries
* Quantum Nuggets
* Code Cola
* Debug Shake



---



## 🔧 Agent Configuration & Client Tool



### Client Tool: `place_order_after_confirmation`



* **Name**: `place_order_after_confirmation`
* **Description**: “Records a confirmed order to the kitchen system. Use only after the user confirms counts.”
* **Parameters**:



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



* **Return**: simple string, e.g. `"order-recorded:123"`.



### System Prompt (Agent)



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
 - When the user orders, repeat back exact counts to confirm (e.g., "2 ByteBurgers and 1 Code Cola. Is that correct?").
 - Only after the user clearly confirms, call the client tool `place_order_after_confirmation` with the current `car_id` and the confirmed items.
 - Do NOT invent or accept any items outside the menu.
 - If asked for something else, politely say it’s not available and offer the menu items.
 - After tool call, say it’s been placed, please move to the next counter. Then end the call.
```



---



## 🏗 Core Architecture



Here’s how the pieces should be set up (UI, agent, database, tools).



### Components



| Component            | Responsibility                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Drive-Thru UI**    | Shows greeting, mic / WebRTC conversation via `@elevenlabs/react`, listens for car/customer voice, displays recognized text, handles “Yes” confirmation, shows receipt. Auto increments `car_id` each new order. Mute button + animation during voice. |
| **Kitchen UI**       | Connects to Supabase, shows list of all orders, grouped by status (`pending` / `done`), allows marking orders done, refresh every 5s + manual refresh.                                                                                                 |
| **Backend API**      | Next.js server routes that talk to Supabase: record\_order route (though Agent calls client tool which triggers server route), fetch orders, mark done. Also token route for Agent WebRTC.                                                             |
| **ElevenLabs Agent** | Configured via Dashboard (per your prompt + tool). Agent SDK client in the Drive-Thru UI: starts session with WebRTC, has available tool `record_order`.                                                                                               |



### Data Storage



Supabase table:



```sql
create table public.orders (
  id serial primary key,
  car_id text not null,
  items jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
```



* `car_id`: auto-incrementing like `"car-001"`, `"car-002"`.
* `items`: JSON array of `{ item: string, qty: integer }`.
* `status`: `'pending'` or `'done'`.
* `created_at`: timestamp.



### Flow



1. UI loads → fetch next car\_id (you can compute client-side via supabase query: max existing or start at “car-001” if none).
2. Start agent session using `@elevenlabs/react` with system prompt & tool.
3. User orders via voice: e.g. “I want 2 ByteBurgers and a Code Cola.”
4. Agent repeats exactly: “2 ByteBurgers and 1 Code Cola. Is that correct?”
5. User says “Yes.”
6. Agent calls `place_order_after_confirmation` tool with `{ car_id: “car-XXX”, items: [ … ] }`.
7. Backend route receives tool call, inserts into `orders` table.
8. UI shows “Order placed” + fake receipt. Then increment car\_id for next order (car-002).
9. Kitchen UI refreshes, sees new order, staff clicks “Mark as Done” → status update.



---



## 🛠 Requirements & Tech Stack



* **Library**: `@elevenlabs/react` (Agent SDK) for WebRTC voice conversation.
* **Supabase**: for database, real storage.
* **Next.js**: front + server.
* **localStorage**: for Drive-Thru UI session state if needed (for receipt visibility, car\_id persistence).
* **Environment Variables**:



```
NEXT_PUBLIC_SUPABASE_URL_URL=…
SUPABASE_SERVICE_ROLE_KEY=…
ELEVENLABS_API_KEY=…
ELEVENLABS_AGENT_ID=…
```



---



## 🎬 Demo Safety & Enhancements



* Pre-seed kitchen with a few fake “pending” orders so Kitchen UI isn’t empty.
* Make a **demo script**: you practice one full order flow (customer speaks, confirms, places, show receipt, kitchen sees, mark done).
* Mute button + voice animation so audience sees when the agent or car is speaking.
* If voice fails, always fallback to manual input for order.
* Auto car\_id reset or explicit clear before demo.



---



## ✅ Success Criteria



* Drive-Thru UI: user can talk to agent or manually input order, confirm, see receipt, car\_id increments.
* Agent does *not* accept invalid menu items.
* Orders inserted into Supabase, kitchen sees pending orders, can mark done.
* Kitchen UI refreshes every \~5s.
* No weird agent hallucinations; flow stays on script.



---
```app/api/conversation-token/route.ts
import { NextResponse } from "next/server"


export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID
  if (!apiKey || !agentId) {
    return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID" }, { status: 500 })
  }
  const url = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`
  const resp = await fetch(url, {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  })
  if (!resp.ok) {
    return NextResponse.json({ error: "Failed to get conversation token" }, { status: 500 })
  }
  const body = (await resp.json()) as { token: string }
  return NextResponse.json({ token: body.token })
}


```


Use this route.ts, it just works.


You will probably need something like this in page.tsx for the customer facing side:
```code from other project, dynamic variables and client are not the same as for byteburger!!
  try {
        await conversation.startSession({
          conversationToken: j.token,
          connectionType: "webrtc",
          dynamicVariables: {
            product_name: productName,
            product_description: productDescription,
            base_price: basePrice,
            sticker_price: stickerPrice,
            policy_confidential_competition: true,
            session_id: sid,
          },
          clientTools: {
            // allow the agent to report the numeric offer it heard
            set_user_offer: ({ offer }: { offer: number }): string => {
              try {
                const n = Math.max(0, Math.floor(Number(offer) || 0))
                // update both ref and React state so UI updates immediately.
                // Avoid setting identical values to reduce re-renders.
                if (stateRef.current.userOffer !== n) {
                  stateRef.current.userOffer = n
                  setUserOffer(n)
                }
                console.info("[clientTool] set_user_offer called ->", n)
                // emit a DOM event so you can observe tool calls from the browser console
                try {
                  window.dispatchEvent(new CustomEvent("elevenlabs-client-tool", { detail: { tool: "set_user_offer", parameters: { offer: n } } }))
                } catch { }
                return `ok:reported:${n}`
              } catch (e) {
                return `error`
              }
            },
          },
        })
  ```



Use context7 tool call or deepwiki or websearch, whatever you need to do to make sure this app works.
Make sure write readme of what i need to do from my part, like in elevenlabs dashboard.
write the skeleton and core logic, make sure everything works.
Research as much as you need, then plan and execute.
Make sure to follow what i said.
Keep things minimal, make sure they all work.
Make sure for each new person, car, use localStorage.clear() before starting.

Create in this repository.

## 🚀 Setup & Run

### 1) Prerequisites

- Node 18+
- An ElevenLabs account with Conversational AI Agents enabled
- A Supabase project

### 2) Environment Variables

Create a `.env.local` file at the repository root with:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_agent_id
```

Do not commit secrets.

### 3) Supabase Table

Open `docs/supabase-setup.md` and copy/paste the SQL into the Supabase SQL editor to create the `orders` table. Optional indexes are included.

### 4) ElevenLabs Agent Dashboard

Open `docs/elevenlabs-agent.md` and follow the steps to:

- Create the Client Tool `record_order` with the provided JSON schema
- Set the System Prompt exactly as shown
- Use your preferred voice

Copy the Agent ID into `.env.local` as `ELEVENLABS_AGENT_ID`.

### 5) Install & Run

```
npm install
npm run dev
```

Open http://localhost:3000 for Drive-Thru and http://localhost:3000/kitchen for Kitchen.

## 🧭 How To Use

### Drive-Thru

- Click `Start Voice Order` to begin a WebRTC session with the Agent
- Speak your order; the Agent will repeat counts to confirm
- Say "Yes" to confirm; the Agent calls `record_order` and the order is inserted
- A receipt appears; click `Next Car` to advance the `car_id`
- Use `Mute` if needed; the green dot indicates Agent speaking; red indicates idle/muted
- Manual fallback: type quantities and click `Confirm Manual Order`

### Kitchen

- Visit `/kitchen` to see `pending` and `done` orders
- Click `Mark Done` to move an order to done
- Auto-refreshes every ~5 seconds; click `Refresh` to force reload
- Click `Seed Demo Orders` to pre-populate pending rows for demos

## 🔐 Notes

- Server routes use the Supabase Service Role key; keep it only in server environment variables
- The conversation token endpoint is implemented at `app/api/conversation-token/route.ts`
- Each new session clears `localStorage` before starting

## 🧪 Demo Flow

1. Load `/kitchen`, click `Seed Demo Orders`
2. Load `/`, click `Start Voice Order`
3. Order: "Two ByteBurgers and one Code Cola"
4. Agent confirms counts; say "Yes"
5. Receipt appears; Kitchen shows a new pending order
6. In Kitchen, click `Mark Done`

## 🆘 Troubleshooting

- If `Start Voice Order` fails, verify `.env.local` is set and restart the dev server
- Ensure your browser has microphone permissions
- Confirm the Agent has the `record_order` tool configured with the correct JSON schema
- Supabase insert errors usually mean environment variables are missing or table not created