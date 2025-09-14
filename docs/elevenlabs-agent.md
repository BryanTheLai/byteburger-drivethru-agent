# ElevenLabs Agent Configuration

Use these instructions to configure your ElevenLabs Conversational AI Agent so it can drive the ByteBurger voice ordering flow.

## Client Tool: `record_order`

Create a Client Tool with this EXACT name:

```
record_order
```

Use this description:

```
Records a confirmed order to the kitchen system. Use only after the user confirms counts.
```

Parameters JSON Schema:

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
        "required": ["item", "qty"]
      },
      "minItems": 1
    }
  },
  "required": ["car_id", "items"]
}
```

Return value: Any short string is fine (the app expects a string). Example: `"order-recorded:123"`.

## System Prompt (copy/paste)

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
- Only after the user clearly confirms, call the client tool `record_order` with the current `car_id` and the confirmed items.
- Do NOT invent or accept any items outside the menu.
- If asked for something else, politely say it’s not available and offer the menu items.
- After tool call, say it's been placed, please move to the next counter. Then end the call.
```

## Connection Method

- The app requests a conversation token from `GET /api/conversation-token` and starts a WebRTC session with `@elevenlabs/react`.
- Ensure your ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID are set in `.env.local`.