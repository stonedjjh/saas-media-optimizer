# saas-media-optimizer

<p align="center">
  <img src="https://skillicons.dev/icons?i=nodejs,ts,express,docker&theme=dark" alt="Tech Stack" />
</p>

<p align="center">
  <a href="https://github.com/stonedjjh/saas-media-optimizer"><img src="https://img.shields.io/badge/Status-Active-00C853?style=for-the-badge" alt="Status" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-22%20LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 22 LTS" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://sharp.pixelplumbing.com"><img src="https://img.shields.io/badge/Sharp-libvips-990000?style=for-the-badge" alt="Sharp Engine" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License MIT" /></a>
</p>

---

## Technical Overview

`saas-media-optimizer` is an enterprise-grade, stateless microservice dedicated to real-time media ingestion, inspection, transformation, downscaling, and compression entirely in memory (RAM) utilizing `sharp` (`libvips` C++ engine) and Node.js 22 LTS.

The service incorporates production hardening features: optional API Key authentication, IP-based rate limiting, concurrency queue management to eliminate Out-Of-Memory (OOM) risks, and structured multi-stream logging with automated daily rotation and gzip compression.

---

## Architectural Principles & Hardening

1. **Pure In-Memory Processing:** Multipart buffers are accepted via `multer.memoryStorage()` and piped directly into `sharp` stream pipelines without filesystem writes.
2. **Strict API Versioning:** All endpoints are strictly isolated under `/api/v1/` routes with backward-compatible `/api/` aliases.
3. **Optional API Key Security:** Supports optional protection via `x-api-key` or `Authorization: Bearer <token>`. In local development without `API_KEY` set, it runs in frictionless open mode.
4. **Rate Limiting:** Protects endpoints with standard `RateLimit-*` headers and automatic `429 Too Many Requests` responses.
5. **Sharp Concurrency Semaphore:** Manages concurrent image processing (`MAX_CONCURRENT_JOBS`) and graceful request queueing (`MAX_QUEUE_WAITING`). Emits `503 Service Unavailable` with `Retry-After` if limits are exceeded.
6. **Zero-Maintenance Structured Logging:** High-performance asynchronous logging with `pino` and `rotating-file-stream` writing structured JSON logs with daily rotation, `.gz` archival, and automated retention cleanup.

---

## Optimization Profiles

| Profile | Target Canvas | Format | Quality | Alpha Channel | Features |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `product` | 1200 x 1200 px (inside) | WebP | 82% | Flattened / Preserved | Auto EXIF orientation, metadata stripping, 200x200 px attention-centered thumbnail |
| `brand-logo` | 400 x 200 px (inside) | WebP | 90% | 100% Alpha Preserved | Alpha fidelity, optional border auto-trimming (`trim=true`) |

---

## Prerequisites

- **Node.js:** 22.x LTS or higher
- **Package Manager:** `pnpm` (version 10 or 11 recommended)
- **Container Runtime:** Docker Engine 24+ and Docker Compose

---

## Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Number | `4000` | Port on which the HTTP server listens |
| `NODE_ENV` | String | `development` | Runtime environment (`development`, `production`, `test`) |
| `API_KEY` | String | *Empty* | Optional API Key. If empty, endpoints run publicly. If defined, requires authentication |
| `RATE_LIMIT_WINDOW_MS` | Number | `60000` | Rate limiting sliding window in milliseconds (1 minute) |
| `RATE_LIMIT_MAX` | Number | `60` | Maximum requests allowed per IP during window |
| `MAX_CONCURRENT_JOBS` | Number | `4` | Maximum Sharp compression tasks running in parallel |
| `MAX_QUEUE_WAITING` | Number | `10` | Maximum requests queued before triggering HTTP 503 |
| `LOG_RETENTION_DAYS` | Number | `30` | Number of days to retain rotated `.log.gz` archives before automatic purge |
| `LOG_LEVEL` | String | `info` | Minimum log severity level (`trace`, `debug`, `info`, `warn`, `error`) |

---

## Installation & Local Execution

```bash
# Clone repository
git clone https://github.com/stonedjjh/saas-media-optimizer.git
cd saas-media-optimizer

# Install dependencies using pnpm
pnpm install

# Start in development mode with hot-reload
pnpm run dev

# Compile TypeScript bundle
pnpm run build

# Start production server
pnpm start
```

---

## Containerized Deployment (Docker)

The repository provides a multi-stage `Dockerfile` based on `node:22-alpine` with non-root security (`appuser`) and mounted log volume.

```bash
# Build and run container with docker-compose
docker compose up -d --build

# Inspect container health and logs
docker compose ps
docker compose logs -f
```

---

## API Specification & Examples

### 1. Health Check (Always Public)

#### Request
```bash
curl -X GET http://localhost:4000/health
```

#### Response (`200 OK`)
```json
{
  "status": "ok",
  "uptime": 124.52,
  "timestamp": "2026-09-19T11:45:00.000Z",
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

---

### 2. Media Optimization (JSON Mode)

```bash
curl -X POST http://localhost:4000/api/v1/optimize \
  -H "x-api-key: your-secret-api-key" \
  -F "file=@/path/to/heavy-image.jpg" \
  -F "profile=product"
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "profile": "product",
  "original": {
    "format": "jpeg",
    "width": 3840,
    "height": 2160,
    "sizeBytes": 8421000
  },
  "optimized": {
    "format": "webp",
    "width": 1200,
    "height": 675,
    "sizeBytes": 98400,
    "compressionRatio": "98.83%",
    "dataUri": "data:image/webp;base64,UklGRmQAAABXRUJQVlA4..."
  },
  "thumbnail": {
    "format": "webp",
    "width": 200,
    "height": 200,
    "sizeBytes": 7200,
    "compressionRatio": "99.91%",
    "dataUri": "data:image/webp;base64,UklGRmAAAABXRUJQVlA4..."
  }
}
```

---

### 3. Direct Binary Streaming Mode (Pipe / CDN Proxy)

```bash
curl -X POST "http://localhost:4000/api/v1/optimize?format=binary" \
  -H "x-api-key: your-secret-api-key" \
  -F "file=@/path/to/photo.jpg" \
  -F "profile=product" \
  --output optimized-image.webp
```

#### Response Headers
```http
HTTP/1.1 200 OK
Content-Type: image/webp
Content-Length: 98400
X-Original-Size-Bytes: 8421000
X-Optimized-Width: 1200
X-Optimized-Height: 675
X-Compression-Ratio: 98.83%
```

---

## Automated Test Suite

```bash
# Execute test suite (Vitest + Supertest)
pnpm test

# Run tests in watch mode
pnpm run test:watch
```

---

## Authors & Organization

- **Author:** Daniel Jiménez
- **Organization:** stonecraft
- **GitHub:** [@stonedjjh](https://github.com/stonedjjh)
- **LinkedIn:** [Daniel Jiménez](https://www.linkedin.com/in/daniel-jimenez-88a2a293/)

---

## License

This project is licensed under the terms of the [MIT License](LICENSE).
