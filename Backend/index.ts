import middleware, { type AuthenticatedRequest } from "./middleware";
import { checkBillingLimit } from "./billingMiddleware";
import { prisma } from "./db";
import { tavily } from '@tavily/core';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import dotenv from 'dotenv';
import { SYSTEM_PROMPT, PROMPT_TEMPLATE } from './prompt';
import crypto from "crypto";

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
      where: { id: conversationId as string },
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
      where: { id: conversationId as string }
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

app.post("/query_ai_ask", middleware, checkBillingLimit, async (req: AuthenticatedRequest, res) => {
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

app.post("/query_ai_ask/follow_up", middleware, checkBillingLimit, async (req: AuthenticatedRequest, res) => {
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

// ==========================================
// 💳 PAYMENT AND BILLING ENDPOINTS (JUSPAY / RAZORPAY COMPATIBLE)
// ==========================================

// 1. Get Billing Status
app.get("/user/billing", middleware, async (req: AuthenticatedRequest, res) => {
  try {
    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: req.userId }
    });
    if (!dbUser) {
      return res.status(404).json({ error: "User not found in database" });
    }
    res.json({
      billingTier: dbUser.billingTier,
      credits: dbUser.credits,
      email: dbUser.email,
      name: dbUser.name
    });
  } catch (error: any) {
    console.error("❌ Error fetching billing:", error);
    res.status(500).json({ error: "Internal server error during billing fetch" });
  }
});

// 2. Create Order / Session
app.post("/payments/create-order", middleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { productType } = req.body; // "SUBSCRIPTION" or "TOPUP"
    if (!productType || (productType !== "SUBSCRIPTION" && productType !== "TOPUP")) {
      return res.status(400).json({ error: "Invalid productType. Must be SUBSCRIPTION or TOPUP" });
    }

    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: req.userId }
    });
    if (!dbUser) {
      return res.status(404).json({ error: "User not found in database" });
    }

    const amount = 100; // Both query ai pro and credit topup cost ₹1 (100 paise)
    const creditsAdded = productType === "TOPUP" ? 50 : 0;
    
    // Generate a unique Order ID (simulating Razorpay)
    const orderId = `order_${crypto.randomBytes(6).toString("hex")}`;

    // Record the pending payment in database
    await prisma.payment.create({
      data: {
        userId: dbUser.id,
        orderId,
        amount,
        currency: "INR",
        status: "PENDING",
        productType,
        creditsAdded
      }
    });

    res.json({
      orderId,
      amount,
      currency: "INR",
      productType,
      user: {
        name: dbUser.name,
        email: dbUser.email
      }
    });
  } catch (error: any) {
    console.error("❌ Error creating payment order:", error);
    res.status(500).json({ error: "Internal server error during order creation" });
  }
});

// 3. Webhook for Payment Success (Razorpay style)
app.post("/payments/webhook", async (req, res) => {
  try {
    console.log("📥 Webhook payload received:", req.body);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, mock_success, orderId } = req.body;

    // Support both production-grade Razorpay verification AND a sandbox simulation bypass for testing
    let finalOrderId = razorpay_order_id || orderId;
    let finalPaymentId = razorpay_payment_id || `pay_${crypto.randomBytes(6).toString("hex")}`;
    
    // Real Razorpay Signature Validation if headers/signature and order_id are present
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "sandbox_secret";
    if (razorpay_signature && razorpay_order_id) {
      const generatedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Invalid signature verification" });
      }
    } else if (!mock_success && !razorpay_payment_id) {
      return res.status(400).json({ error: "Missing verification parameters" });
    }

    if (!finalOrderId) {
      return res.status(400).json({ error: "Missing orderId parameter" });
    }

    // Process the payment updates in database transaction
    const result = await prisma.$transaction(async (tx) => {
      const paymentRecord = await tx.payment.findUnique({
        where: { orderId: finalOrderId }
      });

      if (!paymentRecord) {
        throw new Error("Payment record not found");
      }

      if (paymentRecord.status === "SUCCESS") {
        return { message: "Already processed" };
      }

      // Update payment state
      await tx.payment.update({
        where: { orderId: finalOrderId },
        data: {
          status: "SUCCESS",
          paymentId: finalPaymentId
        }
      });

      // Update user entitlements
      if (paymentRecord.productType === "SUBSCRIPTION") {
        await tx.user.update({
          where: { id: paymentRecord.userId },
          data: {
            billingTier: "PRO"
          }
        });
      } else if (paymentRecord.productType === "TOPUP") {
        await tx.user.update({
          where: { id: paymentRecord.userId },
          data: {
            credits: {
              increment: paymentRecord.creditsAdded
            }
          }
        });
      }

      return { message: "Payment processed successfully" };
    });

    res.json(result);
  } catch (error: any) {
    console.error("❌ Webhook error:", error.message);
    res.status(500).json({ error: error.message || "Internal server error during webhook processing" });
  }
});

// 4. Query Payment Status
app.get("/payments/status/:orderId", middleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { orderId } = req.params;
    const paymentRecord = await prisma.payment.findUnique({
      where: { orderId: orderId as string }
    });

    if (!paymentRecord) {
      return res.status(404).json({ error: "Payment order not found" });
    }

    res.json({
      orderId: paymentRecord.orderId,
      status: paymentRecord.status,
      productType: paymentRecord.productType,
      amount: paymentRecord.amount
    });
  } catch (error: any) {
    console.error("❌ Error checking status:", error);
    res.status(500).json({ error: "Internal server error checking payment status" });
  }
});

// 5. Get Payment Config
app.get("/payments/config", middleware, async (req: AuthenticatedRequest, res) => {
  res.json({
    razorpayKeyId: process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || ""
  });
});

// Use Render's PORT env var in production, fallback to 3000 for local dev
const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});