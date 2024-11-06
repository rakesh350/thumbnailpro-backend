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

milestoneRouter.all('/*', async (c, next) => {
    try{
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        if(!token) throw  new Error('Unauthorized. Token is missing');    
        const decoded = await verify(token, c.env.JWT_SECRET);
        if(!decoded) throw new Error('Unauthorized. Invalid token');
        const userId = decoded.id || '';
        c.set('userId',  userId.toString());
        await next();
    } catch(error){
        c.status(401);
        return  c.json({ error: error });
    }
});

milestoneRouter.post('/save', (c) => {
    const { videoId, milestones } = c.req.
    return c.json({message: 'User validated'});
})