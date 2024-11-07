import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { Hono } from "hono";
import { verify } from "hono/jwt";

export const milestoneRouter = new Hono<{
    Bindings: {
        DATABASE_URL: string,
        JWT_SECRET: string,
        ACC_DATABASE_URL: string
    }, Variables: {
        userId: string,
    }
}>();

interface MilestoneType {
    videoId: number,
    viewThreshold: number,
    thumbnailUrl: string
}

milestoneRouter.all('/*', async (c, next) => {
    try {
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        if (!token) throw new Error('Unauthorized. Token is missing');
        const decoded = await verify(token, c.env.JWT_SECRET);
        if (!decoded) throw new Error('Unauthorized. Invalid token');
        const userId = decoded.id || '';
        c.set('userId', userId.toString());
        await next();
    } catch (error: any) {
        c.status(401);
        return c.json({ error: error.message });
    }
});

milestoneRouter.post('/save', async (c) => {
    const body = await c.req.parseBody();
    const videoId = body['videoId'] || '';
    const milestoneArr: MilestoneType[] = [];

    try {
        const prisma = new PrismaClient({ datasourceUrl: c.env.ACC_DATABASE_URL }).$extends(withAccelerate());
        const video = await prisma.video.findUnique({ where: { videoId: videoId.toString() } });

        if (!video) {
            c.status(422);
            return c.json({ msg: 'Video not found' });
        }
        Object.keys(body).forEach((key) => {
            if (key !== 'videoId') {
                milestoneArr.push({
                    videoId: video?.id,
                    viewThreshold: Number(key),
                    thumbnailUrl: 'thumbnail.png'
                });
            }
        });

        const milestones = await prisma.milestone.createMany({
            data: milestoneArr,
            skipDuplicates: true,
        });

        return  c.json({ msg: 'Milestone saved successfully', milestones });
    } catch (error) {
        c.status(422);
        return c.json({ msg: 'Invalid video' });
    }
});