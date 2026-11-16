import { useRef, useState, type PointerEvent } from 'react';
import { LIENZO_SALON, dimensionesMesa, rectanguloMesa, seSuperponen } from '@pgim/shared';

export interface MesaDibujo {
  id: string;
  numero: number;
  capacidad: number;
  // Centro de la mesa en el lienzo.
  posX: number;
  posY: number;
  vertical?: boolean;
  // Personas de la reserva o consumo en curso; se escribe como personas/capacidad.
  personas?: number;
  estado?: EstadoMesaDibujo;
  inactiva?: boolean;
  // Mesa fuera del filtro activo: se dibuja en gris y no se puede elegir.
  atenuada?: boolean;
}

export type EstadoMesaDibujo = 'LIBRE' | 'RESERVADA' | 'OCUPADA' | 'INASISTENCIA' | 'CHICA';

const PUNTEADO = '[stroke-dasharray:1.2_0.8]';

// Colores de mesa según la tabla de estados del sistema visual.
const COLOR: Record<EstadoMesaDibujo, { mesa: string; texto: string }> = {
  LIBRE: { mesa: 'fill-ok-soft stroke-ok', texto: 'fill-ok' },
  RESERVADA: { mesa: `fill-surface stroke-meta ${PUNTEADO}`, texto: 'fill-ink' },
  OCUPADA: { mesa: 'fill-accent-soft stroke-accent', texto: 'fill-accent-ink' },
  INASISTENCIA: { mesa: 'fill-surface stroke-warn', texto: 'fill-warn' },
  CHICA: { mesa: 'fill-surface stroke-line-strong [stroke-dasharray:1_0.6]', texto: 'fill-meta' },
};
const COLOR_CONFLICTO = { mesa: 'fill-bad-soft stroke-bad', texto: 'fill-bad' };
const COLOR_ATENUADA = { mesa: 'fill-panel stroke-line-strong', texto: 'fill-meta' };
const COLOR_INACTIVA = { mesa: `stroke-line-strong ${PUNTEADO}`, texto: 'fill-meta' };

const NOMBRE: Record<EstadoMesaDibujo, string> = {
  LIBRE: 'Libre',
  RESERVADA: 'Reservada',
  OCUPADA: 'Ocupada',
  INASISTENCIA: 'Inasistencia',
  CHICA: 'Chica para el grupo',
};

// El comensal no distingue reservada de ocupada: para él ambas son "No disponible".
function estadoVisible(estado: EstadoMesaDibujo, vistaComensal?: boolean): EstadoMesaDibujo {
  if (!vistaComensal || estado === 'LIBRE' || estado === 'CHICA') return estado;
  return 'RESERVADA';
}

function nombreEstado(estado: EstadoMesaDibujo, vistaComensal?: boolean) {
  return vistaComensal && estado === 'RESERVADA' ? 'No disponible' : NOMBRE[estado];
}

// Referencias de color del plano; se muestran solo los estados que la pantalla usa.
export function LeyendaSalon({
  estados,
  inactiva,
  vistaComensal,
}: {
  estados: EstadoMesaDibujo[];
  inactiva?: boolean;
  vistaComensal?: boolean;
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-meta">
      {estados.map((e) => (
        <li key={e} className="flex items-center gap-1.5">
          <svg viewBox="0 0 10 10" className="size-3.5" aria-hidden>
            <rect
              x={0.8}
              y={2}
              width={8.4}
              height={6}
              rx={1.2}
              strokeWidth={1.2}
              className={COLOR[e].mesa}
            />
          </svg>
          {nombreEstado(e, vistaComensal)}
        </li>
      ))}
      {inactiva && (
        <li className="flex items-center gap-1.5">
          <svg viewBox="0 0 10 10" className="size-3.5" aria-hidden>
            <rect
              x={0.8}
              y={2}
              width={8.4}
              height={6}
              rx={1.2}
              strokeWidth={1.2}
              fill="url(#rayado-leyenda)"
              className={`stroke-line-strong ${PUNTEADO}`}
            />
            <defs>
              <pattern
                id="rayado-leyenda"
                width="2"
                height="2"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="2" height="2" className="fill-panel" />
                <rect width="0.8" height="2" className="fill-line-strong" />
              </pattern>
            </defs>
          </svg>
          Dada de baja
        </li>
      )}
    </ul>
  );
}

function limitar(valor: number, min: number, max: number) {
  return Math.min(Math.max(valor, min), max);
}

// Plano del salón sobre el lienzo lógico de 100 × 60 (CU-14). Cada mesa es un
// rectángulo cuyo tamaño sale de su capacidad. Con onMover las mesas se
// arrastran con mouse o con el dedo y la posición (el centro) se informa al
// soltar, salvo que choque con otra mesa activa; con onElegir se pueden tocar
// las mesas libres (CU-03), o todas las no dadas de baja con todasElegibles.
export function MapaSalon({
  mesas,
  seleccionadaId,
  onElegir,
  todasElegibles,
  ajustarAncho,
  onMover,
  horaReservada,
  vistaComensal,
}: {
  mesas: MesaDibujo[];
  seleccionadaId?: string | null;
  // Hora que se escribe dentro de las mesas reservadas.
  horaReservada?(mesa: MesaDibujo): string | undefined;
  onElegir?(id: string): void;
  // Con esta prop toda mesa no dada de baja es elegible, no solo las libres.
  todasElegibles?: boolean;
  // En pantallas anchas deja que el plano se achique al ancho de su columna.
  ajustarAncho?: boolean;
  onMover?(id: string, posX: number, posY: number): void;
  // Plano del comensal: solo número y capacidad, sin hora, personas ni la
  // diferencia entre reservada y ocupada.
  vistaComensal?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [arrastre, setArrastre] = useState<{ id: string; x: number; y: number } | null>(null);
  // Hubo movimiento en el gesto actual: el click que sigue al soltar no elige.
  const huboMovimiento = useRef(false);

  function aLienzo(e: PointerEvent, mesa: MesaDibujo): { x: number; y: number } | null {
    const matriz = svg.current?.getScreenCTM();
    if (!matriz) return null;
    const punto = new DOMPoint(e.clientX, e.clientY).matrixTransform(matriz.inverse());
    const { ancho, alto } = dimensionesMesa(mesa.capacidad, mesa.vertical);
    return {
      x: Math.round(limitar(punto.x, ancho / 2, LIENZO_SALON.ancho - ancho / 2) * 10) / 10,
      y: Math.round(limitar(punto.y, alto / 2, LIENZO_SALON.alto - alto / 2) * 10) / 10,
    };
  }

  // La mesa en esa posición pisaría a otra mesa activa (las dadas de baja no ocupan lugar).
  function hayConflicto(mesa: MesaDibujo, x: number, y: number) {
    if (mesa.inactiva) return false;
    const propia = rectanguloMesa({ ...mesa, posX: x, posY: y });
    return mesas.some((otra) => {
      return otra.id !== mesa.id && !otra.inactiva && seSuperponen(propia, rectanguloMesa(otra));
    });
  }

  function alApretar(e: PointerEvent<SVGGElement>, mesa: MesaDibujo) {
    if (!onMover) return;
    huboMovimiento.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastre({ id: mesa.id, x: mesa.posX, y: mesa.posY });
  }

  function alMover(e: PointerEvent<SVGGElement>, mesa: MesaDibujo) {
    if (!arrastre) return;
    const punto = aLienzo(e, mesa);
    if (!punto) return;
    if (punto.x !== mesa.posX || punto.y !== mesa.posY) huboMovimiento.current = true;
    setArrastre({ ...arrastre, ...punto });
  }

  function alSoltar(mesa: MesaDibujo) {
    if (!arrastre) return;
    setArrastre(null);
    const movida = arrastre.x !== mesa.posX || arrastre.y !== mesa.posY;
    if (movida && !hayConflicto(mesa, arrastre.x, arrastre.y)) {
      onMover?.(mesa.id, arrastre.x, arrastre.y);
    }
  }

  // En el celular el plano no se achica más que esto: así el texto de las
  // mesas no baja de 12 px y el plano se desplaza de costado.
  return (
    <div className="overflow-x-auto rounded-panel border border-line">
      <svg
        ref={svg}
        viewBox={`0 0 ${LIENZO_SALON.ancho} ${LIENZO_SALON.alto}`}
        className={`block w-full min-w-[500px] select-none ${ajustarAncho ? 'lg:min-w-0' : ''} ${onMover ? 'touch-none' : ''}`}
        role={onElegir ? 'group' : 'img'}
        aria-label="Mapa del salón"
      >
        <defs>
          <pattern
            id="rayado-mesa"
            width="1.6"
            height="1.6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="1.6" height="1.6" className="fill-panel" />
            <rect width="0.6" height="1.6" className="fill-line-strong" />
          </pattern>
        </defs>
        <rect width={LIENZO_SALON.ancho} height={LIENZO_SALON.alto} className="fill-surface" />
        {mesas.map((mesa) => {
          const enArrastre = arrastre?.id === mesa.id ? arrastre : null;
          const x = enArrastre?.x ?? mesa.posX;
          const y = enArrastre?.y ?? mesa.posY;
          const conflicto = enArrastre ? hayConflicto(mesa, x, y) : false;
          const estado = estadoVisible(mesa.estado ?? 'LIBRE', vistaComensal);
          const elegible =
            Boolean(onElegir) &&
            !mesa.inactiva &&
            !mesa.atenuada &&
            (todasElegibles || estado === 'LIBRE');
          const seleccionada = mesa.id === seleccionadaId;
          const { ancho, alto } = dimensionesMesa(mesa.capacidad, mesa.vertical);
          const izquierda = x - ancho / 2;
          const arriba = y - alto / 2;
          // La hora ocupa una línea más: solo se escribe si la mesa tiene alto para tres.
          const hora =
            !vistaComensal && estado === 'RESERVADA' && alto >= 10
              ? horaReservada?.(mesa)
              : undefined;
          const personas =
            !vistaComensal && mesa.personas !== undefined
              ? `${mesa.personas}/${mesa.capacidad}`
              : `${mesa.capacidad} p.`;
          const colores = conflicto
            ? COLOR_CONFLICTO
            : mesa.inactiva
              ? COLOR_INACTIVA
              : mesa.atenuada
                ? COLOR_ATENUADA
                : COLOR[estado];
          return (
            <g
              key={mesa.id}
              className={`group outline-none ${
                onMover ? 'cursor-grab' : elegible ? 'cursor-pointer' : ''
              }`}
              onPointerDown={(e) => alApretar(e, mesa)}
              onPointerMove={(e) => alMover(e, mesa)}
              onPointerUp={() => alSoltar(mesa)}
              onPointerCancel={() => setArrastre(null)}
              onClick={
                elegible
                  ? () => {
                      if (huboMovimiento.current) {
                        huboMovimiento.current = false;
                        return;
                      }
                      onElegir?.(mesa.id);
                    }
                  : undefined
              }
              onKeyDown={
                elegible
                  ? (e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      onElegir?.(mesa.id);
                    }
                  : undefined
              }
              tabIndex={elegible ? 0 : undefined}
              role={elegible ? 'button' : undefined}
              aria-label={`Mesa ${mesa.numero}, ${mesa.capacidad} personas${
                mesa.inactiva
                  ? ', dada de baja'
                  : `, ${nombreEstado(estado, vistaComensal).toLowerCase()}`
              }`}
              aria-pressed={elegible ? seleccionada : undefined}
            >
              {/* La selección se marca con un contorno oscuro separado, distinto del acento de ocupada. */}
              {seleccionada && (
                <rect
                  x={izquierda - 1.3}
                  y={arriba - 1.3}
                  width={ancho + 2.6}
                  height={alto + 2.6}
                  rx={2.6}
                  className="fill-none stroke-ink"
                  strokeWidth={0.6}
                />
              )}
              <rect
                x={izquierda - 1.3}
                y={arriba - 1.3}
                width={ancho + 2.6}
                height={alto + 2.6}
                rx={2.6}
                strokeWidth={0.6}
                className="fill-none stroke-accent opacity-0 group-focus-visible:opacity-100"
              />
              <rect
                x={izquierda}
                y={arriba}
                width={ancho}
                height={alto}
                rx={1.6}
                strokeWidth={0.4}
                className={colores.mesa}
                fill={mesa.inactiva && !conflicto ? 'url(#rayado-mesa)' : undefined}
              />
              <text
                x={x}
                y={hora ? y - alto * 0.2 : y - alto * 0.1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={4}
                className={`font-semibold ${colores.texto}`}
              >
                {mesa.numero}
              </text>
              {hora && (
                <text
                  x={x}
                  y={y + alto * 0.12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={2.2}
                  className="fill-meta"
                >
                  {hora}
                </text>
              )}
              <text
                x={x}
                y={y + alto * 0.31}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={2.4}
                className="fill-meta"
              >
                {personas}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
