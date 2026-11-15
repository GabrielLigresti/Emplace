import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Express, type Response } from 'express';
import { API_PREFIX } from '@pgim/shared';

const PREFIJO_ASSETS = '/assets/';

// La app no se embebe en ningún iframe, y el navegador no reinterpreta el tipo.
function cabecerasSeguridad(res: Response): void {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

// Solo las rutas de React vuelven a index.html: no las de la API (sin
// distinguir mayúsculas, como el router de Express) ni un archivo con extensión
// que falta, que tiene que dar 404 y no una página.
function esRutaDeReact(ruta: string): boolean {
  const minuscula = ruta.toLowerCase();
  const esApi = minuscula === API_PREFIX || minuscula.startsWith(`${API_PREFIX}/`);
  return !esApi && path.extname(ruta) === '';
}

// Sirve la web compilada desde la misma API (un solo origen en producción).
// Los assets llevan hash en el nombre, así que se cachean un año; index.html
// nunca, para que un redeploy no deje al navegador pidiendo assets borrados.
export function servirWeb(app: Express, carpeta: string): void {
  // Relativa al directorio de trabajo, como UPLOADS_DIR.
  const raiz = path.resolve(carpeta);
  // Una carpeta mal configurada corta el arranque, en vez de dar 500 en cada
  // página con el health check en verde.
  if (!existsSync(path.join(raiz, 'index.html'))) {
    throw new Error(`WEB_DIST: no hay index.html en ${raiz}`);
  }

  app.use(
    express.static(raiz, {
      index: false,
      setHeaders(res, ruta) {
        cabecerasSeguridad(res);
        if (ruta.startsWith(path.join(raiz, 'assets') + path.sep)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  // Rutas de React (recarga de un link profundo): devuelven index.html.
  app.use((req, res, next) => {
    const esLectura = req.method === 'GET' || req.method === 'HEAD';
    if (!esLectura || req.path.startsWith(PREFIJO_ASSETS) || !esRutaDeReact(req.path)) {
      next();
      return;
    }
    cabecerasSeguridad(res);
    res.setHeader('Cache-Control', 'no-cache');
    // Con `root`, send revisa los dotfiles solo dentro de la carpeta: una ruta
    // absoluta con un directorio oculto (por ejemplo, .claude/) daría 404.
    res.sendFile('index.html', { root: raiz }, (err) => {
      // Si el cliente cortó a mitad de la respuesta, no hay nada que contestar.
      if (err && !res.headersSent) next(err);
    });
  });
}
