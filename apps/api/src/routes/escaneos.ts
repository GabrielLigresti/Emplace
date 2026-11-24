import { Router } from 'express';
import { idParamSchema, modeloRaInputSchema, type ModeloRaInput } from '@pgim/shared';
import { autenticar, requierePermiso, tenant, validar, validarParams } from '../middleware/auth';
import { escaneoService } from '../services/escaneo/escaneo.service';

export const escaneosRouter = Router();

escaneosRouter.use(autenticar, tenant);

escaneosRouter.get('/requisitos', requierePermiso('menu.editar'), (_req, res) => {
  res.json(escaneoService.requisitos());
});

escaneosRouter.post(
  '/:id/publicar',
  requierePermiso('menu.editar'),
  validarParams(idParamSchema),
  validar(modeloRaInputSchema),
  async (req, res) => {
    res.json(
      await escaneoService.publicar(
        req.tenant!.restauranteId,
        req.params.id as string,
        req.body as ModeloRaInput,
      ),
    );
  },
);

escaneosRouter.post(
  '/:id/descartar',
  requierePermiso('menu.editar'),
  validarParams(idParamSchema),
  async (req, res) => {
    res.json(await escaneoService.descartar(req.tenant!.restauranteId, req.params.id as string));
  },
);
