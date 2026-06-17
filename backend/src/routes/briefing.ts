import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../services/storageService';
import { generateBriefing } from '../services/aiService';

export const briefingRouter = Router();

briefingRouter.get('/', (_req: Request, res: Response): void => {
  const briefing = storage.getBriefing();
  res.json(briefing ?? null);
});

briefingRouter.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const analysis = storage.getProblemsAnalysis();
    if (!analysis) {
      res.status(400).json({ error: 'Generate a problem analysis first before creating a briefing.' });
      return;
    }

    const interviews    = storage.getAllInterviews().filter(iv => !!iv.aiResult);
    const decisions     = storage.getAllDecisions();
    const allPainPoints = [...new Set(interviews.flatMap(iv => iv.aiResult!.painPoints))];
    const allThemes     = [...new Set(interviews.flatMap(iv => iv.aiResult!.mainThemes))];
    const decisionTitles = decisions.map(d => d.title);

    const raw = await generateBriefing({
      rootProblem:    analysis.rootProblem,
      problems:       analysis.problems.map(p => ({ title: p.title, description: p.description })),
      painPoints:     allPainPoints,
      mainThemes:     allThemes,
      decisionTitles,
      interviewCount: interviews.length
    });

    const def = <T>(val: T | undefined, fallback: T): T => val ?? fallback;

    const briefing = storage.saveBriefing({
      id:             uuidv4(),
      confidence:     (raw.confidence as 'high' | 'medium' | 'low') ?? 'medium',
      problemCount:   analysis.problems.length,
      interviewCount: interviews.length,
      pm: {
        objectives:          def(raw.pm?.objectives, []),
        okrs:                def(raw.pm?.okrs, []),
        priorityStackRank:   def(raw.pm?.priorityStackRank, []),
        assumptionsAndRisks: def(raw.pm?.assumptionsAndRisks, []),
        methodsAndTools:     def(raw.pm?.methodsAndTools, [])
      },
      designer: {
        userNeeds:       def(raw.designer?.userNeeds, []),
        jobsToBeDone:    def(raw.designer?.jobsToBeDone, []),
        designPrinciples: def(raw.designer?.designPrinciples, []),
        deliverables:    def(raw.designer?.deliverables, []),
        successCriteria: def(raw.designer?.successCriteria, [])
      },
      developer: {
        deliverables:          def(raw.developer?.deliverables, []),
        acceptanceCriteria:    def(raw.developer?.acceptanceCriteria, []),
        technicalConstraints:  def(raw.developer?.technicalConstraints, []),
        dependencies:          def(raw.developer?.dependencies, []),
        nonGoals:              def(raw.developer?.nonGoals, [])
      },
      projectManager: {
        deliverables:    def(raw.projectManager?.deliverables, []),
        milestones:      def(raw.projectManager?.milestones, []),
        dependenciesMap: def(raw.projectManager?.dependenciesMap, []),
        effortEstimates: def(raw.projectManager?.effortEstimates, []),
        openQuestions:   def(raw.projectManager?.openQuestions, [])
      },
      generatedAt: new Date().toISOString()
    });

    res.json(briefing);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    console.error('[briefing generate error]', message);
    res.status(500).json({ error: message });
  }
});
