import 'dotenv/config'; // loads .env into process.env before anything else
import express from 'express';
import cors from 'cors';
import { analyzeRouter } from './routes/analyze';
import { interviewsRouter } from './routes/interviews';
import { insightsRouter } from './routes/insights';
import { reportRouter } from './routes/report';
import { decisionsRouter } from './routes/decisions';
import { problemsRouter } from './routes/problems';
import { briefingRouter } from './routes/briefing';
import { statusRouter } from './routes/status';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/analyze', analyzeRouter);
app.use('/api/interviews', interviewsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/report', reportRouter);
app.use('/api/decisions', decisionsRouter);
app.use('/api/problems', problemsRouter);
app.use('/api/briefing', briefingRouter);
app.use('/api', statusRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    aiMode: process.env.GROQ_API_KEY ? 'groq' : 'mock', // [UPDATED] was: GEMINI_API_KEY ? 'gemini' : 'mock'
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  // [UPDATED] was: GEMINI_API_KEY ? 'Google Gemini 1.5 Flash' : 'Mock AI (set GEMINI_API_KEY for real analysis)'
  const mode = process.env.GROQ_API_KEY ? 'Groq llama-3.1-8b-instant' : 'Mock AI (set GROQ_API_KEY for real analysis)';
  console.log(`[server] Running on http://localhost:${PORT}`);
  console.log(`[server] AI mode: ${mode}`);
});
