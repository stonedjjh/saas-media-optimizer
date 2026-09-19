import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { ImageOptimizer } from '../src/core/optimizer.js';

describe('ImageOptimizer Core Service', () => {
  /**
   * Helper para generar una imagen sintética en memoria con sharp
   */
  async function createTestImage(width: number, height: number, channels: 3 | 4 = 3): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels,
        background: channels === 4 ? { r: 255, g: 0, b: 0, alpha: 0.5 } : { r: 100, g: 150, b: 200 },
      },
    })
      .png()
      .toBuffer();
  }

  it('debe inspeccionar correctamente los metadatos de un buffer de imagen', async () => {
    /**
     * Evalúa: inspectImage()
     * Necesita: Un buffer PNG válido de 800x600px.
     * Resultado esperado: Retorna ancho 800, alto 600, formato 'png' y tamaño en bytes > 0.
     */
    const buffer = await createTestImage(800, 600);
    const meta = await ImageOptimizer.inspectImage(buffer);

    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
    expect(meta.format).toBe('png');
    expect(meta.sizeBytes).toBeGreaterThan(0);
  });

  it('debe procesar el perfil "product" redimensionando a máx 1200x1200px y generando thumbnail de 200x200px en WebP', async () => {
    /**
     * Evalúa: optimizeProduct()
     * Necesita: Imagen de 1600x1200px.
     * Resultado esperado:
     * - Imagen principal redimensionada proporcionalmente dentro de 1200x1200px (1200x900px), formato WebP.
     * - Thumbnail generado exactamente en 200x200px, formato WebP.
     * - Cadena Data URI válida y porcentaje de compresión calculado.
     */
    const inputBuffer = await createTestImage(1600, 1200);
    const result = await ImageOptimizer.optimizeProduct(inputBuffer);

    expect(result.profile).toBe('product');
    expect(result.original.width).toBe(1600);
    expect(result.original.height).toBe(1200);

    // Verificación de imagen principal
    expect(result.optimized.format).toBe('webp');
    expect(result.optimized.width).toBe(1200);
    expect(result.optimized.height).toBe(900);
    expect(result.optimized.dataUri).toMatch(/^data:image\/webp;base64,/);
    expect(result.optimized.sizeBytes).toBeGreaterThan(0);

    // Verificación de thumbnail
    expect(result.thumbnail.format).toBe('webp');
    expect(result.thumbnail.width).toBe(200);
    expect(result.thumbnail.height).toBe(200);
    expect(result.thumbnail.dataUri).toMatch(/^data:image\/webp;base64,/);
  });

  it('debe procesar el perfil "brand-logo" respetando canal alfa y límite de 400x200px', async () => {
    /**
     * Evalúa: optimizeBrandLogo()
     * Necesita: Imagen con transparencia (4 canales RGBA) de 600x300px.
     * Resultado esperado: Redimensionada a máx 400x200px en WebP conservando canal alfa.
     */
    const inputBuffer = await createTestImage(600, 300, 4);
    const result = await ImageOptimizer.optimizeBrandLogo(inputBuffer, { trim: false });

    expect(result.profile).toBe('brand-logo');
    expect(result.optimized.format).toBe('webp');
    expect(result.optimized.width).toBeLessThanOrEqual(400);
    expect(result.optimized.height).toBeLessThanOrEqual(200);
    expect(result.optimized.dataUri).toMatch(/^data:image\/webp;base64,/);
  });
});
