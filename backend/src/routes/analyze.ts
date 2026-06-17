import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../services/storageService';
import { analyzeTranscript, analyzeTranscriptStream, synthesizeInterviews } from '../services/aiService';
import { Interview } from '../types';

export const analyzeRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

async function extractText(file: Express.Multer.File): Promise<string> {
  const ext = file.originalname.split('.').pop()?.toLowerCase();

  if (ext === 'txt') {
    return file.buffer.toString('utf-8');
  }

  if (ext === 'pdf') {
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(file.buffer);
    return data.text;
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: .${ext}. Please use .txt, .pdf, or .docx`);
}

analyzeRouter.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const transcript = await extractText(req.file);
      const id = uuidv4();

      const interview: Interview = {
        id,
        title: (req.body.title as string) || req.file.originalname.replace(/\.[^/.]+$/, ''),
        transcript,
        fileName: req.file.originalname,
        uploadedAt: new Date().toISOString()
      };

      storage.saveInterview(interview);
      const aiResult = await analyzeTranscript(transcript, id);
      storage.updateInterview(id, { aiResult });

      res.json({ id, interview: { ...interview, aiResult } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const cause = (err as any)?.cause;
      console.error('[analyze error] message:', message);
      console.error('[analyze error] cause:', cause);
      res.status(500).json({ error: message, cause: String(cause) });
    }
  }
);

analyzeRouter.post('/text', async (req: Request, res: Response): Promise<void> => {
  try {
    const { transcript, title } = req.body as { transcript?: string; title?: string };
    if (!transcript?.trim()) {
      res.status(400).json({ error: 'transcript is required' });
      return;
    }

    const id = uuidv4();
    const interview: Interview = {
      id,
      title: title || 'Untitled Interview',
      transcript,
      fileName: 'manual-entry.txt',
      uploadedAt: new Date().toISOString()
    };

    storage.saveInterview(interview);
    const aiResult = await analyzeTranscript(transcript, id);
    storage.updateInterview(id, { aiResult });

    res.json({ id, interview: { ...interview, aiResult } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

analyzeRouter.post('/regenerate/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const interview = storage.getInterview(req.params.id);
    if (!interview) {
      res.status(404).json({ error: 'Interview not found' });
      return;
    }

    const aiResult = await analyzeTranscript(interview.transcript, interview.id);
    storage.updateInterview(interview.id, { aiResult });

    res.json({ aiResult });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ── Streaming endpoints (SSE) ─────────────────────────────────────────────────

function sseSetup(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

function sseSend(res: Response, event: object) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// POST /api/analyze/text/stream — stream a new transcript analysis
analyzeRouter.post('/text/stream', async (req: Request, res: Response): Promise<void> => {
  const { transcript, title } = req.body as { transcript?: string; title?: string };
  if (!transcript?.trim()) {
    res.status(400).json({ error: 'transcript is required' });
    return;
  }

  sseSetup(res);

  const id = uuidv4();
  const interview: Interview = {
    id,
    title: title || 'Untitled Interview',
    transcript,
    fileName: 'manual-entry.txt',
    uploadedAt: new Date().toISOString()
  };
  storage.saveInterview(interview);

  try {
    await analyzeTranscriptStream(
      transcript,
      id,
      (accumulated) => sseSend(res, { type: 'chunk', accumulated }),
      (aiResult) => {
        storage.updateInterview(id, { aiResult });
        sseSend(res, { type: 'done', id, aiResult });
        res.end();
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sseSend(res, { type: 'error', message });
    res.end();
  }
});

// POST /api/analyze/regenerate/:id/stream — stream a regeneration
analyzeRouter.post('/regenerate/:id/stream', async (req: Request, res: Response): Promise<void> => {
  const interview = storage.getInterview(req.params.id);
  if (!interview) {
    res.status(404).json({ error: 'Interview not found' });
    return;
  }

  sseSetup(res);

  try {
    await analyzeTranscriptStream(
      interview.transcript,
      interview.id,
      (accumulated) => sseSend(res, { type: 'chunk', accumulated }),
      (aiResult) => {
        storage.updateInterview(interview.id, { aiResult });
        sseSend(res, { type: 'done', id: interview.id, aiResult });
        res.end();
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sseSend(res, { type: 'error', message });
    res.end();
  }
});

// ── Cross-interview synthesis ─────────────────────────────────────────────────

analyzeRouter.post('/synthesize', async (req: Request, res: Response): Promise<void> => {
  try {
    const { interviewIds } = req.body as { interviewIds?: string[] };
    if (!interviewIds || interviewIds.length < 2) {
      res.status(400).json({ error: 'Select at least 2 interviews to synthesize' });
      return;
    }

    const interviews = interviewIds
      .map(id => storage.getInterview(id))
      .filter((iv): iv is Interview => !!iv && !!iv.aiResult);

    if (interviews.length < 2) {
      res.status(400).json({ error: 'Could not find enough analyzed interviews. Make sure both interviews have been analyzed first.' });
      return;
    }

    // Pass extracted aiResult fields instead of full transcripts — reduces tokens per
    // interview from ~1500 to ~250, preventing rate limit errors on Groq's free tier.
    const result = await synthesizeInterviews(
      interviews.map(iv => ({
        id:         iv.id,
        title:      iv.title,
        summary:    iv.aiResult!.summary,
        keyQuotes:  iv.aiResult!.keyQuotes,
        painPoints: iv.aiResult!.painPoints,
        mainThemes: iv.aiResult!.mainThemes,
      }))
    );
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[synthesize error]', message);
    res.status(500).json({ error: message });
  }
});
