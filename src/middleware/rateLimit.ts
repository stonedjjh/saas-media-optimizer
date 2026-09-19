import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);

export const apiRateLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  standardHeaders: true, // Devuelve cabeceras RateLimit-* estándar
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Límite de peticiones excedido. El servidor ha alcanzado su cupo permitido temporal. Por favor intente de nuevo más tarde.',
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    });
  },
});
