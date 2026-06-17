import { Router, Request, Response } from 'express';
import { getTokenStatus } from '../services/storageService';

export const statusRouter = Router();

statusRouter.get('/token-status', (_req: Request, res: Response): void => {
  res.json(getTokenStatus());
});
