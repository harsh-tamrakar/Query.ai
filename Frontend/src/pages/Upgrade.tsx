import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { createClient } from "../lib/client";
import { ArrowLeft, Sparkles, Check, Wallet, ShieldCheck, Zap, CreditCard } from "lucide-react";
import { type User } from "@supabase/supabase-js";

const supabase = createClient();

export default function Upgrade() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showSandboxModal, setShowSandboxModal] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [razorpayKey, setRazorpayKey] = useState("");

  // Fetch current session
  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
      } else {
        navigate("/auth");
      }
      setLoading(false);
    }
    checkAuth();
  }, [navigate]);

  // Fetch payment config (keys) dynamically from the backend
  useEffect(() => {
    async function fetchConfig() {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const res = await fetch("http://localhost:3000/payments/config", {
          headers: {
            "Authorization": token ? token : "",
          }
        });
        const data = await res.json();
        setRazorpayKey(data.razorpayKeyId || "");
      } catch (e) {
        console.error("Failed to fetch payment config:", e);
      }
    }
    if (user) {
      fetchConfig();
    }
  }, [user]);

  // Load Razorpay SDK Script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const verifyPayment = async (paymentDetails: any) => {
    try {
      setProcessing(true);
      const response = await fetch("http://localhost:3000/payments/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentDetails),
      });

      if (response.ok) {
        alert("Payment verified successfully! Your account has been upgraded.");
        navigate("/dashboard");
      } else {
        alert("Payment verification failed on backend.");
      }
    } catch (e) {
      console.error("Verification error:", e);
      alert("Error contacting verification webhook.");
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckout = async (productType: "SUBSCRIPTION" | "TOPUP") => {
    if (!user) return;
    setProcessing(true);

    try {
      // Get JWT from Supabase
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      // 1. Create order on our backend
      const response = await fetch("http://localhost:3000/payments/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? token : "",
        },
        body: JSON.stringify({ productType }),
      });

      if (!response.ok) {
        throw new Error("Failed to create order");
      }

      const orderData = await response.json();
      setActiveOrder(orderData);

      // 2. Open payment flow
      // If Razorpay SDK is loaded and we have a key in our environment, we use it.
      // Otherwise, we open our premium built-in Sandbox Checkout simulator.
      if (razorpayKey && (window as any).Razorpay) {
        const options = {
          key: razorpayKey,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "Query AI",
          description: productType === "SUBSCRIPTION" ? "Pro Plan Monthly Subscription" : "50 Search Credits",
          // Omit order_id for simple checkout to bypass backend order creation requirement
          // order_id: orderData.orderId,
          prefill: {
            name: orderData.user.name,
            email: orderData.user.email,
          },
          handler: async function (response: any) {
            // Send payment details to webhook for verification
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId: orderData.orderId,
            });
          },
          theme: { color: "#10b981" },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Fallback to our Sandbox Simulator
        setShowSandboxModal(true);
      }
    } catch (error: any) {
      console.error("Payment initiation failed:", error);
      alert("Error starting transaction: " + (error.message || String(error)));
    } finally {
      setProcessing(false);
    }
  };

  const simulateSuccess = async () => {
    if (!activeOrder) return;
    setProcessing(true);
    setShowSandboxModal(false);

    try {
      // Send mock success webhook call to our backend
      const response = await fetch("http://localhost:3000/payments/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: activeOrder.orderId,
          mock_success: true,
        }),
      });

      if (response.ok) {
        alert(
          activeOrder.productType === "SUBSCRIPTION"
            ? "Successfully subscribed to Query AI Pro!"
            : "Successfully added 50 Search Credits to your wallet!"
        );
        navigate("/dashboard");
      } else {
        alert("Mock payment verification failed on backend.");
      }
    } catch (error) {
      console.error("Verification error:", error);
      alert("Error calling payment verification webhook.");
    } finally {
      setProcessing(false);
      setActiveOrder(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen bg-neutral-950 text-neutral-100 items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-neutral-400 font-medium">Loading checkout...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-screen bg-neutral-950 text-neutral-100 font-sans p-6 md:p-12 overflow-x-hidden relative select-none">
      
      {/* Decorative gradient glowing backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-950/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-950/20 blur-[120px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto w-full mb-8 z-10">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 hover:border-neutral-700 py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Workspace
        </button>
      </div>

      <div className="max-w-4xl mx-auto w-full text-center mb-12 z-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-neutral-100 mb-3 tracking-tight">
          Flexible Plans for <span className="bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">Power Searchers</span>
        </h1>
        <p className="text-neutral-400 text-sm md:text-base max-w-xl mx-auto">
          Upgrade to unlimited search completions or top up your wallet credits instantly.
        </p>
      </div>

      {/* Grid of pricing options */}
      <main className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 z-10 mb-12">
        
        {/* Card 1: Subscription Tier */}
        <div className="bg-[#0e0e0e] border border-neutral-900 hover:border-emerald-900/60 rounded-3xl p-6 md:p-8 flex flex-col justify-between transition-all duration-300 relative shadow-xl overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all"></div>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-3 py-1 rounded-full uppercase tracking-wider">
                Subscription Plan
              </span>
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>

            <h3 className="text-2xl font-bold text-neutral-100 mb-2">Query AI Pro</h3>
            <p className="text-xs text-neutral-400 mb-6">For users needing unlimited answers, citations, and models daily.</p>
            
            <div className="flex items-baseline gap-1.5 mb-6">
              <span className="text-4xl font-black text-neutral-100">₹1</span>
              <span className="text-sm font-semibold text-neutral-400">/ month</span>
            </div>

            <ul className="flex flex-col gap-3.5 mb-8">
              {[
                "Unlimited Search Completions",
                "Advanced Tavily Deep Research crawling",
                "Priority Gemini 2.5 Flash completion speeds",
                "Full Conversation history persistence",
                "No daily search limits",
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-neutral-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => handleCheckout("SUBSCRIPTION")}
            disabled={processing}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold rounded-2xl transition-all duration-200 shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4 fill-current" />
            {processing ? "Processing Order..." : "Upgrade to Pro"}
          </button>
        </div>

        {/* Card 2: Wallet Credits Tier */}
        <div className="bg-[#0e0e0e] border border-neutral-900 hover:border-indigo-900/60 rounded-3xl p-6 md:p-8 flex flex-col justify-between transition-all duration-300 relative shadow-xl overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/10 transition-all"></div>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-900/40 px-3 py-1 rounded-full uppercase tracking-wider">
                Micro-transactions
              </span>
              <Wallet className="w-5 h-5 text-indigo-400" />
            </div>

            <h3 className="text-2xl font-bold text-neutral-100 mb-2">Search Credit Pack</h3>
            <p className="text-xs text-neutral-400 mb-6">Pay-as-you-go model. Buy a one-time credit refill without commitments.</p>
            
            <div className="flex items-baseline gap-1.5 mb-6">
              <span className="text-4xl font-black text-neutral-100">₹1</span>
              <span className="text-sm font-semibold text-neutral-400">/ one-time</span>
            </div>

            <ul className="flex flex-col gap-3.5 mb-8">
              {[
                "Adds 50 search credits to your wallet",
                "Credits do NOT expire",
                "Use credits only when you search",
                "Includes citations & related follow-ups",
                "Upgrade to Pro at any time later",
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-neutral-300">
                  <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => handleCheckout("TOPUP")}
            disabled={processing}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold rounded-2xl transition-all duration-200 shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            {processing ? "Processing Order..." : "Buy 50 Credits"}
          </button>
        </div>

      </main>

      {/* Trust badges footer */}
      <div className="max-w-md mx-auto w-full flex items-center justify-center gap-6 text-xs text-neutral-500 border-t border-neutral-900 pt-6">
        <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-neutral-400" /> SECURE CHECKOUT</span>
        <span className="flex items-center gap-1"><CreditCard className="w-4 h-4 text-neutral-400" /> UPI & CARDS SUPPORTED</span>
      </div>

      {/* ==========================================
          💳 BUILT-IN SANDBOX CHECKOUT SIMULATOR
          ========================================== */}
      {showSandboxModal && activeOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative animate-scale-up">
            
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <ShieldCheck className="w-6 h-6 animate-pulse" />
              </div>
              <h4 className="text-lg font-bold text-neutral-100">Sandbox Payment Checkout</h4>
              <p className="text-xs text-neutral-400 mt-1">Simulating payment processing for developer verification</p>
            </div>

            {/* Transaction Info Box */}
            <div className="bg-neutral-950 border border-neutral-800/80 p-4 rounded-2xl flex flex-col gap-2.5 mb-6 text-xs text-neutral-300">
              <div className="flex justify-between">
                <span className="text-neutral-500">Order ID:</span>
                <span className="font-mono text-neutral-200">{activeOrder.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Customer:</span>
                <span className="text-neutral-200 truncate max-w-[150px]">{activeOrder.user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Product:</span>
                <span className="font-semibold text-emerald-400">
                  {activeOrder.productType === "SUBSCRIPTION" ? "Query AI Pro Subscription" : "50 Search Credits"}
                </span>
              </div>
              <div className="border-t border-neutral-800/50 my-1"></div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-neutral-400">Amount Due:</span>
                <span className="font-bold text-white text-base">₹{(activeOrder.amount / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={simulateSuccess}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Simulate Successful Payment
              </button>
              <button
                onClick={() => {
                  setShowSandboxModal(false);
                  setActiveOrder(null);
                }}
                className="w-full py-2.5 px-4 bg-neutral-850 hover:bg-neutral-800 text-neutral-400 font-semibold rounded-2xl transition cursor-pointer text-xs text-center border border-neutral-800"
              >
                Cancel Transaction
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
