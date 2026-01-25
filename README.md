This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

### Database Configuration (Prisma 7 + Neon/Postgres)

This project uses Prisma 7 with the `client` engine architecture. To deploy on Vercel, you must configure the following environment variables:

1.  **DATABASE_URL**: Your direct connection string (e.g., `postgresql://...`).
2.  **ACCELERATE_URL**: (Preferred) Your Prisma Accelerate connection string (`prisma://...`). 
    *   If provided, the app will use Accelerate for connection pooling and caching.
    *   If missing, the app will fallback to the **Neon Driver Adapter** using the `DATABASE_URL`.

#### Required Environment Variables in Vercel:
| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://user:pass@host:port/db?sslmode=require` |
| `ACCELERATE_URL` | `prisma://accelerate.prisma-data.net/?api_key=...` |

#### Technical Note:
In Prisma 7, the `engineType: "client"` requires either a driver adapter or an `accelerateUrl` to be passed to the `PrismaClient` constructor. Our implementation in `app/lib/prisma.ts` handles both cases automatically.
