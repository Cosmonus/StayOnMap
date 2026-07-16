// Prisma singleton — prevents multiple instances in dev (hot reload)
// Prisma 7 removed schema-level `url = env(...)` — the client now connects
// via an explicit driver adapter instead (prisma.config.ts covers Migrate/
// introspection separately).
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
