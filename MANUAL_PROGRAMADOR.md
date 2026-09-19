# Manual del Programador - saas-media-optimizer

## 1. Arquitectura General
`saas-media-optimizer` es un microservicio stateless de alto rendimiento diseñado para la ingesta, validación, transformación, redimensionamiento y compresión de imágenes en memoria sin escribir archivos temporales a disco, equipado con defensas perimetrales de nivel empresarial.

### Principios Arquitectónicos
- **Procesamiento en memoria:** Todo el flujo se procesa a través de Streams y Buffers de Node.js con `sharp` (basado en `libvips` C++).
- **Aislamiento e inmutabilidad:** No almacena archivos multimedia residuales en el sistema de archivos local.
- **Defensa Perimetral y Mitigación de Abusos:**
  - **API Key Opcional (`src/middleware/auth.ts`):** Modo abierto si no se define en `.env`, y estricto 401 si se define.
  - **Rate Limiting (`src/middleware/rateLimit.ts`):** Límites configurables por ventana temporal con cabeceras estándar y 429 Too Many Requests.
  - **Semáforo de Concurrencia Sharp (`src/core/concurrency.ts`):** Aislamiento de memoria RAM evitando OOM crashes bajo ráfagas intensivas mediante cola finita y 503 Service Unavailable.
- **Observabilidad Automatizada:**
  - **Logger Asíncrono (`src/core/logger.ts`):** Integración con `pino` y `rotating-file-stream` registrando métricas en consola y en volumen persistente `./logs` con rotación diaria, compresión `.gz` y retención configurable (`LOG_RETENTION_DAYS`).

---

## 2. Componentes y Módulos

### `ImageOptimizer` (`src/core/optimizer.ts`)
- **Ruta / Uso:** Núcleo de procesamiento de imágenes.
- **Dependencias:** `sharp`.
- **Funciones Principales / API:**
  - `optimizeProduct(buffer: Buffer): Promise<ProductOptimizationOutput>`
    - *Redimensiona dentro de 1200x1200px (conservando aspect ratio), convierte a WebP q=82%, remueve metadatos EXIF sensibles y produce un thumbnail complementario de 200x200px.*
  - `optimizeBrandLogo(buffer: Buffer, options?: { trim?: boolean }): Promise<BrandLogoOptimizationOutput>`
    - *Redimensiona a máx 400x200px preservando canal alfa (transparencia) y recorta bordes vacíos con `trim()` si se especifica.*

### `ConcurrencyLimiter` (`src/core/concurrency.ts`)
- **Ruta / Uso:** Gestor de concurrencia y cola de trabajo de Sharp en memoria.
- **Funciones Principales / API:**
  - `run<T>(fn: () => Promise<T>): Promise<T>` -> *Ejecuta una función respetando `MAX_CONCURRENT_JOBS` o la coloca en cola hasta `MAX_QUEUE_WAITING`. Si la cola se colapsa, lanza error 503.*
  - `getStats()` -> *Retorna el estado de trabajos activos y en espera.*

### `apiKeyAuth` (`src/middleware/auth.ts`)
- **Ruta / Uso:** Middleware de protección de rutas `/api`.
- **Funciones Principales / API:**
  - `apiKeyAuth(req: Request, res: Response, next: NextFunction): void` -> *Verifica cabeceras `x-api-key` o `Authorization: Bearer` contra `process.env.API_KEY`.*

### `apiRateLimiter` (`src/middleware/rateLimit.ts`)
- **Ruta / Uso:** Middleware limitador de peticiones por IP.

---

## 3. Endpoints de la API

### `GET /health`
- **Descripción:** Chequeo de operatividad, uptime y estadísticas de concurrencia.
- **Respuesta:**
  ```json
  {
    "status": "ok",
    "uptime": 12.34,
    "timestamp": "2026-09-19T11:00:00.000Z",
    "service": "saas-media-optimizer",
    "version": "1.0.0",
    "concurrency": {
      "activeJobs": 0,
      "queuedJobs": 0,
      "maxConcurrent": 4,
      "maxQueue": 10
    }
  }
  ```

### `POST /api/v1/optimize` (Alias: `POST /api/optimize`)
- **Cabeceras:** `x-api-key: <token>` (opcional según configuración de entorno).
- **Campos Multipart:**
  - `file` (File, requerido, máx 25MB).
  - `profile` (string, opcional, valores: `product` [default] | `brand-logo`).
  - `trim` (boolean, opcional para brand-logo).
