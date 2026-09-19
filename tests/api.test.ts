import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { ConcurrencyLimiter } from '../src/core/concurrency.js';

describe('HTTP API Endpoints (v1) & Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

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

  it('GET /health debe retornar estado 200 y estadísticas de concurrencia', async () => {
    /**
     * Evalúa: Health check endpoint público.
     * Necesita: Petición GET sin API key.
     * Resultado esperado: status 200, status "ok", service "saas-media-optimizer", concurrency stats.
     */
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.concurrency).toBeDefined();
    expect(res.body.concurrency.activeJobs).toBe(0);
  });

  it('debe rechazar con 401 si API_KEY está configurada y la petición no la incluye', async () => {
    /**
     * Evalúa: Middleware apiKeyAuth en modo protegido.
     * Necesita: Variable de entorno API_KEY activa.
     * Resultado esperado: status 401 Unauthorized.
     */
    process.env.API_KEY = 'secret-test-key-123';
    const app = createApp();
    const sampleBuffer = await createSampleBuffer(200, 200);

    const res = await request(app)
      .post('/api/v1/optimize')
      .attach('file', sampleBuffer, 'test.jpg');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('No autorizado');
  });

  it('debe permitir la petición si se proporciona la API_KEY correcta vía cabecera x-api-key', async () => {
    /**
     * Evalúa: Acceso exitoso con cabecera x-api-key válida.
     * Necesita: x-api-key igual a process.env.API_KEY.
     * Resultado esperado: status 200 OK.
     */
    process.env.API_KEY = 'secret-test-key-123';
    const app = createApp();
    const sampleBuffer = await createSampleBuffer(300, 300);

    const res = await request(app)
      .post('/api/v1/optimize')
      .set('x-api-key', 'secret-test-key-123')
      .field('profile', 'product')
      .attach('file', sampleBuffer, 'test.jpg');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/v1/optimize debe procesar un upload en perfil "product" retornando JSON completo con thumbnail y métricas', async () => {
    /**
     * Evalúa: Flujo normal en modo abierto.
     * Necesita: Archivo JPEG adjunto.
     * Resultado esperado: status 200, success true, objetos original, optimized y thumbnail.
     */
    process.env.API_KEY = '';
    const app = createApp();
    const sampleBuffer = await createSampleBuffer(1500, 1000);

    const res = await request(app)
      .post('/api/v1/optimize')
      .field('profile', 'product')
      .attach('file', sampleBuffer, 'test-product.jpg');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.profile).toBe('product');
    expect(res.body.original.width).toBe(1500);
    expect(res.body.optimized.width).toBe(1200);
    expect(res.body.thumbnail.width).toBe(200);
  });

  it('POST /api/v1/optimize?format=binary debe entregar el stream binario directo de la imagen optimizada', async () => {
    /**
     * Evalúa: Modo proxy o tubería binaria directa.
     * Necesita: format=binary.
     * Resultado esperado: Content-Type image/webp y Buffer en body.
     */
    process.env.API_KEY = '';
    const app = createApp();
    const sampleBuffer = await createSampleBuffer(600, 400);

    const res = await request(app)
      .post('/api/v1/optimize?format=binary')
      .field('profile', 'product')
      .attach('file', sampleBuffer, 'binary-test.jpg');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['x-compression-ratio']).toBeDefined();
    expect(res.body).toBeInstanceOf(Buffer);
  });

  it('POST /api/v1/optimize debe responder con 400 si falta el archivo adjunto', async () => {
    /**
     * Evalúa: Validación de payload multipart.
     * Necesita: Petición sin archivo adjunto.
     * Resultado esperado: status 400.
     */
    process.env.API_KEY = '';
    const app = createApp();
    const res = await request(app).post('/api/v1/optimize').field('profile', 'product');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('ConcurrencyLimiter debe arrojar error 503 cuando se excede la capacidad de cola máxima', async () => {
    /**
     * Evalúa: Comportamiento del semáforo de concurrencia ante saturación.
     * Necesita: Límite 1 concurrente y 1 en cola.
     * Resultado esperado: El tercer trabajo arroja error con código 503.
     */
    const limiter = new ConcurrencyLimiter(1, 1);

    // Trabajo 1: Ocupa el slot activo
    let resolveJob1: () => void;
    const job1Promise = limiter.run(
      () =>
        new Promise<void>((res) => {
          resolveJob1 = res;
        })
    );

    // Trabajo 2: Ocupa la cola de espera
    const job2Promise = limiter.run(async () => 'job2 done');

    // Trabajo 3: Debe ser rechazado inmediatamente con 503
    await expect(limiter.run(async () => 'job3')).rejects.toThrowError(/Capacidad máxima alcanzada/);

    resolveJob1!();
    await Promise.all([job1Promise, job2Promise]);
  });
});
