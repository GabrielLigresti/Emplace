import type {
  CriterioId,
  FotoInforme,
  InformeCalidad as Informe,
  NivelCalidad,
  VistaEscaneo,
} from '@pgim/shared';
import { Etiqueta } from '../../components/ui';
import { infoEstado, type Tono } from '../../lib/estados';

export const NOMBRES_VISTA: Record<VistaEscaneo, string> = {
  front: 'Frente',
  left: 'Izquierda',
  back: 'Atrás',
  right: 'Derecha',
};

const NOMBRES: Record<CriterioId, string> = {
  RESOLUCION: 'Tamaño de la foto',
  NITIDEZ: 'Nitidez',
  EXPOSICION: 'Luz',
  BRILLOS: 'Reflejos',
  ANGULO: 'Ángulo',
};

const TITULOS: Record<NivelCalidad, string> = {
  OK: 'Las fotos están listas para enviar',
  ADVERTENCIA: 'Podés enviarlas, pero revisá esto',
  RECHAZO: 'Hay que escanear de nuevo',
};

const COLOR_ICONO: Record<Tono, string> = {
  neutro: 'text-meta',
  acento: 'text-accent',
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
};

const ORDEN: Record<NivelCalidad, number> = { OK: 0, ADVERTENCIA: 1, RECHAZO: 2 };

function nivelDeFoto(foto: FotoInforme): NivelCalidad {
  return foto.criterios.reduce<NivelCalidad>(
    (peor, c) => (ORDEN[c.nivel] > ORDEN[peor] ? c.nivel : peor),
    'OK',
  );
}

// Resultado de revisar las 4 fotos: un título según el peor nivel y una tarjeta por
// foto, con la miniatura si se la pasan y solo los criterios que no salieron bien.
export function InformeCalidad({
  informe,
  miniaturas,
}: {
  informe: Informe;
  miniaturas?: Record<VistaEscaneo, string>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-ink">{TITULOS[informe.nivelGlobal]}</h3>
      <ul className="grid grid-cols-2 gap-3">
        {informe.fotos.map((foto) => {
          const nivel = nivelDeFoto(foto);
          const { etiqueta, tono, icono: Icono } = infoEstado('calidad', nivel);
          const observados = foto.criterios.filter((c) => c.nivel !== 'OK');
          return (
            <li key={foto.vista} className="min-w-0 space-y-2">
              {miniaturas && (
                <img
                  src={miniaturas[foto.vista]}
                  alt={`Foto ${NOMBRES_VISTA[foto.vista].toLowerCase()}`}
                  className="aspect-[3/4] w-full rounded-control bg-panel object-cover"
                />
              )}
              <div className="flex items-center gap-2">
                <Icono
                  aria-hidden
                  className={`size-4 shrink-0 ${COLOR_ICONO[tono]}`}
                  strokeWidth={2.4}
                />
                <p className="min-w-0 flex-1 text-sm font-medium text-text">
                  {NOMBRES_VISTA[foto.vista]}
                </p>
                <Etiqueta tono={tono}>{etiqueta}</Etiqueta>
              </div>
              {observados.map((c) => (
                <p key={c.criterio} className="text-sm text-meta">
                  <span className="font-medium text-text">{NOMBRES[c.criterio]}: </span>
                  {c.mensaje ?? infoEstado('calidad', c.nivel).etiqueta}
                </p>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
