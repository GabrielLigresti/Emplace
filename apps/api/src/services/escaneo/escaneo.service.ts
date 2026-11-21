import {
  CRITERIOS_FOTO,
  LIMITE_MODELO_MB,
  VISTAS,
  type Escaneo,
  type InformeCalidad,
  type ModeloRaInput,
  type UmbralesCalidad,
} from '@pgim/shared';
import { env } from '../../config/env';
import { estadoDeEscaneo, ESTADOS_ESCANEO_ACTIVOS } from '../../domain/escaneo/escaneo';
import type { FotosEscaneo, Proveedor3D, ResultadoEscaneo } from '../../escaneo/proveedor-3d';
import { registroProveedores, type RegistroProveedores } from '../../escaneo/registro';
import * as archivosModelo from '../../lib/archivos-modelo';
import * as archivosFotos from '../../lib/archivos-fotos';
import { AppError, esClaveDuplicada } from '../../lib/errors';
import { leerDimensionesJpeg } from '../../lib/jpeg';
import {
  escaneoRepository,
  type EscaneoRepository,
  type FilaEscaneo,
} from '../../repositories/escaneo.repository';
import { menuRepository, type MenuRepository } from '../../repositories/menu.repository';

export interface DependenciasEscaneo {
  menu: Pick<MenuRepository, 'buscarPlato'>;
  fotos: Pick<typeof archivosFotos, 'guardarFotos' | 'leerFotos' | 'borrarFotos'>;
  modelos: Pick<
    typeof archivosModelo,
    'validarGlb' | 'validarUsdz' | 'guardarModelo' | 'borrarModelo'
  >;
  proveedores: RegistroProveedores;
  ahora: () => Date;
  timeoutMin: number;
}

// Diferencia tolerada entre el informe del navegador y el JPEG que llegó.
const TOLERANCIA_PX = 2;

const ESCANEO_EN_CURSO = 'Este plato ya tiene un escaneo en curso';

export function aEscaneo(fila: FilaEscaneo): Escaneo {
  return {
    id: fila.id,
    platoId: fila.itemMenuId,
    estado: fila.estado,
    urlModelo: fila.urlModelo,
    urlModeloIos: fila.urlModeloIos,
    error: fila.error,
    creadoEn: fila.creadoEn.toISOString(),
    actualizadoEn: fila.actualizadoEn.toISOString(),
  };
}

export function createEscaneoService(repo: EscaneoRepository, deps: DependenciasEscaneo) {
  async function obtener(restauranteId: string, id: string) {
    const fila = await repo.buscar(restauranteId, id);
    if (!fila) throw new AppError(404, 'El escaneo no existe');
    return fila;
  }

  // Un borrado que falla no revierte lo ya confirmado: queda un archivo huérfano.
  async function borrarArchivo(url: string | null | undefined) {
    if (!url) return;
    try {
      await deps.modelos.borrarModelo(url);
    } catch (e) {
      console.error('No se pudo borrar el modelo del escaneo', url, e);
    }
  }

  // El informe tiene que traer las 4 vistas, cada una con los 5 criterios.
  function informeCompleto(informe: InformeCalidad) {
    const vistas = informe.fotos.map((f) => f.vista);
    if (informe.fotos.length !== VISTAS.length || VISTAS.some((v) => !vistas.includes(v))) {
      return false;
    }
    return informe.fotos.every((f) => {
      const criterios = f.criterios.map((c) => c.criterio);
      return (
        criterios.length === CRITERIOS_FOTO.length &&
        CRITERIOS_FOTO.every((c) => criterios.includes(c))
      );
    });
  }

  // Cada JPEG tiene que ser legible, cumplir el piso del proveedor y coincidir con el informe.
  function verificarFotos(fotos: FotosEscaneo, informe: InformeCalidad, ladoMenorMinPx: number) {
    for (const foto of informe.fotos) {
      const real = leerDimensionesJpeg(fotos[foto.vista]);
      const difiere =
        Math.min(real.ancho, real.alto) < ladoMenorMinPx ||
        Math.abs(real.ancho - foto.ancho) > TOLERANCIA_PX ||
        Math.abs(real.alto - foto.alto) > TOLERANCIA_PX;
      if (difiere) throw new AppError(422, 'El informe de calidad no corresponde a estas fotos');
    }
  }

  // Un borrado que falla no revierte el cambio de estado: queda una carpeta huérfana.
  async function borrarFotos(ruta: string | null) {
    if (!ruta) return;
    try {
      await deps.fotos.borrarFotos(ruta);
    } catch (e) {
      console.error('No se pudieron borrar las fotos del escaneo', ruta, e);
    }
  }

  // Pasa a FALLIDO con el motivo; las fotos ya no hacen falta y se descarta con la fila.
  async function fallar(fila: FilaEscaneo, motivo: string) {
    const estado = estadoDeEscaneo(fila.estado).fallar();
    const cambio = await repo.cambiarEstado(fila.restauranteId, fila.id, fila.estado, {
      estado,
      error: motivo,
      rutaFotos: null,
    });
    if (cambio) await borrarFotos(fila.rutaFotos);
  }

  async function enviar(fila: FilaEscaneo, proveedor: Proveedor3D) {
    let tareaProveedorId: string;
    try {
      if (!fila.rutaFotos) throw new Error('El escaneo no tiene fotos');
      const fotos = await deps.fotos.leerFotos(fila.rutaFotos);
      tareaProveedorId = await proveedor.iniciar(fotos);
    } catch (e) {
      console.error('No se pudieron enviar las fotos del escaneo', fila.id, e);
      return fallar(fila, 'No pudimos enviar las fotos');
    }
    const estado = estadoDeEscaneo(fila.estado).enviar();
    await repo.cambiarEstado(fila.restauranteId, fila.id, fila.estado, {
      estado,
      tareaProveedorId,
    });
  }

  async function completar(
    fila: FilaEscaneo,
    resultado: Extract<ResultadoEscaneo, { estado: 'LISTO' }>,
  ) {
    try {
      if (resultado.glb.length > LIMITE_MODELO_MB * 1024 * 1024) {
        throw new AppError(400, `El modelo supera el límite de ${LIMITE_MODELO_MB} MB`);
      }
      deps.modelos.validarGlb(resultado.glb);
      if (resultado.usdz) deps.modelos.validarUsdz(resultado.usdz);
    } catch (e) {
      if (e instanceof AppError) {
        console.error('El modelo del escaneo no es válido', fila.id, e);
        return fallar(fila, 'No pudimos armar el modelo con estas fotos');
      }
      throw e;
    }
    const estado = estadoDeEscaneo(fila.estado).completar();
    const guardados: string[] = [];
    let cambio = false;
    try {
      const urlModelo = await deps.modelos.guardarModelo(resultado.glb, 'glb');
      guardados.push(urlModelo);
      const urlModeloIos = resultado.usdz
        ? await deps.modelos.guardarModelo(resultado.usdz, 'usdz')
        : null;
      if (urlModeloIos) guardados.push(urlModeloIos);
      cambio = await repo.cambiarEstado(fila.restauranteId, fila.id, fila.estado, {
        estado,
        urlModelo,
        urlModeloIos,
        rutaFotos: null,
      });
    } finally {
      // Si algo falló o el escaneo ya cambió de estado, los archivos no los usa nadie.
      if (!cambio) for (const url of guardados) await borrarArchivo(url);
    }
    if (cambio) await borrarFotos(fila.rutaFotos);
  }

  async function consultar(fila: FilaEscaneo, proveedor: Proveedor3D) {
    if (!fila.tareaProveedorId) return fallar(fila, 'No pudimos recuperar el escaneo');
    const resultado = await proveedor.consultar(fila.tareaProveedorId);
    if (resultado.estado === 'LISTO') return completar(fila, resultado);
    if (resultado.estado === 'FALLIDO') return fallar(fila, resultado.motivo);
  }

  async function procesar(fila: FilaEscaneo) {
    // actualizadoEn es el momento del último cambio de estado: nada más toca la fila.
    // El vencimiento se evalúa antes de tocar al proveedor, así nada queda trabado.
    const vencido =
      deps.ahora().getTime() - fila.actualizadoEn.getTime() > deps.timeoutMin * 60_000;
    if (vencido) return fallar(fila, 'El escaneo tardó demasiado');
    const proveedor = deps.proveedores.buscar(fila.proveedor);
    if (fila.estado === 'PENDIENTE') return enviar(fila, proveedor);
    if (fila.estado === 'PROCESANDO') return consultar(fila, proveedor);
  }

  return {
    requisitos(): UmbralesCalidad {
      return deps.proveedores.activo().requisitos();
    },

    async crear(
      restauranteId: string,
      platoId: string,
      empleadoId: string,
      fotos: FotosEscaneo,
      informe: InformeCalidad,
    ): Promise<Escaneo> {
      const plato = await deps.menu.buscarPlato(restauranteId, platoId);
      if (!plato) throw new AppError(404, 'El plato no existe');
      if (plato.diametroCm == null) {
        throw new AppError(422, 'Cargá el diámetro del plato para escanearlo');
      }
      // El nivel global lo calcula el navegador: no se le cree si los criterios dicen otra cosa.
      if (!informeCompleto(informe)) {
        throw new AppError(422, 'El informe de calidad está incompleto');
      }
      if (
        informe.nivelGlobal === 'RECHAZO' ||
        informe.fotos.some((f) => f.criterios.some((c) => c.nivel === 'RECHAZO'))
      ) {
        throw new AppError(422, 'Las fotos no pasaron la revisión de calidad');
      }
      const proveedor = deps.proveedores.activo();
      verificarFotos(fotos, informe, proveedor.requisitos().ladoMenorMinPx);

      const ultimo = await repo.ultimoDelPlato(restauranteId, platoId);
      if (ultimo && ESTADOS_ESCANEO_ACTIVOS.includes(ultimo.estado)) {
        throw new AppError(409, ESCANEO_EN_CURSO);
      }

      const rutaFotos = await deps.fotos.guardarFotos(fotos);
      try {
        const fila = await repo.crear({
          restauranteId,
          itemMenuId: platoId,
          empleadoId,
          proveedor: proveedor.nombre,
          rutaFotos,
          calidad: informe,
        });
        return aEscaneo(fila);
      } catch (e) {
        // Dos altas simultáneas: el índice único deja pasar una sola.
        await deps.fotos.borrarFotos(rutaFotos);
        if (esClaveDuplicada(e)) throw new AppError(409, ESCANEO_EN_CURSO);
        throw e;
      }
    },

    async ultimo(restauranteId: string, platoId: string): Promise<Escaneo | null> {
      const fila = await repo.ultimoDelPlato(restauranteId, platoId);
      return fila && aEscaneo(fila);
    },

    async publicar(restauranteId: string, id: string, datos: ModeloRaInput): Promise<Escaneo> {
      const fila = await obtener(restauranteId, id);
      estadoDeEscaneo(fila.estado).publicar();
      const resultado = await repo.publicar(restauranteId, id, datos);
      if (!resultado) throw new AppError(409, 'El escaneo ya está publicado o descartado');
      // Después del commit: el modelo anterior (y su .usdz) ya no lo usa nadie.
      await borrarArchivo(resultado.anterior?.urlModelo);
      await borrarArchivo(resultado.anterior?.urlModeloIos);
      return aEscaneo(await obtener(restauranteId, id));
    },

    async descartar(restauranteId: string, id: string): Promise<Escaneo> {
      const fila = await obtener(restauranteId, id);
      const siguiente = estadoDeEscaneo(fila.estado).descartar();
      const cambio = await repo.cambiarEstado(restauranteId, id, fila.estado, {
        estado: siguiente,
      });
      if (!cambio) throw new AppError(409, 'El escaneo ya está publicado o descartado');
      await borrarArchivo(fila.urlModelo);
      await borrarArchivo(fila.urlModeloIos);
      return aEscaneo(await obtener(restauranteId, id));
    },

    // Tarea de sistema: avanza los escaneos PENDIENTE y PROCESANDO de todos los restaurantes.
    async procesarEnCurso(): Promise<void> {
      for (const fila of await repo.enCurso()) {
        try {
          await procesar(fila);
        } catch (e) {
          console.error('No se pudo procesar el escaneo', fila.id, e);
        }
      }
    },
  };
}

export const escaneoService = createEscaneoService(escaneoRepository, {
  menu: menuRepository,
  fotos: archivosFotos,
  modelos: archivosModelo,
  proveedores: registroProveedores,
  ahora: () => new Date(),
  timeoutMin: env.ESCANEO_TIMEOUT_MIN,
});
