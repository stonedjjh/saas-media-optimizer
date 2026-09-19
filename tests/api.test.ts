import { describe, it, expect } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app.js';

describe('HTTP API Endpoints (v1)', () => {
  const app = createApp();

  async function createSampleBuffer(width = 500, height = 500): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 50, g: 150, b: 250 },
      },
    })
      .jpeg()
      .toBuffer();
  }

  it('GET /health debe retornar estado 200 y metadatos del servicio', async () => {
    /**
     * Evalúa: Health check endpoint.
     * Necesita: Petición GET sin parámetros.
     * Resultado esperado: status 200, status "ok", service "saas-media-optimizer".
     */
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('saas-media-optimizer');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.uptime).toBeDefined();
  });

  it('POST /api/v1/optimize debe procesar un upload en perfil "product" retornando JSON completo con thumbnail y métricas', async () => {
    /**
     * Evalúa: Flujo normal de subida multipart en endpoint versionado /api/v1/optimize.
     * Necesita: Archivo JPEG adjunto en el campo 'file'.
     * Resultado esperado: status 200, success true, objetos 'original', 'optimized' y 'thumbnail' con dataUri.
     */
    const sampleBuffer = await createSampleBuffer(1500, 1000);

    const res = await request(app)
      .post('/api/v1/optimize')
      .field('profile', 'product')
      .attach('file', sampleBuffer, 'test-product.jpg');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.profile).toBe('product');
    expect(res.body.original.width).toBe(1500);
    expect(res.body.original.height).toBe(1000);
    expect(res.body.optimized.width).toBe(1200);
    expect(res.body.optimized.height).toBe(800);
    expect(res.body.optimized.dataUri).toMatch(/^data:image\/webp;base64,/);
    expect(res.body.thumbnail.width).toBe(200);
    expect(res.body.thumbnail.height).toBe(200);
    expect(res.body.thumbnail.dataUri).toMatch(/^data:image\/webp;base64,/);
  });

  it('POST /api/v1/optimize?format=binary debe entregar el stream binario directo de la imagen optimizada', async () => {
    /**
     * Evalúa: Modo proxy o tubería binaria directa en /api/v1/optimize.
     * Necesita: Query param format=binary y archivo adjunto.
     * Resultado esperado: status 200, Content-Type "image/webp", cabeceras de tamaño y compresión.
     */
    const sampleBuffer = await createSampleBuffer(600, 400);

    const res = await request(app)
      .post('/api/v1/optimize?format=binary')
      .field('profile', 'product')
      .attach('file', sampleBuffer, 'binary-test.jpg');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['x-compression-ratio']).toBeDefined();
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /api/optimize (alias retrocompatible) debe procesar peticiones exactamente igual', async () => {
    /**
     * Evalúa: Alias /api/optimize para garantizar retrocompatibilidad.
     * Necesita: Archivo adjunto.
     * Resultado esperado: status 200, success true.
     */
    const sampleBuffer = await createSampleBuffer(400, 400);

    const res = await request(app)
      .post('/api/optimize')
      .field('profile', 'product')
      .attach('file', sampleBuffer, 'alias-test.jpg');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/v1/optimize debe rechazar peticiones sin archivo con código 400', async () => {
    /**
     * Evalúa: Validación de payload multipart.
     * Necesita: Petición sin adjunto.
     * Resultado esperado: status 400, success false y mensaje descriptivo.
     */
    const res = await request(app).post('/api/v1/optimize').field('profile', 'product');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Se requiere un archivo');
  });
});
