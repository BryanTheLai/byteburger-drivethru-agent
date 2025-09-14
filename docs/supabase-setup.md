# Supabase Setup (Copy/Paste SQL)

Use this SQL in Supabase SQL Editor to create the single table used by ByteBurger.

```sql
create table if not exists public.orders (
  id serial primary key,
  car_id text not null,
  items jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
```

Optional indexes (nice-to-have, not required):

```sql
create index if not exists orders_status_created_at_idx on public.orders (status, created_at desc);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
```

Row Level Security (RLS) is not required for this demo since server routes use the Supabase Service Role key. If you enable RLS, ensure policies allow inserts/updates from your server environment.

# Environment Variables

Create a `.env.local` file in the `byteburger/` folder:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_agent_id
```

# Quick Checks

- After running the app and placing an order, open the `orders` table and confirm rows are inserted with JSONB `items`.
- Use Kitchen page → Seed Demo Orders to pre-populate test data.
