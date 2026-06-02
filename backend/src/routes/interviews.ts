import { Router, Request, Response } from 'express';
import { storage } from '../services/storageService';

export const interviewsRouter = Router();

interviewsRouter.get('/', (_req: Request, res: Response): void => {
  res.json(storage.getAllInterviews());
});

interviewsRouter.get('/:id', (req: Request, res: Response): void => {
  const interview = storage.getInterview(req.params.id);
  if (!interview) {
    res.status(404).json({ error: 'Interview not found' });
    return;
  }
  res.json(interview);
});

interviewsRouter.patch('/:id', (req: Request, res: Response): void => {
  const updated = storage.updateInterview(req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Interview not found' });
    return;
  }
  res.json(updated);
});

interviewsRouter.delete('/:id', (req: Request, res: Response): void => {
  storage.deleteInterview(req.params.id);
  res.json({ success: true });
});
