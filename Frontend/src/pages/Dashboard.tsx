import axios from "axios";  
import { useState, useEffect, useRef } from "react";
import { type User } from "@supabase/supabase-js";
import { useNavigate } from "react-router";
import { createClient } from "../lib/client";
import { BACKEND_URL } from "../lib/config";    
import {
  Plus,
  Monitor,
  Layout,
  FileText,
  Sliders,
  Clock,
  Settings,
  Bell,
  LogOut,
  ChevronDown,
  Search,
  Mic,
  Send,
  MessageSquare,
  Trash2,
  Globe,
  Sparkles,
  RefreshCw,
  Share2
} from "lucide-react";

const supabase = createClient();

interface Message {
  id: number;
  content: string;
  role: "User" | "Assistant";
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  slung: string;
  userId: string;
  messages?: Message[];
}

// Content parser for extracting answer, follow-ups, and sources from streamed/saved responses
function parseStreamContent(text: string) {
  let answer = text;
  let sources: Array<{ url: string }> = [];
  let followUps: string[] = [];

  // 1. Parse and extract sources block
  const sourcesStart = text.indexOf("-------SOURCES-------");
  const sourcesEnd = text.indexOf("-------/SOURCES-------");
  if (sourcesStart !== -1 && sourcesEnd !== -1) {
    const jsonStr = text.substring(sourcesStart + "-------SOURCES-------".length, sourcesEnd).trim();
    try {
      sources = JSON.parse(jsonStr);
    } catch (e) {
      console.warn("Error parsing sources JSON", e);
    }
    answer = answer.substring(0, sourcesStart) + answer.substring(sourcesEnd + "-------/SOURCES-------".length);
  } else if (sourcesStart !== -1) {
    answer = answer.substring(0, sourcesStart);
  }

  // 2. Parse and extract follow-ups
  const followUpsStart = answer.indexOf("<FOLLOW_UPS>");
  const followUpsEnd = answer.indexOf("</FOLLOW_UPS>");
  if (followUpsStart !== -1 && followUpsEnd !== -1) {
    const block = answer.substring(followUpsStart + "<FOLLOW_UPS>".length, followUpsEnd).trim();
    const matches = block.match(/<question>(.*?)<\/question>/g);
    if (matches) {
      followUps = matches.map(m => m.replace(/<\/?question>/g, "").trim());
    }
    answer = answer.substring(0, followUpsStart) + answer.substring(followUpsEnd + "</FOLLOW_UPS>".length);
  } else if (followUpsStart !== -1) {
    answer = answer.substring(0, followUpsStart);
  }

  // 3. Extract answer content from <ANSWER> tags
  const answerStart = answer.indexOf("<ANSWER>");
  const answerEnd = answer.indexOf("</ANSWER>");
  if (answerStart !== -1 && answerEnd !== -1) {
    answer = answer.substring(answerStart + "<ANSWER>".length, answerEnd).trim();
  } else if (answerStart !== -1) {
    answer = answer.substring(answerStart + "<ANSWER>".length).trim();
  }

  return {
    answer: answer.trim(),
    sources,
    followUps
  };
}

// Inline formatting parser for markdown elements like bold, inline code, and citations
function parseInlineFormatting(text: string) {
  if (!text) return "";
  
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`|\[[^\]]+\])/g;
  const splitParts = text.split(regex);

  splitParts.forEach((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      parts.push(<strong key={idx} className="font-bold text-white">{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("`") && part.endsWith("`")) {
      parts.push(<code key={idx} className="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded font-mono text-xs">{part.slice(1, -1)}</code>);
    } else if (part.startsWith("[") && part.endsWith("]")) {
      const citeContent = part.slice(1, -1);
      parts.push(
        <sup key={idx}>
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-[10px] text-emerald-400 font-medium font-mono cursor-pointer transition-colors shadow-sm">
            {citeContent}
          </span>
        </sup>
      );
    } else {
      parts.push(part);
    }
  });

  return parts;
}

// Structured element renderer for body paragraphs, markdown lists, and custom HTML tables
function renderFormattedContent(text: string) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let currentParagraph: string[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushParagraph = (key: string | number) => {
    if (currentParagraph.length > 0) {
      const paragraphText = currentParagraph.join("\n").trim();
      if (paragraphText) {
        elements.push(
          <div key={`p-${key}`} className="mb-4 text-neutral-200 text-sm md:text-base leading-relaxed whitespace-pre-line font-sans">
            {parseInlineFormatting(paragraphText)}
          </div>
        );
      }
      currentParagraph = [];
    }
  };

  const renderTable = (key: string | number) => (
    <div key={`table-${key}`} className="overflow-x-auto my-5 border border-neutral-800 rounded-xl bg-neutral-900/20 shadow-lg">
      <table className="min-w-full divide-y divide-neutral-800 text-sm">
        <thead className="bg-neutral-900/60">
          <tr>
            {tableHeaders.map((header, idx) => (
              <th key={idx} className="px-4 py-3 text-left font-semibold text-neutral-400 border-b border-neutral-800 tracking-wider">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/60">
          {tableRows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-neutral-900/30 transition-colors">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-3 text-neutral-300">
                  {parseInlineFormatting(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("|") && line.endsWith("|")) {
      flushParagraph(i);
      
      if (!inTable) {
        inTable = true;
        tableHeaders = line.split("|").map(s => s.trim()).filter(s => s !== "");
        tableRows = [];
        if (i + 1 < lines.length && lines[i + 1].trim().includes("-") && lines[i + 1].trim().startsWith("|")) {
          i++; 
        }
      } else {
        const rowCells = line.split("|").map(s => s.trim()).filter((s, idx, arr) => idx > 0 && idx < arr.length - 1);
        tableRows.push(rowCells);
      }
    } else {
      if (inTable) {
        elements.push(renderTable(i));
        inTable = false;
      }
      
      if (line.startsWith("- ") || line.startsWith("* ")) {
        flushParagraph(i);
        elements.push(
          <ul key={`list-${i}`} className="list-disc pl-5 mb-4 text-neutral-300 space-y-1 font-sans">
            <li>{parseInlineFormatting(line.substring(2))}</li>
          </ul>
        );
      } else {
        currentParagraph.push(lines[i]);
      }
    }
  }

  if (inTable) {
    elements.push(renderTable("end"));
  }
  flushParagraph("end");

  return elements;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);

  const displayName = user?.email ? user.email.split("@")[0] : "User";
  const userInitials = displayName
    .split(" ")
    .filter(Boolean)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "US";
  
  // Streaming states
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [activeSources, setActiveSources] = useState<Array<{ url: string }>>([]);
  const [activeFollowUps, setActiveFollowUps] = useState<string[]>([]);

  // Focus & Model states
  const [selectedFocus, setSelectedFocus] = useState("All");
  const [selectedModel, setSelectedModel] = useState("Gemini 1.5");
  const [showOptionsPopup, setShowOptionsPopup] = useState(false);
  const [activeTab, setActiveTab] = useState<"Answer" | "Links">("Answer");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Authenticate user
  useEffect(() => {
    async function checkAuth() {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
      } else {
        navigate("/auth");
      }
      if (error) {
        console.warn("Supabase auth error:", error.message);
      }
    }
    checkAuth();
  }, [navigate]);

  // Load conversations list
  async function loadConversations() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) return;

      const response = await axios.get(`${BACKEND_URL}/conversations`, {
        headers: { Authorization: jwt }
      });
      setConversations(response.data || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  }

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Scroll to bottom on updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, streamingAnswer]);

  // Select conversation from history
  async function handleSelectConversation(id: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) return;

      // Reset streaming states
      setStreamingAnswer("");
      setActiveSources([]);
      setActiveFollowUps([]);
      setActiveTab("Answer");

      const response = await axios.get(`${BACKEND_URL}/conversation/${id}`, {
        headers: { Authorization: jwt }
      });
      setActiveConversationId(id);
      setActiveMessages(response.data.messages || []);
    } catch (error) {
      console.error("Error loading conversation:", error);
      alert("Failed to load conversation history.");
    }
  }

  // Delete conversation
  async function handleDeleteConversation(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this search history?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) return;

      await axios.delete(`${BACKEND_URL}/conversation/${id}`, {
        headers: { Authorization: jwt }
      });

      if (activeConversationId === id) {
        setActiveConversationId(null);
        setActiveMessages([]);
      }
      loadConversations();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      alert("Failed to delete conversation.");
    }
  }

  // Clear workspace / Start new conversation
  function handleStartNewChat() {
    setActiveConversationId(null);
    setActiveMessages([]);
    setStreamingAnswer("");
    setActiveSources([]);
    setActiveFollowUps([]);
    setQuery("");
    setActiveTab("Answer");
  }

  // Submit search request (POST ask & follow_up streams)
  async function handleSubmitSearch(e: React.FormEvent, customQuery?: string) {
    e.preventDefault();
    const searchQuery = customQuery || query;
    if (!searchQuery.trim() || isStreaming) return;

    setIsStreaming(true);
    setStreamingAnswer("");
    setActiveSources([]);
    setActiveFollowUps([]);
    if (!customQuery) setQuery("");

    // Optimistically push user message to UI
    const tempUserMsg: Message = {
      id: Date.now(),
      content: searchQuery,
      role: "User",
      createdAt: new Date().toISOString()
    };
    setActiveMessages(prev => [...prev, tempUserMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) throw new Error("No active session");

      const endpoint = activeConversationId ? "/query_ai_ask/follow_up" : "/query_ai_ask";
      const body = activeConversationId
        ? { query: searchQuery, conversationId: activeConversationId }
        : { query: searchQuery };

      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": jwt
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      // Check header for new conversation ID
      const newConvId = response.headers.get("X-Conversation-Id");
      if (newConvId && !activeConversationId) {
        setActiveConversationId(newConvId);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamData = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          streamData += chunk;
          setStreamingAnswer(streamData);
        }
      }

      // Push the assistant's final response to local state to prevent visual vanishing
      const tempAssistantMsg: Message = {
        id: Date.now() + 1,
        content: streamData,
        role: "Assistant",
        createdAt: new Date().toISOString()
      };
      setActiveMessages(prev => [...prev, tempAssistantMsg]);
      setStreamingAnswer("");

      // Refresh conversations list so the sidebar updates
      await loadConversations();

    } catch (error: any) {
      console.error("Stream ask error:", error);
      alert(`Search error: ${error.message || String(error)}`);
    } finally {
      setIsStreaming(false);
    }
  }

  // Extract and deduplicate all sources across all assistant messages in the active conversation
  function getAllConversationSources() {
    const allSources: Array<{ url: string }> = [];
    const seen = new Set<string>();

    activeMessages.forEach(msg => {
      if (msg.role === "Assistant") {
        const parsed = parseStreamContent(msg.content);
        if (parsed.sources) {
          parsed.sources.forEach(src => {
            if (src.url && !seen.has(src.url)) {
              seen.add(src.url);
              allSources.push(src);
            }
          });
        }
      }
    });

    if (isStreaming && streamingAnswer) {
      const parsed = parseStreamContent(streamingAnswer);
      if (parsed.sources) {
        parsed.sources.forEach(src => {
          if (src.url && !seen.has(src.url)) {
            seen.add(src.url);
            allSources.push(src);
          }
        });
      }
    }

    return allSources;
  }

  // Renders sources pill
  function renderSourcesBlock(sourcesList: Array<{ url: string }>) {
    if (!sourcesList || sourcesList.length === 0) return null;
    return (
      <div className="flex flex-col gap-2 mt-2 mb-4 animate-fade-in">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-emerald-500" /> Sources Searched
        </span>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-300 font-medium rounded-full cursor-pointer transition-all shadow-sm">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span>{sourcesList.length} sources found</span>
          </div>
          {sourcesList.slice(0, 3).map((src, i) => {
            let domain = "Link";
            try {
              domain = new URL(src.url).hostname.replace("www.", "");
            } catch {}
            return (
              <a
                href={src.url}
                target="_blank"
                rel="noreferrer"
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-400 hover:text-white rounded-full transition-all"
              >
                <Share2 className="w-3 h-3 text-neutral-500" />
                <span className="truncate max-w-[120px]">{domain}</span>
              </a>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden select-none">
      
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-64 bg-[#080808] border-r border-neutral-900 p-4 flex flex-col justify-between shrink-0 h-full">
        <div className="flex flex-col flex-1 overflow-hidden">
          
          {/* Sidebar Top: Logo and panel controls */}
          <div className="flex items-center justify-between mb-5 select-none">
            <div className="flex items-center gap-2 cursor-pointer" onClick={handleStartNewChat}>
              <div className="relative flex items-center justify-center w-7 h-7 bg-emerald-950/40 border border-emerald-800/40 rounded-lg">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="font-bold text-lg text-neutral-200 tracking-wide">Query AI</span>
            </div>
            <button className="text-neutral-500 hover:text-neutral-300 p-1.5 rounded-lg hover:bg-neutral-900 transition-colors">
              <Monitor className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleStartNewChat}
            className="flex items-center justify-between w-full py-2 px-4 mb-5 border border-neutral-800 hover:border-neutral-700 bg-neutral-900 hover:bg-neutral-850 text-neutral-200 text-sm font-semibold rounded-full shadow-sm transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2"><Plus className="w-4 h-4 text-neutral-400" /> New Chat</span>
            <kbd className="text-[10px] font-mono text-neutral-500 bg-neutral-950 border border-neutral-800 px-1.5 py-0.5 rounded">Ctrl I</kbd>
          </button>

          {/* Core navigation links */}
          <nav className="flex flex-col gap-1 text-sm text-neutral-400 font-medium mb-6">
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-900 hover:text-white transition-all text-left">
              <Globe className="w-4 h-4" /> Discover
            </button>
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-900 hover:text-white transition-all text-left">
              <Layout className="w-4 h-4" /> Spaces
            </button>
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-900 hover:text-white transition-all text-left">
              <FileText className="w-4 h-4" /> Library
            </button>
          </nav>

          {/* Chat History Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <span className="text-xs font-bold text-neutral-500 px-3 uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
              <Clock className="w-3.5 h-3.5" /> History
            </span>
            <div className="flex-1 overflow-y-auto pr-1 space-y-1">
              {conversations.length === 0 ? (
                <div className="text-xs text-neutral-600 px-3 py-2 select-none">No past searches</div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all cursor-pointer ${
                      activeConversationId === conv.id
                        ? "bg-neutral-900 text-emerald-400 font-medium"
                        : "text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      <span className="truncate pr-2">{conv.title || "Untitled Search"}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Bottom Upgrade and Profile Row */}
        <div className="mt-4 flex flex-col gap-3">
          <div className="relative">
            <div
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-neutral-900 border border-neutral-900 hover:border-neutral-800 transition-all cursor-pointer select-none"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-800 text-emerald-100 flex items-center justify-center font-bold text-xs select-none">
                {userInitials}
              </div>
              <div className="flex-1 truncate pr-1">
                <div className="text-xs font-semibold text-neutral-200 truncate">{displayName}</div>
                <div className="text-[10px] text-neutral-500 truncate">{user?.email}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col h-full bg-[#121212] relative overflow-hidden">
        
        {/* LANDING MAIN PAGE (When activeConversationId is null) */}
        {!activeConversationId && activeMessages.length === 0 && (
          <div className="flex-1 flex flex-col">
            
            {/* Top Navigation Categories */}
            <header className="flex items-center justify-between px-8 py-4 border-b border-neutral-900/30 select-none">
              <div className="flex items-center gap-4 text-xs font-semibold text-neutral-500">
                <span className="text-neutral-200 border-b-2 border-emerald-500 pb-1 cursor-pointer">All</span>
                <span className="hover:text-neutral-300 cursor-pointer">Discover</span>
                <span className="hover:text-neutral-300 cursor-pointer">Finance</span>
                <span className="hover:text-neutral-300 cursor-pointer">Academic</span>
                <span className="hover:text-neutral-300 cursor-pointer">Patents</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400">
                <button className="px-3 py-1.5 hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer">English</button>
                <div className="w-7 h-7 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-xs text-emerald-100 select-none">
                  {userInitials}
                </div>
              </div>
            </header>

            {/* Central Landing Search Form */}
            <div className="flex-1 flex flex-col justify-center items-center px-6 max-w-2xl mx-auto w-full select-none">
              <h1 className="text-4xl md:text-5xl font-normal tracking-tight text-neutral-100 mb-8 font-serif text-center">
                Where knowledge begins
              </h1>
              
              <form onSubmit={handleSubmitSearch} className="w-full bg-[#181818] border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl focus-within:border-neutral-700/80 transition-all">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask anything..."
                  className="w-full bg-transparent border-0 outline-none text-neutral-200 placeholder-neutral-500 resize-none h-20 text-sm md:text-base font-sans select-text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitSearch(e);
                    }
                  }}
                />
                
                {/* Search control footer bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-full text-xs text-neutral-400 font-semibold cursor-pointer select-none transition-colors">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{selectedFocus}</span>
                      <ChevronDown className="w-3 h-3" />
                    </div>
                    <button type="button" className="text-neutral-500 hover:text-neutral-300 p-1.5 rounded-full hover:bg-neutral-900 transition-colors">
                      <Mic className="w-4 h-4" />
                    </button>
                  </div>
                  
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium select-none">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Query AI</span>
                      </div>
                    <button
                      type="submit"
                      disabled={!query.trim() || isStreaming}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        query.trim()
                          ? "bg-neutral-200 text-neutral-900 hover:bg-white cursor-pointer shadow-md"
                          : "bg-neutral-900 text-neutral-600 cursor-not-allowed border border-neutral-850"
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CHAT MESSAGES LOG VIEW (Active Chat State) */}
        {(activeConversationId || activeMessages.length > 0) && (
          <div className="flex-1 flex flex-col h-full overflow-hidden select-text">
            
            {/* Top Minimal Sticky Header with Tabs */}
            <header className="flex items-center justify-between px-8 py-2 border-b border-neutral-900/60 bg-[#121212]/85 backdrop-blur-md select-none shrink-0 z-10">
              <div className="flex items-center gap-6 text-sm">
                <button
                  onClick={() => setActiveTab("Answer")}
                  className={`flex items-center gap-2 pb-2 pt-1.5 border-b-2 font-medium transition-colors cursor-pointer ${
                    activeTab === "Answer"
                      ? "border-emerald-500 text-neutral-100"
                      : "border-transparent text-neutral-500 hover:text-neutral-350"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <span>Answer</span>
                </button>
                <button
                  onClick={() => setActiveTab("Links")}
                  className={`flex items-center gap-2 pb-2 pt-1.5 border-b-2 font-medium transition-colors cursor-pointer ${
                    activeTab === "Links"
                      ? "border-emerald-500 text-neutral-100"
                      : "border-transparent text-neutral-500 hover:text-neutral-350"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>Links</span>
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartNewChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 border border-neutral-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> New
                </button>
              </div>
            </header>

            {/* Scrollable Message History Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 space-y-6">
              <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
                
                {activeTab === "Answer" && (
                  <>
                    {/* Render chat history bubbles */}
                    {activeMessages.map((msg, index) => {
                      if (msg.role === "User") {
                        return (
                          <div
                            key={msg.id || index}
                            className="self-end bg-neutral-900 border border-neutral-800 text-neutral-100 px-4 py-2.5 rounded-2xl max-w-[85%] font-medium text-sm md:text-base shadow-sm animate-fade-in"
                          >
                            {msg.content}
                          </div>
                        );
                      } else {
                        const parsed = parseStreamContent(msg.content);
                        return (
                          <div key={msg.id || index} className="flex flex-col gap-4 animate-fade-in">
                            
                            {/* 1. Sources searched */}
                            {renderSourcesBlock(parsed.sources)}

                            {/* 2. Structured answer body content */}
                            <article className="prose prose-invert max-w-none text-neutral-200 leading-relaxed font-sans">
                              {renderFormattedContent(parsed.answer)}
                            </article>

                            {/* 3. Follow-up suggested questions button cards */}
                            {parsed.followUps.length > 0 && (
                              <div className="flex flex-col gap-2 mt-4 border-t border-neutral-900/60 pt-4">
                                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Related Searches
                                </span>
                                <div className="flex flex-col gap-1.5">
                                  {parsed.followUps.map((question, qIdx) => (
                                    <button
                                      key={qIdx}
                                      onClick={(e) => handleSubmitSearch(e, question)}
                                      className="flex items-center justify-between text-left w-full p-2.5 bg-neutral-900/40 hover:bg-neutral-900 border border-neutral-850 hover:border-neutral-800 rounded-xl text-xs md:text-sm text-neutral-300 hover:text-white transition-all cursor-pointer"
                                    >
                                      <span className="truncate pr-2 font-medium">{question}</span>
                                      <Plus className="w-4 h-4 text-emerald-500 shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                    })}

                    {/* Render live streaming answer block */}
                    {isStreaming && (
                      <div className="flex flex-col gap-4 animate-pulse-subtle">
                        {(() => {
                          const parsed = parseStreamContent(streamingAnswer);
                          return (
                            <>
                              {/* Sources searches indicator */}
                              {renderSourcesBlock(parsed.sources)}

                              {/* Stream answer text */}
                              <article className="prose prose-invert max-w-none text-neutral-200 leading-relaxed font-sans">
                                {renderFormattedContent(parsed.answer)}
                                {/* Streaming cursor dot */}
                                <span className="inline-block w-2.5 h-4 bg-emerald-500 ml-1 rounded-sm animate-pulse"></span>
                              </article>

                              {/* Suggested follow-ups stream */}
                              {parsed.followUps.length > 0 && (
                                <div className="flex flex-col gap-2 mt-4 border-t border-neutral-900/60 pt-4">
                                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Related Searches
                                  </span>
                                  <div className="flex flex-col gap-1.5">
                                    {parsed.followUps.map((question, qIdx) => (
                                      <button
                                        key={qIdx}
                                        onClick={(e) => handleSubmitSearch(e, question)}
                                        className="flex items-center justify-between text-left w-full p-2.5 bg-neutral-900/40 hover:bg-neutral-900 border border-neutral-850 hover:border-neutral-800 rounded-xl text-xs md:text-sm text-neutral-300 hover:text-white transition-all cursor-pointer"
                                      >
                                        <span className="truncate pr-2 font-medium">{question}</span>
                                        <Plus className="w-4 h-4 text-emerald-500 shrink-0" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}

                {activeTab === "Links" && (
                  <div className="flex flex-col gap-4 animate-fade-in mt-4">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-base font-semibold text-neutral-200 flex items-center gap-2 select-none">
                        <Globe className="w-4 h-4 text-emerald-500 animate-pulse" /> Sources & References
                      </h2>
                      <p className="text-xs text-neutral-500 select-none">All search citations crawled during this thread session.</p>
                    </div>

                    {(() => {
                      const sources = getAllConversationSources();
                      if (sources.length === 0) {
                        return (
                          <div className="text-xs text-neutral-600 bg-neutral-900/10 border border-neutral-850 p-6 rounded-2xl text-center select-none mt-2">
                            No web sources searched for this thread yet.
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                          {sources.map((src, idx) => {
                            let domain = "Reference Link";
                            try {
                              domain = new URL(src.url).hostname.replace("www.", "");
                            } catch {}
                            return (
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                key={idx}
                                className="flex items-start gap-3 p-3 bg-neutral-900/40 hover:bg-neutral-900 border border-neutral-850 hover:border-neutral-800 rounded-2xl transition-all shadow-sm group"
                              >
                                <div className="p-2 bg-neutral-950 border border-neutral-800 rounded-xl text-emerald-500 shrink-0 group-hover:text-emerald-400">
                                  <Globe className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-neutral-300 truncate group-hover:text-white">{domain}</div>
                                  <div className="text-[10px] text-neutral-500 truncate mt-0.5">{src.url}</div>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}


                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Bottom Sticky Ask Form */}
            <div className="sticky bottom-0 bg-gradient-to-t from-[#121212] via-[#121212] to-transparent pt-6 pb-6 px-6 md:px-8 shrink-0">
              <div className="max-w-2xl mx-auto w-full">
                <form onSubmit={handleSubmitSearch} className="w-full bg-[#181818] border border-neutral-800 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-lg focus-within:border-neutral-750 transition-all">
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a follow-up..."
                    className="w-full bg-transparent border-0 outline-none text-neutral-200 placeholder-neutral-500 resize-none h-12 text-sm select-text"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitSearch(e);
                      }
                    }}
                  />
                  
                  {/* Action row footer */}
                  <div className="flex items-center justify-between select-none">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 border border-neutral-850 hover:border-neutral-800 rounded-full text-[10px] text-neutral-400 font-semibold cursor-pointer transition-colors">
                        <Globe className="w-3 h-3 text-emerald-500" />
                        <span>Search</span>
                        <ChevronDown className="w-2.5 h-2.5" />
                      </div>
                      <button type="button" className="text-neutral-500 hover:text-neutral-300 p-1 rounded-full hover:bg-neutral-900 transition-colors">
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-neutral-500 font-medium select-none">Query AI</span>
                      <button
                        type="submit"
                        disabled={!query.trim() || isStreaming}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          query.trim()
                            ? "bg-neutral-200 text-neutral-900 hover:bg-white cursor-pointer shadow-md"
                            : "bg-neutral-900 text-neutral-600 cursor-not-allowed border border-neutral-850"
                        }`}
                      >
                        {isStreaming ? (
                          <RefreshCw className="w-3 h-3 animate-spin text-neutral-400" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

          </div>
        )}

      </main>
      
    </div>
  );
}