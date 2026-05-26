import middleware, { type AuthenticatedRequest } from "./middleware";
import { prisma } from "./db";
import { tavily } from '@tavily/core';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import dotenv from 'dotenv';
import { SYSTEM_PROMPT, PROMPT_TEMPLATE } from './prompt';

import cors from "cors";

import express from 'express';
dotenv.config();

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const app = express();

app.use(express.json());
app.use(cors());

if (!process.env.TAVILY_API_KEY) {
  throw new Error('No TAVILY_API_KEY found. Add it to .env or set the environment variable.');
}

const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY,
});


app.get("/conversations", middleware, async (req: AuthenticatedRequest, res) => {
  try {
    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: req.userId }
    });
    if (!dbUser) {
      return res.status(404).json({ error: "User not found in database" });
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId: dbUser.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    res.json(conversations);
  } catch (error: any) {
    console.error("❌ Error fetching conversations:", error);
    res.status(500).json({ error: "Internal serve(r error during conversations retrieval" });
  }
});

app.get("/conversation/:conversationId", middleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;
    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: req.userId }
    });
    if (!dbUser) {
      return res.status(404).json({ error: "User not found in database" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!conversation || conversation.userId !== dbUser.id) {
      return res.status(404).json({ error: "Conversation not found or access denied" });
    }

    res.json(conversation);
  } catch (error: any) {
    console.error("❌ Error fetching conversation:", error);
    res.status(500).json({ error: "Internal server error during conversation retrieval" });
  }
});

app.delete("/conversation/:conversationId", middleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;

    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: req.userId }
    });
    if (!dbUser) {
      return res.status(404).json({ error: "User not found in database" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation || conversation.userId !== dbUser.id) {
      return res.status(404).json({ error: "Conversation not found or access denied" });
    }

    // Delete all messages associated with the conversation
    await prisma.message.deleteMany({
      where: { conversationId: conversation.id }
    });

    // Delete the conversation
    await prisma.conversation.delete({
      where: { id: conversation.id }
    });

    res.json({ message: "Conversation deleted successfully" });
  } catch (error: any) {
    console.error("❌ Error deleting conversation:", error);
    res.status(500).json({ error: "Internal server error during conversation deletion" });
  }
});

app.post("/query_ai_ask", middleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { query, conversationId } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: req.userId }
    });
    if (!dbUser) {
      return res.status(404).json({ error: "User not found in database" });
    }

    // Create or fetch conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      });
      if (!conversation || conversation.userId !== dbUser.id) {
        return res.status(404).json({ error: "Conversation not found or access denied" });
      }
    } else {
      const title = query.slice(0, 50);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      conversation = await prisma.conversation.create({
        data: {
          title,
          slung: slug || "chat",
          userId: dbUser.id
        }
      });
    }

    // Save the user's message
    await prisma.message.create({
      data: {
        content: query,
        role: "User",
        conversationId: conversation.id
      }
    });

    // Set streaming headers
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('X-Conversation-Id', conversation.id);

    // Perform Tavily Search
    const webSearchResponse = await tavilyClient.search(query, {
      searchDepth: 'advanced',
    });
    const webSearchResult = webSearchResponse.results;

    // Context engineering
    const prompt = PROMPT_TEMPLATE
      .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResult))
      .replace("{{USER_QUERY}}", query);

    // Stream LLM response
    let assistantText = "";
    try {
      const result = streamText({
        model: google(process.env.GEMINI_MODEL || 'gemini-1.5-flash'),
        prompt: prompt,
        system: SYSTEM_PROMPT,
      });

      for await (const textPart of result.textStream) {
        res.write(textPart);
        assistantText += textPart;
      }
    } catch (error: any) {
      console.error("❌ Error streaming from Gemini API:", error);
      res.write(`\nError during streaming: ${error.message || String(error)}\n`);
    }

    // Save the assistant's response to the database
    if (assistantText) {
      await prisma.message.create({
        data: {
          content: assistantText,
          role: "Assistant",
          conversationId: conversation.id
        }
      });
    }

    // Stream back sources
    res.write('\n-------SOURCES-------\n');
    res.write(JSON.stringify(webSearchResult.map(result => ({ url: result.url }))));
    res.write('\n-------/SOURCES-------\n');
    res.end();

  } catch (error: any) {
    console.error("❌ Error in query_ai_ask:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error during search query processing" });
    } else {
      res.write(`\nInternal server error: ${error.message || String(error)}\n`);
      res.end();
    }
  }
});

app.post("/query_ai_ask/follow_up", middleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { query, conversationId } = req.body;
    if (!query || !conversationId) {
      return res.status(400).json({ error: "Query and conversationId are required" });
    }

    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: req.userId }
    });
    if (!dbUser) {
      return res.status(404).json({ error: "User not found in database" });
    }

    // Verify conversation ownership
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });
    if (!conversation || conversation.userId !== dbUser.id) {
      return res.status(404).json({ error: "Conversation not found or access denied" });
    }

    // Fetch conversation history
    const previousMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" }
    });
    const historyContext = previousMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join("\n\n");

    // Save the follow-up User message
    await prisma.message.create({
      data: {
        content: query,
        role: "User",
        conversationId: conversation.id
      }
    });

    // Set streaming headers
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('X-Conversation-Id', conversation.id);

    // Perform Tavily Search
    const webSearchResponse = await tavilyClient.search(query, {
      searchDepth: 'advanced',
    });
    const webSearchResult = webSearchResponse.results;

    // Context engineering including history
    const prompt = `
# Conversation History
${historyContext}

# Web search results for new query
${JSON.stringify(webSearchResult)}

## USER_QUERY
${query}
`;

    // Stream LLM response
    let assistantText = "";
    try {
      const result = streamText({
        model: google(process.env.GEMINI_MODEL || 'gemini-1.5-flash'),
        prompt: prompt,
        system: SYSTEM_PROMPT,
      });

      for await (const textPart of result.textStream) {
        res.write(textPart);
        assistantText += textPart;
      }
    } catch (error: any) {
      console.error("❌ Error streaming from Gemini API:", error);
      res.write(`\nError during streaming: ${error.message || String(error)}\n`);
    }

    // Save the assistant's response to the database
    if (assistantText) {
      await prisma.message.create({
        data: {
          content: assistantText,
          role: "Assistant",
          conversationId: conversation.id
        }
      });
    }

    // Stream back sources
    res.write('\n-------SOURCES-------\n');
    res.write(JSON.stringify(webSearchResult.map(result => ({ url: result.url }))));
    res.write('\n-------/SOURCES-------\n');
    res.end();

  } catch (error: any) {
    console.error("❌ Error in follow_up:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error during follow-up query processing" });
    } else {
      res.write(`\nInternal server error: ${error.message || String(error)}\n`);
      res.end();
    }
  }
});




// Use Render's PORT env var in production, fallback to 3000 for local dev
const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});