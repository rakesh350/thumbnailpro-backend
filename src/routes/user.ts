import { Hono } from "hono";
import { google } from "googleapis";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from '@prisma/extension-accelerate'
import { decode, verify, sign } from 'hono/jwt'


export const userRouter = new Hono<{
    Bindings: {
        DATABASE_URL: string,
        JWT_SECRET: string,
        GOOGLE_CLIENT_ID: string,
        GOOGLE_CLIENT_SECRET: string,
        GOOGLE_REDIRECT_URI: string,
        ACC_DATABASE_URL: string
    }
}>();


userRouter.get('/test', (c) => {
    return c.json({ message: 'Hello World!', text: c.env });
});

userRouter.get('/goauth', async (c) => {
    const oauth2Client = new google.auth.OAuth2(
        c.env.GOOGLE_CLIENT_ID,
        c.env.GOOGLE_CLIENT_SECRET,
        c.env.GOOGLE_REDIRECT_URI
    );

    const scopes = [
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes
    });

    return c.json({ redirect: url });
});

userRouter.get('/oauth2callback', async (c) => {
    try {
        const code = c.req.query('code') || '';
        const oauth2Client = new google.auth.OAuth2(
            c.env.GOOGLE_CLIENT_ID,
            c.env.GOOGLE_CLIENT_SECRET,
            c.env.GOOGLE_REDIRECT_URI
        );

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const guser = google.oauth2({
            auth: oauth2Client,
            version: 'v2'
        });
        const { data } = await guser.userinfo.get();

        const prisma = new PrismaClient({ datasourceUrl: c.env.ACC_DATABASE_URL }).$extends(withAccelerate());
        const user = await prisma.user.upsert({
            where: { email: data.email || ''},
            update: { name: data.name },
            create: { email: data.email || '', name: data.name  }
        });

        const yt = google.youtube({
            auth: oauth2Client,
            version: 'v3'
        });

        const channelResponse = await yt.channels.list({
            part: ['snippet', 'contentDetails', 'statistics'],
            mine: true
        });

        const channelData = channelResponse.data.items;

        if (channelData && channelData.length > 0) {
            const channel = channelData[0];
            if (channel.id && channel.snippet && channel.snippet.title && channel.snippet.thumbnails?.medium && channel.snippet.thumbnails?.medium.url) {
                const ytChannel = await prisma.youTubeChannel.upsert({
                    where: { channelId: channel.id },
                    update: { channelName: channel.snippet.title, thumbnailUrl: channel.snippet.thumbnails.medium.url },
                    create: {
                        userId: user.id,
                        channelId: channel.id,
                        channelName: channel.snippet.title,
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token,
                        thumbnailUrl: channel.snippet.thumbnails?.medium.url
                    }
                });
                const token = await sign({ id: user.id }, c.env.JWT_SECRET);
                c.status(200);
                return c.json({ token, name: data.name,  email: data.email, channel: ytChannel });
            } else {
                return c.json({ message: 'Error: unable to retrieve channel data' });
            }
        } else {
            return c.json({ message: 'Error: unable to retrieve channel data' });
        }

    } catch (error) {
        return  c.json({ message: `Error : ${error}` });
    }
});

userRouter.get('/login',  async (c) => {
    const oauth2login = new google.auth.OAuth2(
        c.env.GOOGLE_CLIENT_ID,
        c.env.GOOGLE_CLIENT_SECRET,
        c.env.GOOGLE_REDIRECT_URI
    );

    const scopes = [
        'https://www.googleapis.com/auth/userinfo.email'
    ]

    const url = oauth2login.generateAuthUrl({
        access_type: 'offline',
        scope: scopes
    });

    return c.json({ redirect: url });
});

