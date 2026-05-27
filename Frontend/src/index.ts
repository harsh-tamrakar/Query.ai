import { serve } from "bun";
import { join } from "node:path";

const port = parseInt(process.env.PORT || "3000");

let server;

if (process.env.NODE_ENV === "production") {
  const DIST_DIR = join(import.meta.dir, "../dist");
  console.log(`Running in PRODUCTION mode. Serving static files from: ${DIST_DIR}`);

  server = serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // Handle simple API routes if needed
      if (url.pathname === "/api/hello") {
        return Response.json({ message: "Hello from production frontend server!" });
      }

      // Resolve the file path in the dist folder
      const filePath = join(DIST_DIR, url.pathname);
      
      // Security check: ensure path is within DIST_DIR to prevent path traversal
      if (!filePath.startsWith(DIST_DIR)) {
        return new Response("Forbidden", { status: 403 });
      }

      const file = Bun.file(filePath);
      
      // If the file exists, serve it
      if (await file.exists()) {
        return new Response(file);
      }

      // Fallback to index.html for SPA client-side routing
      return new Response(Bun.file(join(DIST_DIR, "index.html")));
    },
  });
} else {
  // In development, serve the root index.html dynamically with HMR
  const index = require("../index.html").default;
  console.log(`Running in DEVELOPMENT mode. Serving dynamically...`);

  server = serve({
    port,
    routes: {
      "/*": index,
      "/api/hello": () => Response.json({ message: "Hello from development frontend server!" }),
    },
    development: true,
  });
}

console.log(`🚀 Server running at ${server.url}`);
