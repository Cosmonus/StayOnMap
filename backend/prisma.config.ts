// Prisma 7 no longer auto-loads .env the way 6 did, and this config resolves
// env('DATABASE_URL') eagerly — without this import every CLI command
// (migrate dev, studio, generate) fails locally with PrismaConfigEnvError.
// Production is unaffected (systemd's EnvironmentFile injects DATABASE_URL as a
// real env var), which is why this only bites local development.
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
