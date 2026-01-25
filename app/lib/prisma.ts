import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Neon config for serverless environments
neonConfig.webSocketConstructor = ws;

// Singleton pattern to prevent too many connections in development
const globalForPrisma = globalThis as unknown as {
    prisma?: any
};

function createPrismaClient() {
    const accelerateUrl = process.env.ACCELERATE_URL || process.env.PRISMA_ACCELERATE_URL;
    const databaseUrl = process.env.DATABASE_URL;

    console.log("[Prisma] Initializing client...");

    // 1. Prisma Accelerate (Preferred Option)
    if (accelerateUrl?.startsWith("prisma://") || databaseUrl?.startsWith("prisma://")) {
        console.log("[Prisma] Using Accelerate (Data Proxy)");
        // Prisma 7+: Specify accelerateUrl in the constructor
        const client = new PrismaClient({
            accelerateUrl: accelerateUrl || databaseUrl,
        } as any);
        return client.$extends(withAccelerate());
    }

    // 2. Neon Driver Adapter (Fallback Option)
    if (databaseUrl && !databaseUrl.startsWith("file:")) {
        console.log("[Prisma] Using Neon Driver Adapter");
        try {
            const pool = new Pool({ connectionString: databaseUrl });
            const adapter = new PrismaNeon(pool as any);
            return new PrismaClient({ adapter: adapter as any });
        } catch (error) {
            console.error("[Prisma] Failed to initialize Neon Driver Adapter:", error);
        }
    }

    // 3. Fallback to standard PrismaClient
    console.log("[Prisma] Using standard PrismaClient");
    return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
