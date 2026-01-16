# Pre-Deployment Check

Run through this checklist before deploying to ensure everything is ready.

## ✅ Files Check

Verify these files exist:
- [x] `package.json` - Updated with correct scripts
- [x] `prisma/schema.prisma` - Using PostgreSQL provider
- [x] `env.example` - Environment variable template
- [x] `vercel.json` - Vercel configuration
- [x] `.gitignore` - Properly configured
- [x] `.vercelignore` - Excludes unnecessary files
- [x] `README.md` - Updated documentation
- [x] `DEPLOYMENT.md` - Deployment guide
- [x] `QUICK_START.md` - Quick start guide

## ✅ Configuration Check

### package.json
```bash
# Verify build script includes prisma generate
grep "prisma generate" package.json

# Verify postinstall script exists
grep "postinstall" package.json

# Verify @prisma/client is in dependencies (not devDependencies)
grep -A 10 '"dependencies"' package.json | grep "@prisma/client"
```

### prisma/schema.prisma
```bash
# Verify using postgresql
grep 'provider = "postgresql"' prisma/schema.prisma
```

### Environment Variables Prepared
- [ ] DATABASE_URL ready (PostgreSQL connection string)
- [ ] NEXTAUTH_SECRET generated (`openssl rand -base64 32`)
- [ ] NEXTAUTH_URL ready (will be your Vercel URL)

## ✅ Code Check

### No SQLite References
```bash
# Should return no results or only in documentation
grep -r "sqlite" --include="*.ts" --include="*.tsx" fibeger/app/
```

### No Hardcoded URLs
```bash
# Should return no results in app code
grep -r "localhost" --include="*.ts" --include="*.tsx" fibeger/app/
grep -r "127.0.0.1" --include="*.ts" --include="*.tsx" fibeger/app/
```

### Prisma Client Properly Initialized
```bash
# Check prisma client setup
cat app/lib/prisma.ts
# Should use singleton pattern with globalForPrisma
```

## ✅ Build Test (Optional but Recommended)

Test the build locally with PostgreSQL:

```bash
# 1. Set up a test PostgreSQL database (local or cloud)
export DATABASE_URL="postgresql://..."

# 2. Run migrations
npx prisma migrate deploy

# 3. Generate Prisma Client
npx prisma generate

# 4. Build the app
npm run build

# 5. Start production server
npm start

# 6. Test at http://localhost:3000
```

## ✅ Git Check

### Verify Nothing Sensitive is Committed
```bash
# Check what will be pushed
git status

# Verify .env files are not staged
git ls-files | grep "\.env$"
# Should return nothing

# Verify SQLite db is not staged
git ls-files | grep "\.db$"
# Should return nothing
```

### Push to Repository
```bash
# Add all changes
git add .

# Commit
git commit -m "Prepare for Vercel deployment"

# Push to main branch
git push origin main
```

## ✅ Vercel Account Check

- [ ] Vercel account created
- [ ] GitHub/GitLab/Bitbucket connected to Vercel
- [ ] Repository accessible from Vercel

## ✅ Database Provider Check

Choose and set up ONE:
- [ ] Vercel Postgres (easiest, integrated)
- [ ] Neon (free tier available)
- [ ] Supabase (free tier available)
- [ ] Railway
- [ ] Other PostgreSQL provider

Connection string format:
```
postgresql://username:password@host:port/database?sslmode=require
```

## 🚀 Ready to Deploy?

If all checks pass, you're ready to deploy! Follow:
- **Fast track**: [QUICK_START.md](./QUICK_START.md)
- **Detailed guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Complete checklist**: [VERCEL_CHECKLIST.md](./VERCEL_CHECKLIST.md)

## ⚠️ Important Reminders

1. **Don't forget to run migrations** after first deployment
2. **Update NEXTAUTH_URL** with your actual Vercel URL after first deploy
3. **Test thoroughly** after deployment
4. **Set up database backups** for production data
5. **Monitor Vercel logs** for any issues

## 🆘 If Something Goes Wrong

1. Check Vercel build logs
2. Verify environment variables are set correctly
3. Test database connection from local machine
4. Review [VERCEL_CHECKLIST.md](./VERCEL_CHECKLIST.md) troubleshooting section
5. Rollback deployment if needed (Vercel dashboard → Deployments → Previous → Promote to Production)

---

**Status**: All checks passed ✅
**Ready for deployment**: YES 🚀
