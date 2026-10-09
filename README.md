# Football Groups

A responsive Next.js football community app with Clerk authentication and Supabase/Postgres application data.

## Live app

Production: https://football-omega-fawn.vercel.app

## Stack

- Next.js App Router with TypeScript
- Clerk for authentication only
- Supabase/Postgres for profiles, groups, matches, auctions, events, ratings, and stats
- Supabase Realtime for live match tables
- Tailwind CSS, Lucide icons, Recharts-ready dependency
- PWA manifest and installable icons

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill Clerk and Supabase values.
3. Run `supabase/schema.sql` in Supabase SQL editor.
4. Start the app with `npm run dev`.

Clerk is the login identity provider. The `users.clerk_user_id` column links each Clerk account to an internal player UUID, and all football relationships use the internal UUID.

## Git workflow

- Development workspace: `C:\Users\ARYAN M\OneDrive\Desktop\Football` on the `dev` branch.
- Production workspace: `C:\Users\ARYAN M\OneDrive\Desktop\Football-prod` on the `prod` branch.
- Commit normal changes from the development workspace, then push `dev`.
- Promote to production by merging `dev` into `prod`, running `npm run typecheck` and `npm run build`, then pushing `prod` and deploying.
