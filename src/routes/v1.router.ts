import { Router, type Router as IRouter } from 'express';
import { upload } from '../middleware/upload.js';
import { optimizeHandler } from '../controllers/optimize.controller.js';

export const v1Router: IRouter = Router();

// Endpoint versionado v1
v1Router.post('/optimize', upload.single('file'), optimizeHandler);
