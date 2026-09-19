import { Request, Response, NextFunction } from 'express';
import { ImageOptimizer, OptimizationProfile } from '../core/optimizer.js';
import { sharpConcurrencyLimiter } from '../core/concurrency.js';
import { logger } from '../core/logger.js';

export async function optimizeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const startTime = Date.now();

  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({
        success: false,
        error: 'Petición inválida: Se requiere un archivo en el campo "file".',
      });
      return;
    }

    const rawProfile = (req.body.profile || req.query.profile || 'product') as string;
    const profile: OptimizationProfile = rawProfile === 'brand-logo' ? 'brand-logo' : 'product';
    const trim = req.body.trim === 'true' || req.query.trim === 'true' || req.body.trim === true;

    // Verificar si el cliente solicita formato binario directo
    const acceptHeader = req.headers['accept'] || '';
    const isBinaryRequested =
      req.query.format === 'binary' ||
      acceptHeader.includes('image/webp') ||
      acceptHeader.includes('image/*');

    // Procesar bajo el semáforo de concurrencia en memoria
    if (profile === 'brand-logo') {
      const result = await sharpConcurrencyLimiter.run(() =>
        ImageOptimizer.optimizeBrandLogo(req.file!.buffer, { trim })
      );

      const durationMs = Date.now() - startTime;
      logger.info({
        action: 'image_optimized',
        profile: 'brand-logo',
        originalBytes: result.original.sizeBytes,
        optimizedBytes: result.optimized.sizeBytes,
        compressionRatio: result.optimized.compressionRatio,
        durationMs,
        ip: req.ip,
      });

      if (isBinaryRequested) {
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Content-Length', result.optimized.sizeBytes);
        res.setHeader('X-Original-Size-Bytes', result.original.sizeBytes);
        res.setHeader('X-Optimized-Width', result.optimized.width);
        res.setHeader('X-Optimized-Height', result.optimized.height);
        res.setHeader('X-Compression-Ratio', result.optimized.compressionRatio);
        res.send(result.optimized.buffer);
        return;
      }

      res.status(200).json({
        success: true,
        profile: result.profile,
        original: result.original,
        optimized: {
          format: result.optimized.format,
          width: result.optimized.width,
          height: result.optimized.height,
          sizeBytes: result.optimized.sizeBytes,
          compressionRatio: result.optimized.compressionRatio,
          dataUri: result.optimized.dataUri,
        },
      });
      return;
    }

    // Perfil por defecto: 'product'
    const result = await sharpConcurrencyLimiter.run(() =>
      ImageOptimizer.optimizeProduct(req.file!.buffer)
    );

    const durationMs = Date.now() - startTime;
    logger.info({
      action: 'image_optimized',
      profile: 'product',
      originalBytes: result.original.sizeBytes,
      optimizedBytes: result.optimized.sizeBytes,
      compressionRatio: result.optimized.compressionRatio,
      durationMs,
      ip: req.ip,
    });

    if (isBinaryRequested) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Content-Length', result.optimized.sizeBytes);
      res.setHeader('X-Original-Size-Bytes', result.original.sizeBytes);
      res.setHeader('X-Optimized-Width', result.optimized.width);
      res.setHeader('X-Optimized-Height', result.optimized.height);
      res.setHeader('X-Compression-Ratio', result.optimized.compressionRatio);
      res.send(result.optimized.buffer);
      return;
    }

    res.status(200).json({
      success: true,
      profile: result.profile,
      original: result.original,
      optimized: {
        format: result.optimized.format,
        width: result.optimized.width,
        height: result.optimized.height,
        sizeBytes: result.optimized.sizeBytes,
        compressionRatio: result.optimized.compressionRatio,
        dataUri: result.optimized.dataUri,
      },
      thumbnail: {
        format: result.thumbnail.format,
        width: result.thumbnail.width,
        height: result.thumbnail.height,
        sizeBytes: result.thumbnail.sizeBytes,
        compressionRatio: result.thumbnail.compressionRatio,
        dataUri: result.thumbnail.dataUri,
      },
    });
  } catch (error: any) {
    if (error.statusCode === 503) {
      if (error.retryAfter) {
        res.setHeader('Retry-After', error.retryAfter);
      }
      res.status(503).json({
        success: false,
        error: error.message,
        retryAfterSeconds: error.retryAfter || 5,
      });
      return;
    }
    next(error);
  }
}
