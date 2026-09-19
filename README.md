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

`saas-media-optimizer` is a high-performance, stateless microservice dedicated to real-time media ingestion, inspection, transformation, downscaling, and compression entirely in memory (RAM) utilizing `sharp` (`libvips` C++ engine) and Node.js 22 LTS.

The service is engineered to avoid disk input/output overhead and residual temporary files. It accommodates payload uploads up to 25 MB and 4000x4000px, delivering optimized WebP representations alongside high-density thumbnails and compression telemetry.

---

## Architectural Principles

1. **Pure In-Memory Processing:** Multipart buffers are accepted via `multer.memoryStorage()` and piped directly into `sharp` stream pipelines without filesystem writes.
2. **Strict API Versioning:** All endpoints are strictly isolated under `/api/v1/` routes for predictable API evolution and backward-compatibility.
3. **Dual-Mode Consumption:**
   - **JSON Mode (Default):** Returns full analytical telemetry (original vs. optimized size, dimensions, compression ratio) together with Base64 Data URIs ready for persistence into databases or cloud object stores.
   - **Direct Binary Mode (`Accept: image/webp` or `?format=binary`):** Emits optimized binary streams directly with native HTTP response headers for piping into image caches, CDNs, or file downloaders.
4. **EXIF Stripping:** Automatically removes location, camera, and device metadata from output buffers to guarantee consumer privacy.
5. **Strict Quality Encoders:** Uses WebP algorithms tailored per domain (`product` vs. `brand-logo`).

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
- **Container Runtime:** Docker Engine 24+ and Docker Compose (optional for containerized deployments)

---

## Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Number | `4000` | Port on which the HTTP server listens |
| `NODE_ENV` | String | `development` | Application runtime environment (`development`, `production`, `test`) |
| `MAX_FILE_SIZE_MB` | Number | `25` | Maximum multipart upload file size in megabytes |
| `MAX_IMAGE_DIMENSION` | Number | `4000` | Maximum allowable pixel dimension for input media |

---

## Installation & Local Execution

```bash
# Clone the repository
git clone https://github.com/stonedjjh/saas-media-optimizer.git
cd saas-media-optimizer

# Install dependencies using pnpm
pnpm install

# Start in development mode with hot-reload
pnpm run dev

# Compile TypeScript production bundle
pnpm run build

# Start production server
pnpm start
```

---

## Containerized Deployment (Docker)

The repository provides a multi-stage `Dockerfile` based on `node:22-alpine`, optimized for libvips and non-root execution (`appuser`).

```bash
# Build and run container with docker-compose
docker compose up -d --build

# Inspect container health
docker compose ps

# View service logs
docker compose logs -f
```

---

## API Specification & Examples

### 1. Health Check

#### Request
```bash
curl -X GET http://localhost:4000/health
```

#### Response (`200 OK`)
```json
{
  "status": "ok",
  "uptime": 45.21,
  "timestamp": "2026-09-19T11:15:00.000Z",
  "service": "saas-media-optimizer",
  "version": "1.0.0"
}
```

---

### 2. Media Optimization (v1 Default JSON Mode)

Uploads an image for the `product` profile using the versioned endpoint `/api/v1/optimize`.

#### Request
```bash
curl -X POST http://localhost:4000/api/v1/optimize \
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

### 3. Logo Optimization with Transparent Trimming

Processes a brand logo, trims transparent edges and maintains alpha fidelity.

#### Request
```bash
curl -X POST http://localhost:4000/api/v1/optimize \
  -F "file=@/path/to/logo-with-borders.png" \
  -F "profile=brand-logo" \
  -F "trim=true"
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "profile": "brand-logo",
  "original": {
    "format": "png",
    "width": 1000,
    "height": 500,
    "sizeBytes": 240000
  },
  "optimized": {
    "format": "webp",
    "width": 400,
    "height": 180,
    "sizeBytes": 22400,
    "compressionRatio": "90.67%",
    "dataUri": "data:image/webp;base64,UklGRmAAAABXRUJQVlA4..."
  }
}
```

---

### 4. Direct Binary Streaming Mode (Pipe / CDN Proxy)

Streams binary WebP bytes directly to disk or downstream consumers.

#### Request
```bash
curl -X POST "http://localhost:4000/api/v1/optimize?format=binary" \
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

## Test Suite

The test suite runs on `vitest` and `supertest`, executing end-to-end multipart validations and in-memory buffer transformations.

```bash
# Run automated tests once
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
