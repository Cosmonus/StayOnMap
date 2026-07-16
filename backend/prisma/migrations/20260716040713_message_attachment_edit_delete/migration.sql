-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentUrl" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3);
