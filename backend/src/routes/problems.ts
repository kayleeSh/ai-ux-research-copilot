import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../services/storageService';
import { generateProblems } from '../services/aiService';
import { Problem } from '../types';

export const problemsRouter = Router();

problemsRouter.get('/', (_req: Request, res: Response): void => {
  const analysis = storage.getProblemsAnalysis();
  if (!analysis) { res.status(404).json({ error: 'No problems analysis yet' }); return; }
  res.json(analysis);
});

problemsRouter.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const interviews = storage.getAllInterviews().filter(iv => !!iv.aiResult);
    if (interviews.length === 0) {
      res.status(400).json({ error: 'No analyzed interviews found. Upload and analyze interviews first.' });
      return;
    }

    const titleToId = new Map(interviews.map(iv => [iv.title, iv.id]));

    const raw = await generateProblems({
      interviews: interviews.map(iv => ({
        title:      iv.title,
        painPoints: iv.aiResult!.painPoints,
        keyQuotes:  iv.aiResult!.keyQuotes,
        mainThemes: iv.aiResult!.mainThemes
      }))
    });

    const now = new Date().toISOString();
    const analysis = storage.saveProblemsAnalysis({
      id:           uuidv4(),
      rootProblem:  raw.rootProblem ?? 'Core problems identified from research findings.',
      problems:     (raw.problems ?? []).map((p, i) => {
        const sourceTitles = p.sourceInterviewTitles ?? [];
        return {
          id:            `prob-${uuidv4().slice(0, 8)}`,
          title:         p.title         ?? `Problem ${i + 1}`,
          description:   p.description   ?? '',
          severity:      (p.severity     as Problem['severity']) ?? 'moderate',
          affectedRoles: p.affectedRoles ?? [],
          frequency:     (p.frequency    as Problem['frequency']) ?? 'per_sprint',
          evidenceQuotes: p.evidenceQuotes ?? [],
          parentId:      p.parentId      ?? '',
          sourceInterviewIds:    sourceTitles.map(t => titleToId.get(t) ?? '').filter(Boolean),
          sourceInterviewTitles: sourceTitles,
          status:        'unresolved' as const,
          createdAt:     now
        };
      }),
      interviewCount: interviews.length,
      generatedAt:    now
    });

    res.json(analysis);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    console.error('[problems generate error]', message);
    res.status(500).json({ error: message });
  }
});

problemsRouter.patch('/:id/status', (req: Request, res: Response): void => {
  const analysis = storage.getProblemsAnalysis();
  if (!analysis) { res.status(404).json({ error: 'No analysis found' }); return; }

  const { status } = req.body as { status: Problem['status'] };
  const target = analysis.problems.find(p => p.id === req.params.id);
  if (!target) { res.status(404).json({ error: 'Problem not found' }); return; }

  const updated = storage.saveProblemsAnalysis({
    ...analysis,
    problems: analysis.problems.map(p =>
      p.id === req.params.id ? { ...p, status } : p
    )
  });
  res.json(updated.problems.find(p => p.id === req.params.id));
});
