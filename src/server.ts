import dotenv from 'dotenv';
import { createApp } from './app.js';

dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[saas-media-optimizer] Servidor HTTP activo en puerto ${PORT}`);
});
