import { useEffect, useRef, useState, type PointerEvent } from 'react';
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
  // Mesa movida y todavía sin confirmar: se dibuja con un contorno de acento.
  pendiente?: boolean;
}

export type EstadoMesaDibujo = 'LIBRE' | 'RESERVADA' | 'OCUPADA' | 'INASISTENCIA' | 'CHICA';

// Ancho en px con el que el texto secundario (2,4 del lienzo) mide 12 px.
const ANCHO_MINIMO_PX = 500;

const PUNTEADO = '[stroke-dasharray:1.2_0.8]';

// Colores de mesa según la tabla de estados del sistema visual.
const COLOR: Record<EstadoMesaDibujo, { mesa: string; texto: string }> = {
  LIBRE: { mesa: 'fill-ok-soft stroke-ok', texto: 'fill-ok' },
  RESERVADA: { mesa: `fill-surface stroke-meta ${PUNTEADO}`, texto: 'fill-ink' },
  OCUPADA: { mesa: 'fill-accent-soft stroke-accent', texto: 'fill-accent-ink' },
  INASISTENCIA: { mesa: 'fill-surface stroke-warn', texto: 'fill-warn' },
  CHICA: { mesa: 'fill-surface stroke-meta [stroke-dasharray:1_0.6]', texto: 'fill-meta' },
};
const COLOR_CONFLICTO = { mesa: 'fill-bad-soft stroke-bad', texto: 'fill-bad' };
const COLOR_ATENUADA = { mesa: 'fill-panel stroke-line-strong', texto: 'fill-meta' };
const COLOR_INACTIVA = { mesa: `stroke-meta ${PUNTEADO}`, texto: 'fill-meta' };

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
  conPersonas,
}: {
  estados: EstadoMesaDibujo[];
  inactiva?: boolean;
  vistaComensal?: boolean;
  // Explica «2/4» (personas / capacidad); solo para pantallas que muestran personas.
  conPersonas?: boolean;
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
              className={`stroke-meta ${PUNTEADO}`}
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
                <rect width="0.6" height="2" className="fill-line-strong" />
              </pattern>
            </defs>
          </svg>
          Dada de baja
        </li>
      )}
      {conPersonas && !vistaComensal && <li>2/4 = personas / capacidad</li>}
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
  inactivasElegibles,
  ajustarAncho,
  onMover,
  horaReservada,
  vistaComensal,
  onConflicto,
}: {
  mesas: MesaDibujo[];
  seleccionadaId?: string | null;
  // Hora que se escribe dentro de las mesas reservadas.
  horaReservada?(mesa: MesaDibujo): string | undefined;
  onElegir?(id: string): void;
  // Con esta prop toda mesa no dada de baja es elegible, no solo las libres.
  todasElegibles?: boolean;
  // Con esta prop las mesas dadas de baja también son elegibles (editor del salón).
  inactivasElegibles?: boolean;
  // En pantallas anchas deja que el plano se achique al ancho de su columna.
  ajustarAncho?: boolean;
  onMover?(id: string, posX: number, posY: number): void;
  // Se llama al soltar una mesa sobre otra activa; la mesa vuelve a su lugar.
  onConflicto?(mesa: MesaDibujo, otra: MesaDibujo): void;
  // Plano del comensal: solo número y capacidad, sin hora, personas ni la
  // diferencia entre reservada y ocupada.
  vistaComensal?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [arrastre, setArrastre] = useState<{ id: string; x: number; y: number } | null>(null);
  // Hubo movimiento en el gesto actual: el click que sigue al soltar no elige.
  const huboMovimiento = useRef(false);

  // Gesto en curso: punto de agarre y distancia del puntero al centro de la mesa.
  const gesto = useRef<{
    agarre: { x: number; y: number };
    offset: { x: number; y: number };
    arrastrando: boolean;
  } | null>(null);

  function punteroEnLienzo(e: PointerEvent): { x: number; y: number } | null {
    const matriz = svg.current?.getScreenCTM();
    if (!matriz) return null;
    const punto = new DOMPoint(e.clientX, e.clientY).matrixTransform(matriz.inverse());
    return { x: punto.x, y: punto.y };
  }

  // La mesa en esa posición pisaría a otra mesa activa (las dadas de baja no ocupan lugar).
  function conflictoCon(mesa: MesaDibujo, x: number, y: number): MesaDibujo | undefined {
    if (mesa.inactiva) return undefined;
    const propia = rectanguloMesa({ ...mesa, posX: x, posY: y });
    return mesas.find((otra) => {
      return otra.id !== mesa.id && !otra.inactiva && seSuperponen(propia, rectanguloMesa(otra));
    });
  }

  function alApretar(e: PointerEvent<SVGGElement>, mesa: MesaDibujo) {
    if (!onMover) return;
    const punto = punteroEnLienzo(e);
    if (!punto) return;
    huboMovimiento.current = false;
    gesto.current = {
      agarre: punto,
      offset: { x: mesa.posX - punto.x, y: mesa.posY - punto.y },
      arrastrando: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function alMover(e: PointerEvent<SVGGElement>, mesa: MesaDibujo) {
    if (!gesto.current) return;
    const punto = punteroEnLienzo(e);
    if (!punto) return;
    const { agarre, offset } = gesto.current;
    // Un tap o click con un temblor mínimo no mueve nada.
    if (!gesto.current.arrastrando) {
      if (Math.hypot(punto.x - agarre.x, punto.y - agarre.y) <= 1) return;
      gesto.current.arrastrando = true;
      huboMovimiento.current = true;
    }
    const { ancho, alto } = dimensionesMesa(mesa.capacidad, mesa.vertical);
    // El arrastre nace al superar el umbral: apretar sin mover no pinta conflicto.
    setArrastre({
      id: mesa.id,
      x:
        Math.round(limitar(punto.x + offset.x, ancho / 2, LIENZO_SALON.ancho - ancho / 2) * 10) /
        10,
      y: Math.round(limitar(punto.y + offset.y, alto / 2, LIENZO_SALON.alto - alto / 2) * 10) / 10,
    });
  }

  function cancelarGesto() {
    gesto.current = null;
    setArrastre(null);
  }

  function alSoltar(mesa: MesaDibujo) {
    const arrastrando = gesto.current?.arrastrando;
    cancelarGesto();
    if (!arrastrando || !arrastre) return;
    const movida = arrastre.x !== mesa.posX || arrastre.y !== mesa.posY;
    if (!movida) return;
    const otra = conflictoCon(mesa, arrastre.x, arrastre.y);
    if (otra) onConflicto?.(mesa, otra);
    else onMover?.(mesa.id, arrastre.x, arrastre.y);
  }

  // Sombra en el borde derecho mientras haya plano fuera de pantalla.
  const contenedor = useRef<HTMLDivElement>(null);
  const [masAlaDerecha, setMasAlaDerecha] = useState(false);
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const medir = () => setMasAlaDerecha(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    if (el.firstElementChild) observador.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', medir);
      observador.disconnect();
    };
  }, []);

  // Con el dedo, el navegador decide si un gesto es scroll en el primer
  // movimiento y no respeta touch-action sobre elementos del SVG. Un listener
  // no pasivo cancela el scroll solo si el toque empezó sobre una mesa: el fondo
  // del plano sigue desplazándose y las mesas se arrastran.
  useEffect(() => {
    const el = svg.current;
    if (!el || !onMover) return;
    let sobreMesa = false;
    const alTocar = (e: TouchEvent) => {
      sobreMesa = e.target instanceof Element && e.target.closest('[data-mesa]') !== null;
    };
    const alDesplazar = (e: TouchEvent) => {
      if (sobreMesa && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchstart', alTocar, { passive: true });
    el.addEventListener('touchmove', alDesplazar, { passive: false });
    return () => {
      el.removeEventListener('touchstart', alTocar);
      el.removeEventListener('touchmove', alDesplazar);
    };
  }, [onMover]);

  // Con ajustarAncho el plano puede quedar por debajo de 500 px (columna angosta
  // en pantalla ancha): el texto secundario se agranda para no bajar de 12 px.
  const [anchoPlano, setAnchoPlano] = useState(0);
  useEffect(() => {
    const el = svg.current;
    if (!el || !ajustarAncho) return;
    const medir = () => setAnchoPlano(el.getBoundingClientRect().width);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [ajustarAncho]);
  const escala = ajustarAncho && anchoPlano > 0 ? Math.max(1, ANCHO_MINIMO_PX / anchoPlano) : 1;
  const tamanoSecundario = 2.4 * escala;

  // En el celular el plano no se achica más que esto: así el texto de las
  // mesas no baja de 12 px y el plano se desplaza de costado.
  return (
    <div className="relative overflow-hidden rounded-panel border border-line">
      <div ref={contenedor} className="overflow-x-auto">
        <svg
          ref={svg}
          viewBox={`0 0 ${LIENZO_SALON.ancho} ${LIENZO_SALON.alto}`}
          className={`block w-full min-w-[500px] select-none ${ajustarAncho ? 'lg:min-w-0' : ''} `}
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
              <rect width="0.4" height="1.6" className="fill-line-strong" />
            </pattern>
          </defs>
          <rect width={LIENZO_SALON.ancho} height={LIENZO_SALON.alto} className="fill-surface" />
          {mesas.map((mesa) => {
            const enArrastre = arrastre?.id === mesa.id ? arrastre : null;
            const x = enArrastre?.x ?? mesa.posX;
            const y = enArrastre?.y ?? mesa.posY;
            const conflicto = enArrastre ? Boolean(conflictoCon(mesa, x, y)) : false;
            const estado = estadoVisible(mesa.estado ?? 'LIBRE', vistaComensal);
            const elegible =
              Boolean(onElegir) &&
              (!mesa.inactiva || Boolean(inactivasElegibles)) &&
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
                data-mesa={onMover ? '' : undefined}
                onPointerDown={(e) => alApretar(e, mesa)}
                onPointerMove={(e) => alMover(e, mesa)}
                onPointerUp={() => alSoltar(mesa)}
                onPointerCancel={cancelarGesto}
                onLostPointerCapture={cancelarGesto}
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
                {mesa.pendiente && (
                  <rect
                    x={izquierda - 0.8}
                    y={arriba - 0.8}
                    width={ancho + 1.6}
                    height={alto + 1.6}
                    rx={2.2}
                    className="fill-none stroke-accent"
                    strokeWidth={0.5}
                  />
                )}
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
                  y={hora ? y - alto * 0.3 : y - alto * 0.1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={hora ? 3.6 : 4}
                  className={`font-semibold ${colores.texto}`}
                >
                  {mesa.numero}
                </text>
                {hora && (
                  <text
                    x={x}
                    y={y + alto * 0.06}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={tamanoSecundario}
                    className="fill-meta"
                  >
                    {hora}
                  </text>
                )}
                <text
                  x={x}
                  y={y + alto * (hora ? 0.33 : 0.31)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={tamanoSecundario}
                  className="fill-meta"
                >
                  {personas}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {masAlaDerecha && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8"
          style={{
            background:
              'linear-gradient(to left, color-mix(in srgb, var(--color-ink) 22%, transparent), transparent)',
          }}
        />
      )}
    </div>
  );
}
