import path from 'path';
import fs from 'fs';
import { pino, multistream } from 'pino';
import * as rfs from 'rotating-file-stream';

const LOG_DIR = path.resolve(process.cwd(), 'logs');

// Asegurar existencia del directorio de logs
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS || '30', 10);

// Rotador de archivos diario con compresión gzip automática y retención
const fileStream = rfs.createStream(
  (time: number | Date | null, index?: number) => {
    if (!time) return 'active.log';
    const date = new Date(time);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const idx = index ? `.${index}` : '';
    return `${yyyy}/${mm}/${yyyy}-${mm}-${dd}${idx}.log.gz`;
  },
  {
    interval: '1d', // Rotación diaria a medianoche
    compress: 'gzip', // Compresión automática de días pasados
    maxFiles: retentionDays, // Purga automática de logs mayores a la retención configurada
    path: LOG_DIR,
    initialRotation: true,
  }
);

// Formateador multi-stream: consola legible en desarrollo + archivo estructurado
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  },
  multistream([
    { stream: process.stdout },
    { stream: fileStream },
  ])
);
