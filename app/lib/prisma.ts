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

    // 1. Prisma Accelerate (Preferred Option)
    // Prisma 7+: Specify accelerateUrl in the constructor to use the "client" engine correctly.
    if (accelerateUrl && (accelerateUrl.startsWith("prisma://") || databaseUrl?.startsWith("prisma://"))) {
        const client = new PrismaClient({
            accelerateUrl: accelerateUrl || databaseUrl,
        });
        return client.$extends(withAccelerate());
    }

    // 2. Neon Driver Adapter (Fallback Option)
    // Required in Prisma 7 when engineType = "client" and NO Accelerate URL is provided.
    // This uses the WebAssembly engine instead of a binary engine.
    if (databaseUrl) {
        const pool = new Pool({ connectionString: databaseUrl });
        const adapter = new PrismaNeon(pool as any);
        return new PrismaClient({ adapter: adapter as any });
    }

    // 3. Fallback to standard PrismaClient (might throw in some Prisma 7 envs if adapter/accelerate is missing)
    return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
