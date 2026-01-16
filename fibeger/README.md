# Fibeger

A modern social networking and messaging platform built with Next.js, Prisma, and NextAuth.

## Features

- User authentication and authorization
- Friend requests and friend management
- Direct messaging (1-on-1 conversations)
- Group chats
- User profiles with avatars and bios
- Username history tracking
- Feed and social features

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (production) / SQLite (development)
- **ORM**: Prisma
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **Password Hashing**: bcryptjs

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database (for production) or SQLite (for local development)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd fibeger
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy the example env file
cp env.example .env

# Edit .env and add your values
```

Required environment variables:
- `DATABASE_URL`: Your database connection string
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL`: Your app URL (http://localhost:3000 for local dev)

4. Set up the database:
```bash
# Run migrations
npx prisma migrate dev

# Or push the schema (for development)
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database

### Local Development (SQLite)
For local development, you can use SQLite:
```env
DATABASE_URL="file:./prisma/dev.db"
```

### Production (PostgreSQL)
For production deployment, use PostgreSQL:
```env
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on deploying to Vercel.

### Quick Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Set up a PostgreSQL database (Vercel Postgres, Neon, Supabase, etc.)
4. Add environment variables in Vercel:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
5. Deploy!

## Project Structure

```
fibeger/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── conversations/# Messaging endpoints
│   │   ├── friends/      # Friend management
│   │   ├── groupchats/   # Group chat endpoints
│   │   └── profile/      # User profile endpoints
│   ├── auth/             # Auth pages (login, signup)
│   ├── components/       # React components
│   ├── context/          # React context providers
│   ├── lib/              # Utility libraries
│   └── [pages]/          # App pages
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
└── public/               # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Accessibility

This project follows WCAG 2.1 Level AA guidelines. See [ACCESSIBILITY.md](./ACCESSIBILITY.md) and [WCAG_CHANGES.md](./WCAG_CHANGES.md) for more information.

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## License

[Your License Here]
