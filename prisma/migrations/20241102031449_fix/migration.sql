-- DropForeignKey
ALTER TABLE "Video" DROP CONSTRAINT "Video_youtubeChannelId_fkey";

-- AlterTable
ALTER TABLE "Video" ALTER COLUMN "youtubeChannelId" SET DATA TYPE TEXT,
ALTER COLUMN "currentViewCount" SET DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_youtubeChannelId_fkey" FOREIGN KEY ("youtubeChannelId") REFERENCES "YouTubeChannel"("channelId") ON DELETE RESTRICT ON UPDATE CASCADE;
