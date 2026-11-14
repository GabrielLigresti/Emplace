import { useRevelar } from '../../lib/useRevelar';

const claseCifra =
  'text-[clamp(44px,5.6vw,96px)] leading-[0.9] font-semibold tracking-[-0.04em] text-ink tabular-nums';

function Ficha({ fondo, cifra, texto }: { fondo: string; cifra: string; texto: string }) {
  const ref = useRevelar();
  return (
    <div ref={ref} className={`revelar flex flex-col justify-start p-5 md:p-7 ${fondo}`}>
      <p className={claseCifra}>{cifra}</p>
      <p className="mt-3 text-[17px] leading-[26px] text-text">{texto}</p>
    </div>
  );
}

// Rompe la división de la portada: foto y dos cifras a todo el ancho.
export function Evidencia() {
  const ref = useRevelar<HTMLElement>();
  return (
    <section ref={ref} aria-labelledby="titulo-evidencia" className="revelar mt-24 lg:mt-40">
      <div className="grid gap-4 px-4 md:px-8 lg:grid-cols-2 lg:items-end lg:gap-12 lg:px-14">
        <h2
          id="titulo-evidencia"
          className="text-[clamp(38px,3.6vw,56px)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance text-ink"
        >
          Verlo antes cambia lo que pedís
        </h2>
        <p className="max-w-[44ch] text-[17px] leading-[26px] text-text">
          En un experimento de campo, ver el postre sobre la mesa antes de pedirlo hizo que más del
          doble de los comensales lo pidiera.
        </p>
      </div>
      <div className="mt-10 grid overflow-hidden rounded-panel lg:h-[600px] lg:grid-cols-3">
        <img
          src="/fotos-portada/flan-con-frambuesas.jpg"
          alt="Flan con frambuesas y caramelo"
          loading="lazy"
          className="aspect-[4/3] w-full object-cover lg:col-span-2 lg:aspect-auto lg:h-full"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1">
          <Ficha
            fondo="bg-hoja"
            cifra={'41,2\u00a0%'}
            texto="de los comensales pidió postre después de verlo en realidad aumentada."
          />
          <Ficha fondo="bg-panel" cifra={'18\u00a0%'} texto="lo pidió con la carta de siempre." />
        </div>
      </div>
      <p className="mt-4 px-4 text-[14px] leading-5 text-text md:px-8 lg:px-14">
        Experimento de campo de Fritz, Hadi y Stephen (2023).
      </p>
    </section>
  );
}
