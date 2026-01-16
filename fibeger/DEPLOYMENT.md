# Deployment Guide for Vercel

This guide will help you deploy Fibeger to Vercel.

## Prerequisites

1. A [Vercel](https://vercel.com) account
2. A PostgreSQL database (Vercel Postgres, Neon, Supabase, Railway, etc.)

## Steps to Deploy

### 1. Set Up PostgreSQL Database

You can use any of these options:

#### Option A: Vercel Postgres (Recommended)
1. Go to your Vercel dashboard
2. Navigate to Storage → Create Database → Postgres
3. Copy the `DATABASE_URL` connection string

#### Option B: Neon (Free Tier Available)
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string

#### Option C: Supabase
1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → Database and copy the connection string

### 2. Deploy to Vercel

#### Via Vercel Dashboard:

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com) and click "New Project"
3. Import your repository
4. Add the following environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL`: Your production URL (e.g., `https://your-app.vercel.app`)
5. Click "Deploy"

#### Via Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Set environment variables
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL

# Deploy to production
vercel --prod
```

### 3. Run Database Migrations

After deploying, you need to run Prisma migrations on your production database:

```bash
# Set the production DATABASE_URL locally
export DATABASE_URL="your-production-database-url"

# Run migrations
npx prisma migrate deploy

# Or if you need to push the schema without migrations
npx prisma db push
```

Alternatively, you can add a migration command in your Vercel build process by modifying `package.json`:

```json
{
  "scripts": {
    "build": "prisma migrate deploy && prisma generate && next build"
  }
}
```

**Note**: Be careful with `prisma migrate deploy` in build scripts as it can cause issues if multiple builds run simultaneously.

### 4. Verify Deployment

1. Visit your deployed URL
2. Try to sign up for a new account
3. Test login functionality
4. Verify all features work correctly

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | Secret for NextAuth.js sessions | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Full URL of your application | `https://your-app.vercel.app` |

## Troubleshooting

### Build Failures

If the build fails with Prisma errors:
1. Make sure `DATABASE_URL` is set correctly
2. Verify the database is accessible from Vercel
3. Check that the schema is valid for PostgreSQL

### Database Connection Issues

- Ensure your database allows connections from Vercel's IP addresses
- Check if your database requires SSL (add `?sslmode=require` to connection string if needed)
- Verify the connection string format is correct

### NextAuth Issues

- Make sure `NEXTAUTH_SECRET` is set in production
- Verify `NEXTAUTH_URL` matches your actual domain
- Check that cookies are working correctly (some ad blockers can interfere)

## Post-Deployment

### Enable Vercel Analytics (Optional)
Add Vercel Analytics to track your app's performance:

```bash
npm install @vercel/analytics
```

Then add to your `app/layout.tsx`:

```tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Set Up Domain (Optional)
1. Go to your project settings in Vercel
2. Navigate to Domains
3. Add your custom domain
4. Update `NEXTAUTH_URL` environment variable with your custom domain

## Continuous Deployment

Vercel automatically deploys:
- **Production**: When you push to your main/master branch
- **Preview**: When you create a pull request or push to other branches

Each preview deployment gets its own URL for testing.

## Database Backups

Make sure to set up regular backups for your production database:
- Vercel Postgres: Automatic backups included
- Neon: Automatic backups available
- Supabase: Automatic backups included

## Monitoring

Consider adding monitoring tools:
- Vercel Analytics for performance
- Sentry for error tracking
- LogRocket for session replay
