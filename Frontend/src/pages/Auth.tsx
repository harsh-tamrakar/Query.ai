import { useState } from "react";
import { useNavigate } from "react-router";
import { createClient } from "../lib/client";
import { Sparkles, Globe, ShieldCheck, Cpu } from "lucide-react";

const supabase = createClient();

export default function Auth() {
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function login(provider: "github") {
    try {
      setIsLoggingIn(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error("Auth login error:", error);
      alert("Error while signing in: " + (error.message || String(error)));
      setIsLoggingIn(false);
    }
  }

  return (
    <div className="flex min-h-screen w-screen bg-[#050505] text-neutral-100 font-sans overflow-hidden select-none">
      
      {/* LEFT SIDEBAR/PANE: Showcase Platform Value */}
      <section className="hidden lg:flex lg:w-[55%] bg-[#080808] border-r border-neutral-900/60 p-16 flex-col justify-between relative overflow-hidden select-none">
        
        {/* Animated ambient background gradients */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute -bottom-40 right-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Top brand header */}
        <div className="flex items-center gap-2.5 z-10">
          <div className="relative flex items-center justify-center w-8 h-8 bg-emerald-950/40 border border-emerald-800/40 rounded-lg">
            <Sparkles className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <span className="font-bold text-lg text-neutral-200 tracking-wider">Query AI</span>
        </div>

        {/* Middle graphic illustration */}
        <div className="flex flex-col gap-10 max-w-lg z-10">
          <div className="flex flex-col gap-4">
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight leading-[1.15] text-white font-serif">
              Where knowledge begins.
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed max-w-sm mt-1">
              Ask complex questions. Query AI synthesizes information across the web, citing references in real-time, to build direct and trusted answers.
            </p>
          </div>

          {/* Live styled interface mockup */}
          <div className="border border-neutral-800/80 bg-[#0c0c0c]/90 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
            
            {/* Mock browser address bar */}
            <div className="flex items-center gap-2 border-b border-neutral-900/60 pb-3 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-800"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-800"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-800"></div>
              <div className="bg-[#070707] text-[10px] text-neutral-500 px-3 py-0.5 rounded-md flex-1 text-center font-mono truncate border border-neutral-900/30">
                query-ai.com/search?q=why-is-go-popular
              </div>
            </div>

            {/* Simulated User Question */}
            <div className="self-end bg-neutral-900 border border-neutral-800 text-xs px-3.5 py-2 rounded-xl text-neutral-350 max-w-[85%] font-medium">
              Why is Go popular for backend engineering?
            </div>

            {/* Simulated Assistant Answer */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wide">
                <Globe className="w-3 h-3 text-emerald-500" /> 4 Sources Searched
              </div>

              <div className="flex gap-2">
                <div className="bg-neutral-900/60 border border-neutral-850 px-2 py-1 rounded text-[9px] text-neutral-400 font-semibold">golang.org</div>
                <div className="bg-neutral-900/60 border border-neutral-850 px-2 py-1 rounded text-[9px] text-neutral-400 font-semibold">github.com</div>
                <div className="bg-neutral-900/60 border border-neutral-850 px-2 py-1 rounded text-[9px] text-neutral-400 font-semibold">dev.to</div>
              </div>

              <div className="text-neutral-300 text-xs leading-relaxed font-sans space-y-2 border-t border-neutral-900/60 pt-3">
                <p>
                  Go is highly favored for backend microservices and cloud workloads due to:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-neutral-450 text-[11px]">
                  <li><strong>Built-in Concurrency:</strong> Goroutines use minimal overhead compared to OS threads.</li>
                  <li><strong>Compilation Speed:</strong> Translates directly to machine binaries with fast execution.</li>
                  <li><strong>Strict Standard Tooling:</strong> Built-in formatters, testers, and performance profilers.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom features footer bar */}
        <div className="flex items-center gap-6 text-xs text-neutral-500 z-10">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-500" />
            <span>Hybrid Web Index</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-neutral-800"></span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Verified References</span>
          </div>
        </div>

      </section>

      {/* RIGHT SIDE: Authentication Card Form */}
      <main className="w-full lg:w-[45%] flex flex-col justify-center items-center p-8 md:p-16 relative">
        
        {/* Glow behind the login box */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-950/15 rounded-full blur-[120px] pointer-events-none -z-10"></div>

        <div className="max-w-sm w-full flex flex-col gap-8">
          
          {/* Logo container */}
          <div className="flex flex-col gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-950/30 border border-emerald-800/30 flex items-center justify-center text-emerald-400 shadow-md">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="mt-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
              <p className="text-xs text-neutral-500 mt-1">Sign in with your provider to access your search workspace</p>
            </div>
          </div>

          {/* Input control rows */}
          <div className="flex flex-col gap-3">
            
            <button
              onClick={() => login("github")}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850/80 text-neutral-200 text-sm font-semibold rounded-xl shadow-md transition-all cursor-pointer group active:scale-[0.985] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4.5 h-4.5 text-neutral-400 group-hover:text-white transition-colors fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              )}
              <span>Continue with GitHub</span>
            </button>

          </div>

          {/* Separation info */}
          <div className="flex items-center justify-between gap-3 select-none">
            <div className="h-[1px] bg-neutral-900 flex-1"></div>
            <span className="text-[10px] text-neutral-600 font-bold uppercase tracking-wider">Query AI Workspace</span>
            <div className="h-[1px] bg-neutral-900 flex-1"></div>
          </div>

          {/* Info footnote disclaimer */}
          <div className="text-center">
            <p className="text-[10px] text-neutral-500 leading-normal max-w-[280px] mx-auto">
              By logging in, you agree to our <a href="#" className="underline hover:text-neutral-350">Terms of Service</a> and <a href="#" className="underline hover:text-neutral-350">Privacy Policy</a>.
            </p>
          </div>

        </div>

      </main>

    </div>
  );
}