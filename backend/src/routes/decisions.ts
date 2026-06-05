import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../services/storageService';
import { generateDecisions, generateDecisionsFromSynthesis } from '../services/aiService';
import { Decision, Interview } from '../types';

export const decisionsRouter = Router();

decisionsRouter.get('/', (_req: Request, res: Response): void => {
  res.json(storage.getAllDecisions());
});

decisionsRouter.post('/', (req: Request, res: Response): void => {
  const body = req.body as Partial<Decision>;
  const initialStatus = body.status ?? 'under_discussion';
  const decision: Decision = {
    id:                   uuidv4(),
    title:                body.title                ?? 'Untitled Decision',
    status:               initialStatus,
    priority:             body.priority             ?? 'medium',
    note:                 body.note                 ?? '',
    owner:                body.owner                ?? '',
    dueDate:              body.dueDate              ?? '',
    evidenceQuotes:       body.evidenceQuotes       ?? [],
    sourceType:           body.sourceType           ?? 'manual',
    sourceInterviewId:    body.sourceInterviewId    ?? '',
    sourceInterviewTitle: body.sourceInterviewTitle ?? '',
    sourceInsightId:      body.sourceInsightId      ?? '',
    sourceProblemId:      body.sourceProblemId      ?? '',
    sourceProblemTitle:   body.sourceProblemTitle   ?? '',
    statusHistory:        [{ status: initialStatus, changedAt: new Date().toISOString() }],
    createdAt:            new Date().toISOString(),
    updatedAt:            new Date().toISOString()
  };
  storage.saveDecision(decision);
  res.json(decision);
});

// POST /generate — from selected interview IDs
decisionsRouter.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { interviewIds } = req.body as { interviewIds?: string[] };
    if (!interviewIds || interviewIds.length === 0) {
      res.status(400).json({ error: 'At least one interview ID required' });
      return;
    }

    const interviews = interviewIds
      .map(id => storage.getInterview(id))
      .filter((iv): iv is Interview => !!iv && !!iv.aiResult);

    if (interviews.length === 0) {
      res.status(400).json({ error: 'No analyzed interviews found for the given IDs' });
      return;
    }

    const interviewData = interviews.map(iv => ({
      title:      iv.title,
      painPoints: iv.aiResult!.painPoints,
      keyQuotes:  iv.aiResult!.keyQuotes,
      mainThemes: iv.aiResult!.mainThemes
    }));

    const raw = await generateDecisions(interviewData);

    const sourceInterviewId    = interviews.length === 1 ? interviews[0].id : '';
    const sourceInterviewTitle = interviews.length === 1
      ? interviews[0].title
      : `${interviews.length} Interviews`;

    const now = new Date().toISOString();
    const created: Decision[] = raw.map(d => ({
      id:                   uuidv4(),
      title:                d.title         ?? 'Untitled Decision',
      status:               'under_discussion' as const,
      priority:             (d.priority as Decision['priority']) ?? 'medium',
      note:                 d.note          ?? '',
      owner:                '',
      dueDate:              '',
      evidenceQuotes:       d.evidenceQuotes ?? [],
      sourceType:           'ai_generated' as const,
      sourceInterviewId,
      sourceInterviewTitle,
      sourceInsightId:      '',
      statusHistory:        [{ status: 'under_discussion', changedAt: now }],
      createdAt:            now,
      updatedAt:            now
    }));

    created.forEach(d => storage.saveDecision(d));
    res.json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    console.error('[decisions generate error]', message);
    res.status(500).json({ error: message });
  }
});

// POST /generate-from-synthesis — from synthesis recommendations
decisionsRouter.post('/generate-from-synthesis', async (req: Request, res: Response): Promise<void> => {
  try {
    const { recommendations, prioritizedPainPoints, commonThemes } = req.body as {
      recommendations?: string[];
      prioritizedPainPoints?: string[];
      commonThemes?: string[];
    };

    if (!recommendations || recommendations.length === 0) {
      res.status(400).json({ error: 'recommendations array is required' });
      return;
    }

    const raw = await generateDecisionsFromSynthesis({
      recommendations,
      prioritizedPainPoints: prioritizedPainPoints ?? [],
      commonThemes:          commonThemes          ?? []
    });

    const now = new Date().toISOString();
    const created: Decision[] = raw.map(d => ({
      id:                   uuidv4(),
      title:                d.title         ?? 'Untitled Decision',
      status:               'under_discussion' as const,
      priority:             (d.priority as Decision['priority']) ?? 'medium',
      note:                 d.note          ?? '',
      owner:                '',
      dueDate:              '',
      evidenceQuotes:       d.evidenceQuotes ?? [],
      sourceType:           'ai_generated' as const,
      sourceInterviewId:    '',
      sourceInterviewTitle: 'Cross-Interview Synthesis',
      sourceInsightId:      '',
      statusHistory:        [{ status: 'under_discussion', changedAt: now }],
      createdAt:            now,
      updatedAt:            now
    }));

    created.forEach(d => storage.saveDecision(d));
    res.json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    console.error('[decisions generate-from-synthesis error]', message);
    res.status(500).json({ error: message });
  }
});

decisionsRouter.patch('/:id', (req: Request, res: Response): void => {
  const updated = storage.updateDecision(req.params.id, req.body as Partial<Decision>);
  if (!updated) {
    res.status(404).json({ error: 'Decision not found' });
    return;
  }
  res.json(updated);
});

decisionsRouter.delete('/:id', (req: Request, res: Response): void => {
  const deleted = storage.deleteDecision(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Decision not found' });
    return;
  }
  res.json({ success: true });
});
