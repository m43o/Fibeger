/**
 * Use Production Schema for Vercel Builds
 * 
 * This script runs before building for production.
 * It copies the PostgreSQL schema over the SQLite schema
 * so that production builds use PostgreSQL.
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const productionSchemaPath = path.join(__dirname, '../prisma/schema.production.prisma');

// Only run this in production builds (Vercel sets NODE_ENV)
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  console.log('📦 Using production schema (PostgreSQL) for build...');
  
  if (fs.existsSync(productionSchemaPath)) {
    fs.copyFileSync(productionSchemaPath, schemaPath);
    console.log('✅ Production schema applied');
  } else {
    console.warn('⚠️  Production schema not found, using default');
  }
} else {
  console.log('🔧 Using local schema (SQLite) for development');
}
