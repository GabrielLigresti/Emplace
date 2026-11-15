# TFG-PGIM

Plataforma web de gestión de restaurantes multi-sucursal: reservas, pedidos, pagos con Mercado Pago, fidelización, stock por recetas, menú con realidad aumentada y simulador de apertura.

## Stack

TypeScript en todo el monorepo (npm workspaces):

- `apps/web`: React, Vite y Tailwind CSS.
- `apps/api`: Node.js, Express, Prisma (PostgreSQL) y Socket.IO.
- `packages/shared`: tipos, esquemas zod y constantes compartidos.
- `docs/modelos`: diagramas UML y DER versionados.

## Requisitos

- Node.js 22 (ver `.nvmrc`).
- Docker, para la base de datos de desarrollo.
- [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/), solo para abrir la app por HTTPS (ver más abajo).

## Puesta en marcha

Después de copiar el `.env`, reemplazar `JWT_SECRET` por una clave propia: el valor de ejemplo pasa la validación, así que la API arranca sin avisar.

```bash
cp apps/api/.env.example apps/api/.env
npm install
npm run db:up
(cd apps/api && npx prisma migrate deploy)
npm run db:seed -w @pgim/api
npm run dev
```

La web queda en http://localhost:5173 y la API en http://localhost:3000. El seed carga datos ficticios: se puede ingresar con `admin@demo.pgim.test` y la contraseña `demo1234`.

### Ingreso con Google (opcional)

Para activar "Continuar con Google" en el login y el registro del comensal, creá un client ID de OAuth (aplicación web) en Google Cloud y cargá el mismo valor en `GOOGLE_CLIENT_ID` de `apps/api/.env` y en `VITE_GOOGLE_CLIENT_ID` de `apps/web/.env` (ver `apps/web/.env.example`). En los orígenes autorizados van `http://localhost` y `http://localhost:5173`. El túnel rápido (`npm run tunnel`) cambia de URL en cada arranque, así que no sirve para Google: para entrar desde otro dispositivo hace falta una URL fija (por ejemplo, un dominio fijo de ngrok) registrada también como origen. Sin client ID, el botón no aparece y el ingreso por email sigue igual.

### HTTPS con un túnel

La cámara (realidad aumentada) solo funciona con HTTPS. Con `npm run dev` corriendo, `npm run tunnel` abre un quick tunnel de Cloudflare hacia la web y muestra una URL `https://*.trycloudflare.com`, distinta en cada arranque. Mientras está abierto, cualquiera con esa URL entra al entorno de desarrollo: levantarlo solo cuando se usa.

## Despliegue en Railway

La app corre como un solo servicio: la API sirve también la web compilada, así que front, API y Socket.IO comparten origen (la cookie de sesión y el tiempo real funcionan igual que en desarrollo). `railway.json` define el build (`npm run build`), las migraciones antes de cada deploy (`prisma migrate deploy`), el arranque (`npm start`) y el health check (`/api/health`).

1. Crear un proyecto desde el repo de GitHub, agregar un servicio de **PostgreSQL** y, en el servicio de la app, un **volumen** montado en `/data`. Generar el dominio en *Settings → Networking*.
2. Cargar las variables del servicio **antes del primer build** (el build corre `prisma generate` y compila la web con `VITE_GOOGLE_CLIENT_ID`):

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `JWT_SECRET` | una clave nueva (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
   | `TRUST_PROXY` | `1` |
   | `WEB_DIST` | `../web/dist` |
   | `UPLOADS_DIR` | `/data/uploads` |
   | `PUBLIC_URL` | la URL pública, por ejemplo `https://<servicio>.up.railway.app` (de ahí sale la URL del webhook de Mercado Pago) |
   | `GOOGLE_CLIENT_ID` y `VITE_GOOGLE_CLIENT_ID` | el mismo client ID de OAuth |
   | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | credenciales de prueba de Mercado Pago |

   **Pagos:** con `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `PUBLIC_URL` cargadas, los pagos van por el checkout de prueba de Mercado Pago (se paga con una cuenta de comprador de prueba) y `PAGO_SIMULADO` se ignora. Para que los pagos se aprueben al instante sin Mercado Pago, no cargar las `MP_*` y poner `PAGO_SIMULADO=true`.

   Si el build no toma Node 22, agregar `RAILPACK_NODE_VERSION=22`. Las migraciones y el seed usan dependencias de desarrollo (`prisma`, `tsx`): si el pre-deploy no encuentra `prisma`, agregar `RAILPACK_PRUNE_DEPS=false`. La instalación (`npm ci`) ya compila `@pgim/shared` y corre `prisma generate`: si falla ahí por `DATABASE_URL`, revisar que la variable esté cargada en el servicio antes del build.
3. Cargar los datos ficticios **dentro del contenedor**, para que los modelos 3D queden en el volumen: `railway ssh` y después `npm run db:seed -w @pgim/api`.
4. Agregar la URL pública a los orígenes autorizados del client ID de Google y, si el webhook está configurado en el panel de Mercado Pago, actualizarlo.

### Pasar a un dominio propio

1. En el servicio, *Settings → Networking → Custom Domain*: cargar el dominio y crear en el DNS el registro CNAME que indica Railway (el certificado se emite solo). Con Cloudflare como DNS, dejar el registro **sin proxy** (nube gris): con el proxy hay un salto más y `TRUST_PROXY` pasaría a `2`.
2. Cambiar `PUBLIC_URL` al dominio nuevo.
3. Agregar el dominio a los orígenes autorizados de Google.
4. Actualizar el webhook de Mercado Pago si está cargado en su panel.

El QR de cada sucursal se arma con la URL desde la que se abre el panel, así que se actualiza solo. Las sesiones abiertas en la URL anterior piden volver a ingresar.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Levanta shared (watch), API y web |
| `npm run tunnel` | Publica la web por HTTPS con un quick tunnel de Cloudflare |
| `npm run build` | Compila los tres paquetes |
| `npm start` | Arranca la API compilada (en producción, con `WEB_DIST`, sirve también la web) |
| `npm test` | Corre los tests (Jest y Supertest) |
| `npm run test:e2e` | Prueba integral con Playwright: prepara la base `pgim_e2e` (migraciones y seed, sin borrar datos), levanta la API y la web, y recorre el camino principal (no entra en `npm test`) |
| `npm run typecheck` | Verifica tipos en todo el monorepo |
| `npm run format` | Formatea con Prettier |
| `npm run db:up` / `db:down` | Levanta o baja PostgreSQL en Docker |
| `npm run db:migrate -w @pgim/api` | Crea y aplica migraciones de Prisma en desarrollo |
| `npm run db:seed -w @pgim/api` | Carga los datos ficticios; se puede repetir sin duplicar filas |
