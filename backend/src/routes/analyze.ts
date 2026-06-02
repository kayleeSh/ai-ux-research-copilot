import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../services/storageService';
import { analyzeTranscript } from '../services/aiService';
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
      res.status(500).json({ error: message });
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
