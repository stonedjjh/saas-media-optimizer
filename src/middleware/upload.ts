import multer from 'multer';

// Storage estrictamente en memoria (RAM), sin tocar disco
const storage = multer.memoryStorage();

// Límite de 25MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/tiff',
      'image/gif',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no soportado: ${file.mimetype}. Formatos permitidos: JPG, PNG, WEBP, AVIF, TIFF, GIF.`));
    }
  },
});
