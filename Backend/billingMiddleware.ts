import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./middleware";
import { prisma } from "./db";

export async function checkBillingLimit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized: No user session found" });
    }

    // Find the user in the database
    const dbUser = await prisma.user.findFirst({
      where: { supabaseId: req.userId }
    });

    if (!dbUser) {
      return res.status(404).json({ error: "User not found in database" });
    }

    // 1. If user is on the PRO tier, they have unlimited queries
    if (dbUser.billingTier === "PRO") {
      return next();
    }

    // 2. If user is on FREE tier, check their wallet credits
    if (dbUser.credits > 0) {
      // Atomically decrement credits by 1
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          credits: {
            decrement: 1
          }
        }
      });
      return next();
    }

    // 3. Both subscription and credits exhausted
    return res.status(402).json({
      error: "Payment Required",
      message: "You have exhausted your free search queries. Upgrade to Pro for unlimited searches, or purchase additional search credits!"
    });

  } catch (error: any) {
    console.error("❌ Billing middleware error:", error);
    return res.status(500).json({ error: "Internal server error during billing check" });
  }
}
