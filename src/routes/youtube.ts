import { Hono } from "hono";
import { google } from "googleapis";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from '@prisma/extension-accelerate'
import { decode, verify, sign, jwt } from 'hono/jwt'


export const youtubeRouter = new Hono<{
    Bindings: {
        DATABASE_URL: string,
        JWT_SECRET: string,
        GOOGLE_CLIENT_ID: string,
        GOOGLE_CLIENT_SECRET: string,
        GOOGLE_REDIRECT_URI: string,
        ACC_DATABASE_URL: string
    }, Variables: {
        userId: string,
        refreshToken: string
    }
}>();

interface VideoType {
    youtubeChannelId: number;
    videoId: string;
    title: string;
    thumbnailUrl: string;
}

// Create a middleware to validate and set userID
youtubeRouter.use('/*', async (c, next) => {
    const authHeader = c.req.header('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
        c.status(401);
        c.json({ error: 'Unauthorized' });
    }

    try {
        const response = await verify(token, c.env.JWT_SECRET);
        if (!response) {
            c.status(401);
            return c.json({ error: 'Unauthorized' });
        }
        const userId = response.id || 0;
        console.log(`LOG|INFO| Decoded user id : ${userId}`);
        c.set("userId", userId.toString());


        const prisma = new PrismaClient({ datasourceUrl: c.env.ACC_DATABASE_URL }).$extends(withAccelerate());
        const youTubeChannel = await prisma.youTubeChannel.findFirst({ where: { userId: userId } });

        if (!youTubeChannel || !youTubeChannel.refreshToken) {
            c.status(404);
            return c.json({ error: 'Unauthorized' });
        }
        c.set("refreshToken", youTubeChannel.refreshToken);
        await next();

    } catch (error) {
        c.status(401);
        return c.json({ error: 'Unauthorized' })
    }
});


// Create a route to fetch the list of youtube videos from channel
youtubeRouter.get('/videos/:channelId', async (c) => {
    try {
        const prisma = new PrismaClient({ datasourceUrl: c.env.ACC_DATABASE_URL }).$extends(withAccelerate());
        const refreshToken = c.get('refreshToken');
        const userId = c.get('userId');
        console.log(`INFO|refresh token-${refreshToken}`);
        console.log(`INFO|user id-${userId}`);
        const channelId = await c.req.param('channelId');

        const ytChannelData = await prisma.youTubeChannel.findFirst({ where: { id: Number(channelId)}});
        if (!ytChannelData) { 
            c.status(404);
            return c.json({ error: 'Channel not found' });
        }

        // set the google auth
        const oauth2Client = new google.auth.OAuth2(
            c.env.GOOGLE_CLIENT_ID,
            c.env.GOOGLE_CLIENT_SECRET,
            c.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const youtube = google.youtube({
            version: 'v3',
            auth: oauth2Client
        });

        const channelResponse = await youtube.channels.list({
            part: ['contentDetails'],
            id: [ytChannelData.channelId],
        });

        const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (!uploadsPlaylistId) throw new Error('Uploads playlist not found');

        const videoResponse = await youtube.playlistItems.list({
            part: ['snippet', 'contentDetails'],
            playlistId: uploadsPlaylistId,
            maxResults: 50, 
        });
     
        const videosList: VideoType[] = videoResponse.data.items?.map((item) => ({
            youtubeChannelId: Number(channelId),
            title: item.snippet?.title || '',
            videoId: item.contentDetails?.videoId || '',
            thumbnailUrl: item.snippet?.thumbnails?.medium?.url || '',
        })) ?? [];

        const res = await prisma.video.createMany({
            data: videosList,
            skipDuplicates: true, 
        });

        return c.json({ 'count': res?.count, videos: videosList });
    } catch (error) {
        c.status(401);
        return c.json({ error: error });
    }
});



// Create a route to get the channel information from database
youtubeRouter.get('/channel', async (c) => {
    try {
        const userId = c.get('userId') || '';
        console.log(`LOG|INFO|${userId}`);
        const prisma = new PrismaClient({ datasourceUrl: c.env.ACC_DATABASE_URL }).$extends(withAccelerate());
        const channelData = await prisma.youTubeChannel.findMany({ where: { userId: Number(userId) } });
        return c.json({ 'channel': channelData });
    } catch (error) {
        c.status(422);
        return c.json({ error: error });
    }
});

// Get the list of videos from using channel id