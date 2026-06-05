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

    const allPainPoints = [...new Set(interviews.flatMap(iv => iv.aiResult!.painPoints))];
    const allQuotes     = [...new Set(interviews.flatMap(iv => iv.aiResult!.keyQuotes))];
    const allThemes     = [...new Set(interviews.flatMap(iv => iv.aiResult!.mainThemes))];

    const raw = await generateProblems({ painPoints: allPainPoints, keyQuotes: allQuotes, mainThemes: allThemes });

    const now = new Date().toISOString();
    const analysis = storage.saveProblemsAnalysis({
      id:           uuidv4(),
      rootProblem:  raw.rootProblem ?? 'Core problems identified from research findings.',
      problems:     (raw.problems ?? []).map((p, i) => ({
        id:            `prob-${uuidv4().slice(0, 8)}`,
        title:         p.title         ?? `Problem ${i + 1}`,
        description:   p.description   ?? '',
        severity:      (p.severity     as Problem['severity']) ?? 'moderate',
        affectedRoles: p.affectedRoles ?? [],
        frequency:     (p.frequency    as Problem['frequency']) ?? 'per_sprint',
        evidenceQuotes: p.evidenceQuotes ?? [],
        parentId:      p.parentId      ?? '',
        createdAt:     now
      })),
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
