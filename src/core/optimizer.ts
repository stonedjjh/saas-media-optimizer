import sharp from 'sharp';

export type OptimizationProfile = 'product' | 'brand-logo';

export interface ImageMetadata {
  format: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface OptimizedImageResult {
  format: string;
  width: number;
  height: number;
  sizeBytes: number;
  compressionRatio: string;
  buffer: Buffer;
  dataUri: string;
}

export interface ProductOptimizationOutput {
  profile: 'product';
  original: ImageMetadata;
  optimized: OptimizedImageResult;
  thumbnail: OptimizedImageResult;
}

export interface BrandLogoOptimizationOutput {
  profile: 'brand-logo';
  original: ImageMetadata;
  optimized: OptimizedImageResult;
}

export class ImageOptimizer {
  /**
   * Calcula el porcentaje de reducción respecto al tamaño original
   */
  private static calculateCompressionRatio(originalBytes: number, optimizedBytes: number): string {
    if (originalBytes <= 0) return '0.00%';
    const ratio = ((originalBytes - optimizedBytes) / originalBytes) * 100;
    return `${Math.max(0, ratio).toFixed(2)}%`;
  }

  /**
   * Extrae metadatos de un buffer de imagen y valida límites
   */
  public static async inspectImage(buffer: Buffer): Promise<ImageMetadata> {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.format || !metadata.width || !metadata.height) {
      throw new Error('No se pudo identificar un formato o dimensiones válidas de la imagen.');
    }

    return {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Perfil Producto:
   * - Redimensiona a máx 1200x1200px (sin forzar distorsión ni upscale innecesario)
   * - Convierte a WebP calidad 82%
   * - Remueve metadatos EXIF sensibles
   * - Genera miniatura thumbnail de 200x200px WebP
   */
  public static async optimizeProduct(buffer: Buffer): Promise<ProductOptimizationOutput> {
    const original = await this.inspectImage(buffer);

    // 1. Imagen Principal (máx 1200x1200px)
    const optimizedBuffer = await sharp(buffer, { failOn: 'none' })
      .rotate() // Auto-orientación según EXIF antes de removerlo
      .resize({
        width: 1200,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    const optMeta = await sharp(optimizedBuffer).metadata();
    const optBytes = optimizedBuffer.length;

    // 2. Thumbnail (200x200px con recorte centrado para catálogo)
    const thumbBuffer = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: 200,
        height: 200,
        fit: 'cover',
        position: sharp.strategy.attention,
      })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();

    const thumbMeta = await sharp(thumbBuffer).metadata();
    const thumbBytes = thumbBuffer.length;

    return {
      profile: 'product',
      original,
      optimized: {
        format: 'webp',
        width: optMeta.width || 0,
        height: optMeta.height || 0,
        sizeBytes: optBytes,
        compressionRatio: this.calculateCompressionRatio(original.sizeBytes, optBytes),
        buffer: optimizedBuffer,
        dataUri: `data:image/webp;base64,${optimizedBuffer.toString('base64')}`,
      },
      thumbnail: {
        format: 'webp',
        width: thumbMeta.width || 0,
        height: thumbMeta.height || 0,
        sizeBytes: thumbBytes,
        compressionRatio: this.calculateCompressionRatio(original.sizeBytes, thumbBytes),
        buffer: thumbBuffer,
        dataUri: `data:image/webp;base64,${thumbBuffer.toString('base64')}`,
      },
    };
  }

  /**
   * Perfil Brand Logo:
   * - Máx 400x200px preservando aspect ratio sin upscale
   * - Preserva canal alfa / transparencia
   * - Opcionalmente recorta bordes transparentes o vacíos con trim()
   * - Convierte a WebP sin pérdida o alta fidelidad preservando transparencia
   */
  public static async optimizeBrandLogo(
    buffer: Buffer,
    options: { trim?: boolean } = { trim: true }
  ): Promise<BrandLogoOptimizationOutput> {
    const original = await this.inspectImage(buffer);

    let pipeline = sharp(buffer, { failOn: 'none' }).rotate();

    if (options.trim) {
      pipeline = pipeline.trim();
    }

    const optimizedBuffer = await pipeline
      .resize({
        width: 400,
        height: 200,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: 90,
        alphaQuality: 100,
        lossless: false,
        effort: 4,
      })
      .toBuffer();

    const optMeta = await sharp(optimizedBuffer).metadata();
    const optBytes = optimizedBuffer.length;

    return {
      profile: 'brand-logo',
      original,
      optimized: {
        format: 'webp',
        width: optMeta.width || 0,
        height: optMeta.height || 0,
        sizeBytes: optBytes,
        compressionRatio: this.calculateCompressionRatio(original.sizeBytes, optBytes),
        buffer: optimizedBuffer,
        dataUri: `data:image/webp;base64,${optimizedBuffer.toString('base64')}`,
      },
    };
  }
}
