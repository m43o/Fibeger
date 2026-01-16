# Quick Start Guide - Vercel Deployment

## 🚀 Fast Track to Production

### Step 1: Database (5 minutes)
Choose the easiest option - **Vercel Postgres**:
1. In Vercel dashboard → Storage → Create Database → Postgres
2. Copy the `POSTGRES_PRISMA_URL` value

### Step 2: Deploy (2 minutes)
1. Push code to GitHub
2. Go to https://vercel.com → New Project
3. Import your repository
4. Add environment variables:
   ```
   DATABASE_URL=<paste your POSTGRES_PRISMA_URL>
   NEXTAUTH_SECRET=<run: openssl rand -base64 32>
   NEXTAUTH_URL=https://your-app.vercel.app
   ```
5. Click Deploy

### Step 3: Migrate Database (2 minutes)
```bash
# On your local machine
export DATABASE_URL="<your-production-database-url>"
npx prisma migrate deploy
```

### Step 4: Update NEXTAUTH_URL (1 minute)
1. Copy your Vercel URL from the deployment
2. Update `NEXTAUTH_URL` in Vercel environment variables
3. Redeploy (Deployments → ⋯ → Redeploy)

### Done! 🎉
Visit your app and test:
- Sign up for an account
- Log in
- Send a message

---

## Alternative: Using Neon (Free PostgreSQL)

### Step 1: Create Neon Database
1. Go to https://neon.tech
2. Sign up (free tier available)
3. Create a new project
4. Copy the connection string

### Step 2: Continue with Vercel
Follow steps 2-4 above, using your Neon connection string as `DATABASE_URL`

---

## Troubleshooting

### "Cannot connect to database"
- Check DATABASE_URL is correct
- Ensure database allows external connections
- Try adding `?sslmode=require` to connection string

### "Invalid NEXTAUTH_SECRET"
- Generate a new one: `openssl rand -base64 32`
- Make sure it's set in Vercel environment variables
- Redeploy after setting

### "Prisma Client not found"
- This should auto-fix with the build script
- If not, check that `postinstall` script exists in package.json

### Build fails
- Check Vercel build logs
- Ensure all environment variables are set
- Verify DATABASE_URL is accessible from Vercel

---

## Need More Help?
See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions or [VERCEL_CHECKLIST.md](./VERCEL_CHECKLIST.md) for a complete checklist.
