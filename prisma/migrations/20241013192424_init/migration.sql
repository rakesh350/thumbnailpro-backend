/*
  Warnings:

  - You are about to drop the column `thumnailUrl` on the `YouTubeChannel` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "YouTubeChannel" DROP COLUMN "thumnailUrl",
ADD COLUMN     "thumbnailUrl" TEXT NOT NULL DEFAULT 'channel-thumbnail.png';
