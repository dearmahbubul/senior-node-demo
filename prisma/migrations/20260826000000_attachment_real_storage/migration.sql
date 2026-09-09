-- AlterTable
ALTER TABLE "TaskAttachment" DROP COLUMN "fileUrl",
ADD COLUMN     "storageKey" TEXT NOT NULL,
ADD COLUMN     "uploadedById" TEXT NOT NULL,
ALTER COLUMN "mimeType" SET NOT NULL,
ALTER COLUMN "fileSize" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TaskAttachment_storageKey_key" ON "TaskAttachment"("storageKey");

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
