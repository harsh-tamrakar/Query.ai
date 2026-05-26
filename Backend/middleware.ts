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

            if (!existingUser && userEmail) {
                await prisma.user.create({
                    data: {
                        email: userEmail,
                        supabaseId: userId,
                        provider: data.data.user?.app_metadata.provider === "google" ? "Google" : "Github",
                        name: data.data.user?.user_metadata.name || data.data.user?.user_metadata.full_name || userEmail || "User"
                    }
                });
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