import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { userRouter } from './routes/user';
import { youtubeRouter } from './routes/youtube';
import { milestoneRouter } from './routes/milstone';

const app = new Hono<{
  Bindings: {
      DATABASE_URL: string,
      JWT_SECRET: string
  }
}>();

app.use('/*', cors());
app.route('api/v1/user', userRouter);
app.route('api/v1/youtube', youtubeRouter);
app.route('api/v1/milestone', milestoneRouter);

export default app
