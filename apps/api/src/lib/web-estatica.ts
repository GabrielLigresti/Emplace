import path from 'node:path';
import express, { type Express } from 'express';
import { API_PREFIX } from '@pgim/shared';

const PREFIJO_ASSETS = '/assets/';

// Sirve la web compilada desde la misma API (un solo origen en producción).
// Los assets llevan hash en el nombre, así que se cachean un año; index.html
// nunca, para que un redeploy no deje al navegador pidiendo assets borrados.
export function servirWeb(app: Express, carpeta: string): void {
  // sendFile exige una ruta absoluta.
  const raiz = path.resolve(carpeta);

  app.use(
    express.static(raiz, {
      index: false,
      setHeaders(res, ruta) {
        if (ruta.startsWith(path.join(raiz, 'assets') + path.sep)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  // Rutas de React (recarga de un link profundo): devuelven index.html. Una
  // ruta de /api o un asset faltante siguen al 404 JSON.
  app.use((req, res, next) => {
    const esLectura = req.method === 'GET' || req.method === 'HEAD';
    if (!esLectura || req.path.startsWith(API_PREFIX) || req.path.startsWith(PREFIJO_ASSETS)) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(raiz, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}
