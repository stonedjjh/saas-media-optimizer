import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de autenticación de API Key opcional.
 * - Si API_KEY no está definida en .env, opera en modo abierto.
 * - Si API_KEY está configurada, valida cabeceras 'x-api-key' o 'Authorization: Bearer <key>'.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const configuredApiKey = process.env.API_KEY;

  // Si no se configuró API_KEY, el microservicio corre en modo público / abierto
  if (!configuredApiKey || configuredApiKey.trim() === '') {
    next();
    return;
  }

  const headerKey = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];

  let clientKey: string | undefined;

  if (typeof headerKey === 'string') {
    clientKey = headerKey.trim();
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    clientKey = authHeader.substring(7).trim();
  }

  if (!clientKey || clientKey !== configuredApiKey) {
    res.status(401).json({
      success: false,
      error: 'No autorizado: Se requiere una API Key válida en la cabecera "x-api-key" o "Authorization: Bearer".',
    });
    return;
  }

  next();
}
