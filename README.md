# Query AI 🚀
### The Next-Generation Synthesized AI Search Engine

> [!TIP]
> **Live Production Deployments:**
> - **Frontend Site (Render):** [https://query-ai-1.onrender.com](https://query-ai-1.onrender.com)
> - **Backend API Server (Render):** [https://query-ai-gwj8.onrender.com](https://query-ai-gwj8.onrender.com)
> - **Database & Auth Integration:** Hosted PostgreSQL & GitHub OAuth via Supabase

Query AI is a high-fidelity, premium dark-mode Perplexity clone built using the **Bun runtime**, **React**, **Express**, **Prisma ORM**, and **Google Gemini LLM**. It delivers a real-time, cited search experience that crawls the web, aggregates reliable sources, structures answers in markdown grids, and suggests context-aware follow-up questions.

---

## 🏗️ System Architecture

Query AI is architected with a decoupled frontend and backend, using **Supabase** for user authentication and user profile database synchronization.

### 🗺️ Component Relationships
```mermaid
graph TD
    Client[React SPA Frontend] -->|1. Authenticate with GitHub| Supabase[Supabase Auth]
    Supabase -->|2. SQL Insert Trigger| DB[(PostgreSQL Database)]
    Client -->|3. Request + JWT Token| API[Express API Server]
    API -->|4. Middleware JWT Validate| DB
    API -->|5. Retrieve Web Context| Tavily[Tavily Search API]
    API -->|6. Stream Generation| Gemini[Google Gemini 1.5]
    API -->|7. Persist History| Prisma[Prisma ORM]
    Prisma -->|8. Save Messages| DB
    API -->|9. Chunked SSE Stream| Client
```

```

### Key Technical Pillars:
1. **Frontend App**: Responsive React SPA styled with Tailwind CSS, utilizing Radix-UI components and Lucide icons for micro-interactions and transitions.
2. **Backend Engine**: Express server running on the ultra-fast Bun runtime. It handles authentication middleware, query history caching, Tavily web searching, and server-sent stream completions.
3. **Database Layer**: PostgreSQL managed via Supabase. Schema migrations and database interactions are performed using the Prisma v7 ORM.

---

## 🌟 Key Features

* **Instant Web Synthesis**: Crawls the web dynamically using the Tavily Search API and structures answers using Vercel AI SDK and Google Gemini (`gemini-1.5-flash`).
* **Interactive Workspace Tabs**:
  * **Answer**: Displays real-time streaming completions formatted in clean Markdown, citations, tables, and related questions.
  * **Links**: Renders a clean, deduplicated grid of every single domain reference crawled during the active thread session.
* **Smart XML-Like Response Parser**: Automatically decodes and parses `` `<ANSWER>` `` and `` `<FOLLOW_UPS>` `` suggestions in real-time, allowing users to click follow-up questions to query further in history context.
* **OAuth Security**: User registration, login, and sessions are securely managed via Supabase GitHub OAuth.
* **Secure JWT Middleware**: Private backend routes require a valid Supabase JWT in the `Authorization` header. The middleware lazily syncs verified users into the Postgres database, preventing constraint collisions.
* **Side-Docked Navigation**: Fast access to conversation histories (loaded via `GET /conversations`) with individual item deletion support (`DELETE /conversation/:id`).
* **Dedicated Account Page**: An elegant `/profile` interface displaying user credentials, avatar initials, and logout options.

---

## 🛠️ Setup & Running Instructions

We have separated local development configurations and production test workflows into dedicated directories:

### 💻 Running the App Locally (No Code/URL Changes Needed)
For a step-by-step setup to clone, configure, and launch the frontend and backend servers locally on your machine, see the **[Local Development Guide (local/run_locally.md)](file:///e:/Perplexity/local/run_locally.md)**.
- Note: The frontend automatically detects if it is running on `localhost` and routes API calls to the local port, so you do not need to rewrite any backend endpoint URLs in config files when switching environments!

### 📦 Verifying the App in Production Mode
For testing how the frontend builds, minifies, and serves assets under production conditions (`NODE_ENV=production`) using Bun's static serving and SPA client fallback logic, see the **[Production Verification Test Script (production/verify_production.ts)](file:///e:/Perplexity/production/verify_production.ts)**.
- You can run the production test suite locally using:
  ```bash
  bun run production/verify_production.ts
  ```

---

## ⚡ Database Synchronization Triggers

For production-grade authentication, we configure Postgres database triggers in the Supabase console. This syncs profile additions and removals from `auth.users` directly to the `public.User` schema managed by Prisma:

```sql
-- Trigger Function for User Creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public."User" (id, email, name, provider, "supabaseId")
  values (
    gen_random_uuid(),
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when new.raw_app_meta_data->>'provider' = 'google' then 'Google'::"Authprovider" else 'Github'::"Authprovider" end,
    new.id
  );
  return new;
end;
$$ language plpgsql security definer;

-- Bind Trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## 📸 Interface Screenshots

The following screenshots showcase the premium dark-mode interface and rich features of **Query AI**:

### 🔐 1. Authentication (GitHub OAuth / Clean Sign-In Screen)
![Authentication](screenshots/login_page.png)

### 🏠 2. Landing Dashboard (Sleek Query Input & History Side-Dock)
![Landing Dashboard](screenshots/landing_dashboard.png)

### 💬 3. Synthesized Answer (Real-time Citations & Follow-up Suggestions)
![Answer Citations](screenshots/answer_citations.png)

### 🔗 4. Reference Links Grid (Deduplicated Source Cards Layout)
![Reference Links Grid](screenshots/reference_links_grid.png)

### 👤 5. User Account Profile (Avatar Initials & Account Management)
![User Profile](screenshots/user_profile.png)
