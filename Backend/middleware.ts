import type { NextFunction, Request, Response } from "express";
import { createSupabaseClient } from "./client";
import { prisma } from "./db";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

let client: ReturnType<typeof createSupabaseClient> | null = null;

export default async function middleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        if (!client) {
            client = createSupabaseClient();
        }
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }

        const data = await client.auth.getUser(token);
        const userId = data.data.user?.id;

        if (userId) {
            const userEmail = data.data.user?.email || "";
            
            // Check if user already exists in Prisma DB to prevent unique constraint errors
            const existingUser = await prisma.user.findUnique({
                where: { email: userEmail }
            });

            let dbUser = existingUser;

            if (!dbUser && userEmail) {
                const metaProvider = data.data.user?.app_metadata.provider;
                const providerVal = metaProvider === "google" ? "Google" : (metaProvider === "github" ? "Github" : "Email");

                try {
                    dbUser = await prisma.user.create({
                        data: {
                            email: userEmail,
                            supabaseId: userId,
                            provider: providerVal,
                            name: data.data.user?.user_metadata.name || data.data.user?.user_metadata.full_name || userEmail || "User",
                            credits: 5 // Start with 5 free query credits
                        }
                    });
                } catch (createError: any) {
                    // Handle race condition: if another concurrent request created this user in the last millisecond
                    if (createError.code === "P2002") {
                        dbUser = await prisma.user.findUnique({
                            where: { email: userEmail }
                        });
                    } else {
                        throw createError;
                    }
                }
            }

            if (dbUser) {
                // Keep the database supabaseId synced if the user switches login methods (GitHub vs Email/Password)
                if (dbUser.supabaseId !== userId) {
                    await prisma.user.update({
                        where: { id: dbUser.id },
                        data: { supabaseId: userId }
                    });
                }
            }

            req.userId = userId;
            next();
        } else {
            return res.status(401).json({ error: "Unauthorized" });
        }
    } catch (error: any) {
        console.error("❌ Auth middleware error:", error);
        return res.status(500).json({ error: "Internal server error during authentication" });
    }
}