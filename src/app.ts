import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { upload } from './middleware/upload.js';
import { optimizeHandler } from './controllers/optimize.controller.js';

export function createApp(): Express {
  const app = express();

  // Middlewares de seguridad y parsing
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Endpoint de salud
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'saas-media-optimizer',
      version: '1.0.0',
    });
  });

  // Endpoint de optimización
  app.post('/api/optimize', upload.single('file'), optimizeHandler);

  // Manejo de errores global
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.status || (err.message && err.message.includes('no soportado') ? 400 : 500);
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Error interno al procesar los medios.',
    });
  });

  return app;
}
