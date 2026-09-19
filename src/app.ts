import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './core/logger.js';
import { v1Router } from './routes/v1.router.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { apiKeyAuth } from './middleware/auth.js';
import { sharpConcurrencyLimiter } from './core/concurrency.js';

export function createApp(): Express {
  const app = express();

  // Logger HTTP estructurado
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health', // Ignorar polling de healthchecks en logs
      },
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );

  // Middlewares de seguridad y parsing
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Endpoint de salud (siempre público, sin API Key ni Rate Limit restrictivo)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'saas-media-optimizer',
      version: '1.0.0',
      concurrency: sharpConcurrencyLimiter.getStats(),
    });
  });

  // Aplicar Rate Limiting y autenticación de API Key opcional a rutas /api
  app.use('/api', apiRateLimiter, apiKeyAuth);

  // Endpoints versionados
  app.use('/api/v1', v1Router);
  app.use('/api', v1Router);

  // Manejo de errores global
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err, message: err.message }, 'Error capturado en middleware global');
    const statusCode = err.status || (err.message && err.message.includes('no soportado') ? 400 : 500);
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Error interno al procesar los medios.',
    });
  });

  return app;
}
