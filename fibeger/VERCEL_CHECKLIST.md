# Vercel Deployment Checklist

Use this checklist to ensure your deployment goes smoothly.

## Pre-Deployment Checklist

### 1. Database Setup
- [ ] Set up a PostgreSQL database (choose one):
  - [ ] Vercel Postgres
  - [ ] Neon (https://neon.tech)
  - [ ] Supabase (https://supabase.com)
  - [ ] Railway (https://railway.app)
  - [ ] Other PostgreSQL provider
- [ ] Copy the connection string (DATABASE_URL)
- [ ] Test the connection locally (optional)

### 2. Environment Variables
- [ ] Generate NEXTAUTH_SECRET: `openssl rand -base64 32`
- [ ] Prepare these environment variables:
  ```
  DATABASE_URL=postgresql://...
  NEXTAUTH_SECRET=your-generated-secret
  NEXTAUTH_URL=https://your-app.vercel.app (will be provided after first deploy)
  ```

### 3. Code Repository
- [ ] Push all code to GitHub/GitLab/Bitbucket
- [ ] Ensure `.gitignore` excludes:
  - [ ] `.env` files
  - [ ] `node_modules/`
  - [ ] `.next/`
  - [ ] `prisma/dev.db` (SQLite file)

### 4. Dependencies
- [ ] Run `npm install` to ensure package-lock.json is up to date
- [ ] Verify all dependencies are in package.json
- [ ] Check that build script includes Prisma generation

## Deployment Steps

### 1. Import Project to Vercel
- [ ] Go to https://vercel.com
- [ ] Click "New Project"
- [ ] Import your repository
- [ ] Select the `fibeger` directory as the root (if needed)

### 2. Configure Environment Variables
In Vercel project settings, add:
- [ ] `DATABASE_URL` (your PostgreSQL connection string)
- [ ] `NEXTAUTH_SECRET` (generated secret)
- [ ] `NEXTAUTH_URL` (leave blank for now, will update after first deploy)

### 3. Deploy
- [ ] Click "Deploy"
- [ ] Wait for build to complete
- [ ] Note any build errors

### 4. Post-Deployment Configuration
- [ ] Copy your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
- [ ] Update `NEXTAUTH_URL` environment variable with this URL
- [ ] Redeploy to apply the change

### 5. Database Migration
Choose one method:

#### Method A: From Local Machine
```bash
# Set production DATABASE_URL
export DATABASE_URL="your-production-database-url"

# Run migrations
npx prisma migrate deploy
```

#### Method B: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Run command in Vercel environment
vercel env pull .env.production
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

#### Method C: Add to Build Script (Not Recommended for Production)
Only use this if you understand the risks of running migrations during build.

### 6. Verify Deployment
- [ ] Visit your deployed URL
- [ ] Test signup functionality
- [ ] Test login functionality
- [ ] Test creating a conversation
- [ ] Test sending messages
- [ ] Test friend requests
- [ ] Check browser console for errors
- [ ] Check Vercel logs for any issues

## Common Issues & Solutions

### Build Fails with "Cannot find module '@prisma/client'"
**Solution**: Ensure `postinstall` script runs `prisma generate`
```json
"scripts": {
  "postinstall": "prisma generate"
}
```

### Database Connection Timeout
**Solutions**:
- Check if DATABASE_URL is correct
- Verify database allows connections from Vercel IPs
- Add `?connection_limit=1` to DATABASE_URL for serverless
- Try adding `?connect_timeout=30` to connection string

### NextAuth Session Issues
**Solutions**:
- Ensure NEXTAUTH_SECRET is set in production
- Verify NEXTAUTH_URL matches your actual domain
- Check that cookies are not blocked
- Clear browser cookies and try again

### Prisma Client Out of Sync
**Solution**: Ensure build script generates Prisma client:
```json
"scripts": {
  "build": "prisma generate && next build"
}
```

### Migration Errors
**Solutions**:
- Run `npx prisma migrate reset` on production DB (⚠️ destroys data)
- Or use `npx prisma db push` to sync schema without migrations
- Check that PostgreSQL version is compatible

## Performance Optimization

### After Successful Deployment
- [ ] Enable Vercel Analytics
- [ ] Set up error monitoring (Sentry)
- [ ] Configure database connection pooling
- [ ] Add database indexes for common queries
- [ ] Set up automated backups
- [ ] Configure CDN for static assets

### Database Optimization for Serverless
Add to your DATABASE_URL:
```
?connection_limit=1&pool_timeout=0
```

Example:
```
postgresql://user:pass@host:5432/db?connection_limit=1&pool_timeout=0
```

## Custom Domain Setup (Optional)

- [ ] Go to Vercel project settings → Domains
- [ ] Add your custom domain
- [ ] Update DNS records as instructed
- [ ] Wait for DNS propagation (can take up to 48 hours)
- [ ] Update NEXTAUTH_URL to your custom domain
- [ ] Redeploy

## Monitoring & Maintenance

### Regular Tasks
- [ ] Monitor Vercel deployment logs
- [ ] Check database usage and performance
- [ ] Review error logs
- [ ] Set up uptime monitoring
- [ ] Configure backup strategy
- [ ] Plan for database scaling

### Recommended Tools
- **Monitoring**: Vercel Analytics, Sentry, LogRocket
- **Database**: Prisma Studio, pgAdmin
- **Uptime**: UptimeRobot, Pingdom
- **Performance**: Lighthouse, WebPageTest

## Rollback Plan

If something goes wrong:
1. [ ] Revert to previous deployment in Vercel dashboard
2. [ ] Check environment variables haven't changed
3. [ ] Verify database is still accessible
4. [ ] Review recent code changes
5. [ ] Check Vercel function logs for errors

## Support Resources

- Vercel Documentation: https://vercel.com/docs
- Prisma Documentation: https://www.prisma.io/docs
- NextAuth Documentation: https://next-auth.js.org
- Vercel Community: https://github.com/vercel/vercel/discussions

---

**Last Updated**: January 2026
**Status**: Ready for deployment ✅
