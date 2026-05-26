import { useState, useEffect } from "react";
import { type User } from "@supabase/supabase-js";
import { useNavigate } from "react-router";
import { createClient } from "../lib/client";
import { Sparkles, User as UserIcon, Mail, LogOut, ArrowLeft, Calendar } from "lucide-react";

const supabase = createClient();

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const displayName = user?.email ? user.email.split("@")[0] : "User";
  const userInitials = displayName
    .split(" ")
    .filter(Boolean)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "US";

  useEffect(() => {
    async function checkAuth() {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
      } else {
        navigate("/auth");
      }
      setLoading(false);
      if (error) {
        console.warn("Profile auth error:", error.message);
      }
    }
    checkAuth();
  }, [navigate]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Failed to log out.");
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen bg-neutral-950 text-neutral-100 items-center justify-center font-sans select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-neutral-400 font-medium">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-screen bg-neutral-950 text-neutral-100 font-sans p-6 md:p-12 overflow-x-hidden select-none">
      
      {/* Back button */}
      <div className="max-w-xl mx-auto w-full mb-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 hover:border-neutral-700 py-2 px-4 rounded-xl transition-all cursor-pointer shadow-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Workspace
        </button>
      </div>

      {/* Main Profile Card Container */}
      <main className="max-w-xl mx-auto w-full bg-[#0e0e0e] border border-neutral-900 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-6 animate-fade-in">
        
        {/* Header section with brand and user name */}
        <div className="flex items-center justify-between pb-6 border-b border-neutral-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-200">Query AI Profile</h1>
              <p className="text-xs text-neutral-500">Manage your account settings</p>
            </div>
          </div>
        </div>

        {/* Profile Details List */}
        <div className="flex flex-col gap-4">
          
          {/* User Name Row */}
          <div className="flex items-center gap-4 bg-neutral-900/40 border border-neutral-900 p-4 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-emerald-800 text-emerald-100 flex items-center justify-center font-bold text-sm">
              {userInitials}
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 mb-0.5">Full Name</div>
              <div className="text-sm font-semibold text-neutral-200">{displayName}</div>
            </div>
            <UserIcon className="w-4 h-4 text-neutral-500" />
          </div>

          {/* User Email Row */}
          <div className="flex items-center gap-4 bg-neutral-900/40 border border-neutral-900 p-4 rounded-2xl">
            <div className="flex-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 mb-0.5">Email Address</div>
              <div className="text-sm font-semibold text-neutral-200 truncate">{user?.email}</div>
            </div>
            <Mail className="w-4 h-4 text-neutral-500" />
          </div>

          {/* Date Joined */}
          <div className="flex items-center gap-4 bg-neutral-900/40 border border-neutral-900 p-4 rounded-2xl">
            <div className="flex-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 mb-0.5">Created At</div>
              <div className="text-sm font-semibold text-neutral-200">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: "long" }) : "N/A"}
              </div>
            </div>
            <Calendar className="w-4 h-4 text-neutral-500" />
          </div>

        </div>

        {/* Action row containing sign out */}
        <div className="mt-4 pt-6 border-t border-neutral-900">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 justify-center w-full bg-red-950/20 border border-red-900/40 hover:border-red-900 hover:bg-red-950/40 text-red-400 font-semibold py-2.5 px-4 rounded-2xl transition-all cursor-pointer text-sm shadow-md"
          >
            <LogOut className="w-4 h-4" /> Log Out of Account
          </button>
        </div>

      </main>

    </div>
  );
}
