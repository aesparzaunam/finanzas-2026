import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// Singleton pattern to prevent too many connections in development
const globalForPrisma = globalThis as unknown as {
    prisma?: any
};

function createPrismaClient() {
    const accelerateUrl = process.env.ACCELERATE_URL || process.env.PRISMA_ACCELERATE_URL;
    const databaseUrl = process.env.DATABASE_URL;

    console.log("[Prisma] Initializing client v7...");
    console.log("[Prisma] DB URL present:", !!databaseUrl);

    // 1. Prisma Accelerate (Preferred if prisma://)
    if (accelerateUrl?.startsWith("prisma://") || databaseUrl?.startsWith("prisma://")) {
        console.log("[Prisma] Using Accelerate");
        return new PrismaClient({
            datasourceUrl: accelerateUrl || databaseUrl,
        } as any).$extends(withAccelerate());
    }

    // 2. Standard Client
    // Prisma 7 handles Neon URLs (including pooled ones) naturally in Node.js
    console.log("[Prisma] Using standard PrismaClient with datasourceUrl");
    return new PrismaClient({
        datasourceUrl: databaseUrl
    } as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
