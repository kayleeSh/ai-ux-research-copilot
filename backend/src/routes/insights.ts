import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../services/storageService';
import { Insight } from '../types';

export const insightsRouter = Router();

insightsRouter.get('/', (_req: Request, res: Response): void => {
  res.json(storage.getAllInsights());
});

insightsRouter.get('/interview/:interviewId', (req: Request, res: Response): void => {
  res.json(storage.getInsightsByInterview(req.params.interviewId));
});

insightsRouter.post('/', (req: Request, res: Response): void => {
  const body = req.body as {
    interviewId: string;
    content: string;
    type?: Insight['type'];
    clusterId?: string;
  };

  const insight: Insight = {
    id: uuidv4(),
    interviewId: body.interviewId,
    content: body.content,
    type: body.type ?? 'theme',
    status: 'pending',
    clusterId: body.clusterId,
    createdAt: new Date().toISOString()
  };

  storage.saveInsight(insight);
  res.json(insight);
});

insightsRouter.patch('/:id', (req: Request, res: Response): void => {
  const updated = storage.updateInsight(req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Insight not found' });
    return;
  }
  res.json(updated);
});
