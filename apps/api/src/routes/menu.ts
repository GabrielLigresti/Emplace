import express, { Router, type RequestHandler } from 'express';
import multer from 'multer';
import {
  LIMITE_FOTO_MB,
  agregarPlatoMenuSchema,
  VISTAS,
  informeCalidadSchema,
  categoriaInputSchema,
  idParamSchema,
  menuInputSchema,
  modeloRaInputSchema,
  platoInputSchema,
  type AgregarPlatoMenu,
  type CategoriaInput,
  type InformeCalidad,
  type MenuInput,
  type ModeloRaInput,
  type PlatoInput,
} from '@pgim/shared';
import { AppError } from '../lib/errors';
import type { FotosEscaneo } from '../escaneo/proveedor-3d';
import { autenticar, requierePermiso, tenant, validar, validarParams } from '../middleware/auth';
import { escaneoService } from '../services/escaneo/escaneo.service';
import { menuService } from '../services/menu/menu.service';

// Categorías, platos y menús comparten los permisos menu.* (el Jefe de cocina tiene el ABM completo).

export const categoriasRouter = Router();

categoriasRouter.use(autenticar, tenant);

categoriasRouter.get('/', requierePermiso('menu.ver'), async (req, res) => {
  res.json(await menuService.listarCategorias(req.tenant!.restauranteId));
});

categoriasRouter.post(
  '/',
  requierePermiso('menu.crear'),
  validar(categoriaInputSchema),
  async (req, res) => {
    res
      .status(201)
      .json(
        await menuService.crearCategoria(req.tenant!.restauranteId, req.body as CategoriaInput),
      );
  },
);

categoriasRouter.put(
  '/:id',
  requierePermiso('menu.editar'),
  validarParams(idParamSchema),
  validar(categoriaInputSchema),
  async (req, res) => {
    res.json(
      await menuService.actualizarCategoria(
        req.tenant!.restauranteId,
        req.params.id as string,
        req.body as CategoriaInput,
      ),
    );
  },
);

categoriasRouter.delete(
  '/:id',
  requierePermiso('menu.eliminar'),
  validarParams(idParamSchema),
  async (req, res) => {
    await menuService.borrarCategoria(req.tenant!.restauranteId, req.params.id as string);
    res.status(204).end();
  },
);

export const platosRouter = Router();

platosRouter.use(autenticar, tenant);

platosRouter.get('/', requierePermiso('menu.ver'), async (req, res) => {
  res.json(await menuService.listarPlatos(req.tenant!.restauranteId));
});

platosRouter.post(
  '/',
  requierePermiso('menu.crear'),
  validar(platoInputSchema),
  async (req, res) => {
    res
      .status(201)
      .json(await menuService.crearPlato(req.tenant!.restauranteId, req.body as PlatoInput));
  },
);

platosRouter.put(
  '/:id',
  requierePermiso('menu.editar'),
  validarParams(idParamSchema),
  validar(platoInputSchema),
  async (req, res) => {
    res.json(
      await menuService.actualizarPlato(
        req.tenant!.restauranteId,
        req.params.id as string,
        req.body as PlatoInput,
      ),
    );
  },
);

platosRouter.delete(
  '/:id',
  requierePermiso('menu.eliminar'),
  validarParams(idParamSchema),
  async (req, res) => {
    await menuService.desactivarPlato(req.tenant!.restauranteId, req.params.id as string);
    res.status(204).end();
  },
);

// Foto del plato desde la computadora, hasta 5 MB.
const archivoFoto = express.raw({ type: 'application/octet-stream', limit: '5mb' });

platosRouter.put(
  '/:id/foto',
  requierePermiso('menu.editar'),
  validarParams(idParamSchema),
  archivoFoto,
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'Falta la foto' });
      return;
    }
    res.json(
      await menuService.subirFoto(req.tenant!.restauranteId, req.params.id as string, req.body),
    );
  },
);

// Escaneo del plato: 4 fotos JPEG (una por vista) y el informe de calidad del
// navegador, en un multipart. Todo queda en memoria hasta que el servicio lo valida.
const subirFotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_FOTO_MB * 1024 * 1024, files: VISTAS.length, fields: 1 },
}).fields(VISTAS.map((name) => ({ name, maxCount: 1 })));

const recibirFotos: RequestHandler = (req, res, next) => {
  subirFotos(req, res, (err?: unknown) => {
    if (err instanceof multer.MulterError) {
      next(
        err.code === 'LIMIT_FILE_SIZE'
          ? new AppError(413, `Cada foto puede pesar hasta ${LIMITE_FOTO_MB} MB`)
          : new AppError(400, 'Las fotos del escaneo no son válidas'),
      );
      return;
    }
    next(err);
  });
};

function leerInforme(valor: unknown): InformeCalidad {
  try {
    if (typeof valor !== 'string') throw new Error('sin informe');
    return informeCalidadSchema.parse(JSON.parse(valor));
  } catch {
    throw new AppError(422, 'Falta el informe de calidad de las fotos');
  }
}

platosRouter.post(
  '/:id/escaneos',
  requierePermiso('menu.editar'),
  validarParams(idParamSchema),
  recibirFotos,
  async (req, res) => {
    const archivos = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
    if (VISTAS.some((v) => !archivos[v]?.[0] || archivos[v][0].size === 0)) {
      res.status(400).json({ error: 'Faltan fotos' });
      return;
    }
    const informe = leerInforme((req.body as Record<string, unknown> | undefined)?.informe);
    const fotos = Object.fromEntries(
      VISTAS.map((v) => [v, archivos[v]![0]!.buffer]),
    ) as FotosEscaneo;
    res
      .status(201)
      .json(
        await escaneoService.crear(
          req.tenant!.restauranteId,
          req.params.id as string,
          req.sesion!.usuario.id,
          fotos,
          informe,
        ),
      );
  },
);

platosRouter.get(
  '/:id/escaneo',
  requierePermiso('menu.editar'),
  validarParams(idParamSchema),
  async (req, res) => {
    res.json(await escaneoService.ultimo(req.tenant!.restauranteId, req.params.id as string));
  },
);

platosRouter.put(
  '/:id/modelo-ra',
  requierePermiso('menu.editar'),
  validarParams(idParamSchema),
  validar(modeloRaInputSchema),
  async (req, res) => {
    res.json(
      await menuService.actualizarDatosModelo(
        req.tenant!.restauranteId,
        req.params.id as string,
        req.body as ModeloRaInput,
      ),
    );
  },
);

platosRouter.delete(
  '/:id/modelo-ra',
  requierePermiso('menu.editar'),
  validarParams(idParamSchema),
  async (req, res) => {
    await menuService.quitarModelo(req.tenant!.restauranteId, req.params.id as string);
    res.status(204).end();
  },
);

export const menusRouter = Router();

menusRouter.use(autenticar, tenant);

menusRouter.get('/', requierePermiso('menu.ver'), async (req, res) => {
  res.json(await menuService.listarMenus(req.tenant!.restauranteId));
});

menusRouter.post('/', requierePermiso('menu.crear'), validar(menuInputSchema), async (req, res) => {
  res
    .status(201)
    .json(await menuService.crearMenu(req.tenant!.restauranteId, req.body as MenuInput));
});

menusRouter.put(
  '/:id',
  requierePermiso('menu.editar'),
  validarParams(idParamSchema),
  validar(menuInputSchema),
  async (req, res) => {
    res.json(
      await menuService.actualizarMenu(
        req.tenant!.restauranteId,
        req.params.id as string,
        req.body as MenuInput,
      ),
    );
  },
);

menusRouter.post(
  '/:id/platos',
  requierePermiso('menu.editar'),
  validarParams(idParamSchema),
  validar(agregarPlatoMenuSchema),
  async (req, res) => {
    const { platoId } = req.body as AgregarPlatoMenu;
    res.json(
      await menuService.agregarPlatoAMenu(
        req.tenant!.restauranteId,
        req.params.id as string,
        platoId,
      ),
    );
  },
);

menusRouter.delete(
  '/:id',
  requierePermiso('menu.eliminar'),
  validarParams(idParamSchema),
  async (req, res) => {
    await menuService.borrarMenu(req.tenant!.restauranteId, req.params.id as string);
    res.status(204).end();
  },
);
