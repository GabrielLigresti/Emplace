import { useRevelar } from '../../lib/useRevelar';

const DIENTES = 18;
const ALTO_DIENTE = 10;

// Borde de abajo en zigzag: arriba recto, abajo 18 dientes de 10 px de alto.
function recorteZigzag() {
  const puntos = ['0 0', '100% 0'];
  for (let i = DIENTES; i > 0; i--) {
    const derecha = ((i / DIENTES) * 100).toFixed(3);
    const punta = (((i - 0.5) / DIENTES) * 100).toFixed(3);
    puntos.push(`${derecha}% calc(100% - ${ALTO_DIENTE}px)`, `${punta}% 100%`);
  }
  puntos.push(`0 calc(100% - ${ALTO_DIENTE}px)`);
  return `polygon(${puntos.join(', ')})`;
}

const RECORTE = recorteZigzag();

const GRUPOS: { nombre: string; filas: [string, string][] }[] = [
  {
    nombre: 'Antes de salir',
    filas: [
      ['Buscar por nombre, plato o barrio', 'sin cuenta'],
      ['Mirar la carta', 'sin cuenta'],
      ['Ver el plato sobre tu mesa', 'sin instalar nada'],
    ],
  },
  {
    nombre: 'Para reservar',
    filas: [
      ['Crear tu cuenta', 'una sola vez'],
      ['Elegir día y horario', 'de a una hora'],
    ],
  },
  {
    nombre: 'En el restaurante',
    filas: [
      ['Pedir desde tu mesa', 'con el celular'],
      ['Pagar', 'Mercado Pago'],
    ],
  },
];

function Grupo({ nombre, filas }: { nombre: string; filas: [string, string][] }) {
  const ref = useRevelar();
  return (
    <div ref={ref} className="revelar mt-7 first:mt-0">
      <p className="font-semibold text-ink">{nombre}</p>
      <dl className="mt-2 grid gap-y-3 sm:grid-cols-[1fr_auto] sm:gap-x-6 sm:gap-y-1">
        {filas.map(([paso, dato]) => (
          <div key={paso} className="sm:contents">
            <dt className="text-text">{paso}</dt>
            <dd className="text-meta sm:text-right">{dato}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// El recorrido del visitante, impreso como una comanda.
export function Comanda() {
  const ref = useRevelar<HTMLElement>();
  return (
    <section
      id="recorrido"
      ref={ref}
      aria-labelledby="titulo-recorrido"
      className="revelar mt-24 max-w-[560px]"
    >
      <h2
        id="titulo-recorrido"
        className="text-[clamp(26px,2.2vw,32px)] leading-[1.15] font-semibold tracking-[-0.025em] text-balance text-ink"
      >
        De la búsqueda a la mesa
      </h2>
      <p className="mt-3 text-[17px] leading-[26px] text-text">
        Hasta mirar la carta no te pedimos nada. La cuenta aparece recién cuando querés reservar o
        pedir.
      </p>
      <div
        className="mt-8 bg-surface px-6 pt-6 pb-10 text-[16px] leading-6"
        style={{ clipPath: RECORTE }}
      >
        {GRUPOS.map((g) => (
          <Grupo key={g.nombre} nombre={g.nombre} filas={g.filas} />
        ))}
        <p className="-mx-6 mt-6 bg-ink px-6 py-3 font-semibold text-white">
          Sumás puntos en ese restaurante
        </p>
      </div>
      <p className="mt-4 text-[14px] leading-5 text-text">
        Ver en mi mesa aparece solo en los platos que el restaurante cargó en 3D.
      </p>
    </section>
  );
}
