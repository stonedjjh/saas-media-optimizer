# Manual del Programador - saas-media-optimizer

## 1. Arquitectura General
`saas-media-optimizer` es un microservicio stateless de alto rendimiento diseñado para la ingesta, validación, transformación, redimensionamiento y compresión de imágenes en memoria sin escribir archivos temporales a disco.

### Principios Arquitectónicos
- **Procesamiento en memoria:** Todo el flujo se procesa a través de Streams y Buffers de Node.js con `sharp` (basado en `libvips` C++).
- **Aislamiento e inmutabilidad:** No almacena archivos residuales en el sistema de archivos local.
- **Versionado Semántico de APIs:** La lógica se expone mediante enrutadores modulares bajo `/api/v1` garantizando evolución de contratos sin roturas.
- **Soporte Dual de Consumo:**
  - **Modo JSON (default):** Provee metadatos de compresión, resolución original/final y cadenas Data URI (o Base64) para consumo directo en paneles administrativos y persistencia en bases de datos o S3.
  - **Modo Binario (`format=binary` o `Accept: image/webp`):** Opera como proxy/tubería entregando directamente el binario WebP optimizado con cabeceras HTTP nativas.

---

## 2. Componentes y Módulos

### `ImageOptimizer` (`src/core/optimizer.ts`)
- **Ruta / Uso:** Núcleo de procesamiento de imágenes.
- **Dependencias:** `sharp`.
- **Funciones Principales / API:**
  - `optimizeProduct(buffer: Buffer): Promise<ProductOptimizationOutput>`
    - *Optimiza imágenes de catálogo de producto: redimensiona dentro de un recuadro de 1200x1200px conservando aspect ratio, convierte a WebP con calidad 82%, remueve metadatos EXIF sensibles y produce un thumbnail complementario de 200x200px.*
  - `optimizeBrandLogo(buffer: Buffer, options?: { trim?: boolean }): Promise<BrandLogoOptimizationOutput>`
    - *Optimiza logotipos de marca o fabricantes: redimensiona a máx 400x200px preservando canal alfa (transparencia) y recorta automáticamente bordes vacíos mediante `trim()` si se especifica.*

### `ExpressApp` (`src/app.ts`)
- **Ruta / Uso:** Configuración del servidor HTTP, middlewares globales (`cors`, `helmet`, `express.json`) y montaje de routers `/api/v1` (y `/api` como alias).
- **Dependencias:** `express`, `cors`, `helmet`, `v1Router`.

### `v1Router` (`src/routes/v1.router.ts`)
- **Ruta / Uso:** Enrutador de la versión 1 de la API (`/api/v1/optimize`).
- **Dependencias:** `upload` (multer en memoria), `optimizeHandler`.

### `OptimizeController` (`src/controllers/optimize.controller.ts`)
- **Ruta / Uso:** Manejador de la ruta `POST /api/v1/optimize`.
- **Dependencias:** `ImageOptimizer`.
- **Funciones Principales / API:**
  - `optimizeHandler(req: Request, res: Response, next: NextFunction): Promise<void>`
    - *Valida el archivo multipart en memoria, procesa según el perfil (`product` o `brand-logo`) y emite respuesta JSON o binaria según encabezados o query params.*

---

## 3. Endpoints de la API

### `GET /health`
- **Descripción:** Chequeo de operatividad y estado del servicio.
- **Respuesta:**
  ```json
  {
    "status": "ok",
    "uptime": 12.34,
    "timestamp": "2026-09-19T11:00:00.000Z",
    "service": "saas-media-optimizer",
    "version": "1.0.0"
  }
  ```

### `POST /api/v1/optimize` (Alias: `POST /api/optimize`)
- **Content-Type:** `multipart/form-data`
- **Campos:**
  - `file` (File, requerido, máx 25MB).
  - `profile` (string, opcional, valores: `product` [default] | `brand-logo`).
  - `trim` (boolean, opcional para brand-logo).
- **Respuesta JSON (default):**
  ```json
  {
    "success": true,
    "profile": "product",
    "original": {
      "format": "jpeg",
      "width": 4000,
      "height": 4000,
      "sizeBytes": 15728640
    },
    "optimized": {
      "format": "webp",
      "width": 1200,
      "height": 1200,
      "sizeBytes": 184320,
      "compressionRatio": "98.83%",
      "dataUri": "data:image/webp;base64,..."
    },
    "thumbnail": {
      "format": "webp",
      "width": 200,
      "height": 200,
      "sizeBytes": 12400,
      "compressionRatio": "99.92%",
      "dataUri": "data:image/webp;base64,..."
    }
  }
  ```
- **Respuesta Binaria (`?format=binary` o `Accept: image/webp`):**
  - Devuelve directamente el buffer de la imagen optimizada con `Content-Type: image/webp` y headers informativos (`X-Original-Size-Bytes`, `X-Optimized-Width`, `X-Optimized-Height`, `X-Compression-Ratio`).
