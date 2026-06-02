import express from 'express';
import cors from 'cors';
import { analyzeRouter } from './routes/analyze';
import { interviewsRouter } from './routes/interviews';
import { insightsRouter } from './routes/insights';
import { reportRouter } from './routes/report';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/analyze', analyzeRouter);
app.use('/api/interviews', interviewsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/report', reportRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    aiMode: process.env.OPENAI_API_KEY ? 'openai' : 'mock',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  const mode = process.env.OPENAI_API_KEY ? 'OpenAI GPT-4o-mini' : 'Mock AI (set OPENAI_API_KEY for real analysis)';
  console.log(`[server] Running on http://localhost:${PORT}`);
  console.log(`[server] AI mode: ${mode}`);
});
