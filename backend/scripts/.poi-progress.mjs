import { prisma } from '../src/lib/prisma.js'
const since = new Date(Date.now() - 2 * 60 * 60 * 1000)
const [fresh, metro, total] = await Promise.all([
  prisma.poiIndex.count({ where: { fetchedAt: { gte: since } } }),
  prisma.poiIndex.count({ where: { category: 'metro_station' } }),
  prisma.poiIndex.count(),
])
console.log(`written this run: ${fresh}  metro_station: ${metro}  total: ${total}`)
await prisma.$disconnect()
