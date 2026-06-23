import { spawn } from "node:child_process";
import { join } from "node:path";

console.log("🚀 Starting Production Verification Tests...");

// 1. Run build process
console.log("\n📦 Step 1: Building frontend assets...");
const buildProc = spawn("bun", ["run", "build"], { 
  cwd: join(import.meta.dir, "../Frontend"),
  stdio: "inherit", 
  shell: true 
});

await new Promise((resolve, reject) => {
  buildProc.on("close", (code) => {
    if (code === 0) resolve(true);
    else reject(new Error(`Build failed with exit code ${code}`));
  });
});

// 2. Spin up production server locally
const PORT = "9876";
console.log(`\n🌐 Step 2: Spinning up production server on port ${PORT}...`);
const serverProc = spawn("bun", ["src/index.ts"], {
  cwd: join(import.meta.dir, "../Frontend"),
  env: { ...process.env, NODE_ENV: "production", PORT },
  shell: true,
});

// Wait for server to boot
await new Promise((resolve) => setTimeout(resolve, 2000));

let success = true;

try {
  // Test A: Fetch root HTML
  console.log("\n🧪 Test A: Fetching Root HTML (index.html)...");
  const resA = await fetch(`http://localhost:${PORT}/`);
  const html = await resA.text();
  console.log(`  - Status Code: ${resA.status} (Expected: 200)`);
  console.log(`  - Content-Type: ${resA.headers.get("content-type")}`);
  const hasRootDiv = html.includes('<div id="root"></div>');
  console.log(`  - Root Div Found: ${hasRootDiv} (Expected: true)`);
  if (resA.status !== 200 || !hasRootDiv) success = false;

  // Find JS bundle path in HTML
  const jsMatch = html.match(/src="(\/chunk-[^"]+\.js)"/);
  if (jsMatch) {
    const jsPath = jsMatch[1];
    console.log(`\n🧪 Test B: Fetching Compiled JS Bundle (${jsPath})...`);
    const resB = await fetch(`http://localhost:${PORT}${jsPath}`);
    console.log(`  - Status Code: ${resB.status} (Expected: 200)`);
    console.log(`  - Content-Type: ${resB.headers.get("content-type")}`);
    if (resB.status !== 200 || !resB.headers.get("content-type")?.includes("javascript")) {
      success = false;
    }
  } else {
    console.log("\n❌ Test B Failed: Could not parse JS bundle path from HTML");
    success = false;
  }

  // Test C: Fetch client-side router path (SPA fallback)
  console.log("\n🧪 Test C: Fetching Sub-route /dashboard (SPA Fallback)...");
  const resC = await fetch(`http://localhost:${PORT}/dashboard`);
  const fallbackHtml = await resC.text();
  console.log(`  - Status Code: ${resC.status} (Expected: 200)`);
  console.log(`  - Content-Type: ${resC.headers.get("content-type")}`);
  const fallbackHasRoot = fallbackHtml.includes('<div id="root"></div>');
  console.log(`  - Root Div Found in Fallback: ${fallbackHasRoot} (Expected: true)`);
  if (resC.status !== 200 || !fallbackHasRoot) success = false;

} catch (error) {
  console.error("\n❌ Test execution encountered an error:", error);
  success = false;
} finally {
  console.log("\n🛑 Stopping production server...");
  serverProc.kill("SIGINT");
  
  if (success) {
    console.log("\n✅ PRODUCTION VERIFICATION PASSED SUCCESSFULLY!\n");
    process.exit(0);
  } else {
    console.error("\n❌ PRODUCTION VERIFICATION FAILED!\n");
    process.exit(1);
  }
}
