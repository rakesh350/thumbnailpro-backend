/*
  Warnings:

  - Changed the type of `youtubeChannelId` on the `Video` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Video" DROP CONSTRAINT "Video_youtubeChannelId_fkey";

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "youtubeChannelId",
ADD COLUMN     "youtubeChannelId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_youtubeChannelId_fkey" FOREIGN KEY ("youtubeChannelId") REFERENCES "YouTubeChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
