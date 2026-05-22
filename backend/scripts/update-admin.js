import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const hash = await bcrypt.hash('sgokulk@1234', 12)

await prisma.admin.deleteMany({ where: { email: 'admin@stayonmap.in' } })
await prisma.admin.upsert({
  where:  { email: 'srigokulkrishnan@gmail.com' },
  update: { passwordHash: hash, name: 'StayOnMap Admin' },
  create: { email: 'srigokulkrishnan@gmail.com', passwordHash: hash, name: 'StayOnMap Admin' },
})
console.log('Done: srigokulkrishnan@gmail.com / sgokulk@1234')
await prisma.$disconnect()
