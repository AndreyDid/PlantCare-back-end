/*
  Warnings:

  - You are about to drop the column `photo` on the `user_plants` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_plants" DROP CONSTRAINT "user_plants_plantTypeId_fkey";

-- AlterTable
ALTER TABLE "user_plants" DROP COLUMN "photo",
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "plantName" TEXT,
ALTER COLUMN "plantTypeId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "user_plants_plantTypeId_idx" ON "user_plants"("plantTypeId");

-- AddForeignKey
ALTER TABLE "user_plants" ADD CONSTRAINT "user_plants_plantTypeId_fkey" FOREIGN KEY ("plantTypeId") REFERENCES "plant_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
