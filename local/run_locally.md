# 💻 Running Query AI Locally

This guide details how to run the Query AI project locally on your machine. Thanks to the dynamic URL resolution implemented in the frontend, you **do not need to make any code changes or edit URLs** in the codebase when switching between local development and production.

---

## ⚡ Dynamic Environment Detection (No Code Changes Needed!)
We configured [config.ts](file:///e:/Perplexity/Frontend/src/lib/config.ts) to detect where it is running:
- **Local Hostname (`localhost` or `127.0.0.1`):** The app automatically directs API calls to the local backend at `http://localhost:3000`.
- **Production Hostname (Render):** The app automatically redirects API calls to the live production server at `https://query-ai-gwj8.onrender.com`.

This means you can work locally, and then commit and push to GitHub directly without changing a single line of URL code!

---

## 🛠️ Step-by-Step Local Setup

### 1. Prerequisites
Ensure you have the [Bun runtime](https://bun.sh/) installed:
```bash
bun --version
```

### 2. Configure Environment Files

#### Backend Environment Settings
Create a `.env` file in the [Backend/](file:///e:/Perplexity/Backend/) directory containing your developer credentials:
```env
DATABASE_URL="postgresql://..." # Your PostgreSQL Database URL
DIRECT_URL="postgresql://..."   # Direct connection URL (for migrations)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SECRET_KEY="your-supabase-service-role-key"
GEMINI_API_KEY="your-google-gemini-key"
TAVILY_API_KEY="your-tavily-search-key"
GITHUB_OAUTH_CLIENT_ID="your-github-client-id"
GITHUB_OAUTH_SECRET="your-github-client-secret"
```

#### Frontend Environment Settings
Create a `.env` file in the [Frontend/](file:///e:/Perplexity/Frontend/) directory:
```env
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
```

---

## 🚀 Launching the Servers Locally

### Step 1: Start the Backend Dev Server
Navigate to the `Backend` directory, install packages, and start the development engine in hot-reload mode:
```bash
cd Backend
bun install
bun --hot index.ts
```
The backend API server will listen on: **`http://localhost:3000`**

### Step 2: Start the Frontend Dev Server
Navigate to the `Frontend` directory, install packages, and start the client development server:
```bash
cd ../Frontend
bun install
bun run dev
```
The development frontend server will start with Hot Module Replacement (HMR) enabled on: **`http://localhost:3000`** (using port 3000 in your dev environment, or fallback ports). 

Open this address in your browser to test and develop your local workspace.
