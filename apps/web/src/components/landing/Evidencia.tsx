import { useRevelar } from '../../lib/useRevelar';

const claseCifra =
  'text-[clamp(44px,5.6vw,96px)] leading-[0.9] font-semibold tracking-[-0.04em] text-ink tabular-nums';

function Ficha({ fondo, cifra, texto }: { fondo: string; cifra: string; texto: string }) {
  const ref = useRevelar();
  return (
    <div ref={ref} className={`revelar flex flex-col justify-between gap-6 p-5 md:p-7 ${fondo}`}>
      <p className={claseCifra}>{cifra}</p>
      <p className="text-base leading-6 text-text md:text-[17px] md:leading-[26px]">{texto}</p>
    </div>
  );
}

// Rompe la división de la portada: foto y dos cifras a todo el ancho.
export function Evidencia() {
  const ref = useRevelar<HTMLElement>();
  return (
    <section ref={ref} aria-labelledby="titulo-evidencia" className="revelar mt-24 lg:mt-40">
      <h2
        id="titulo-evidencia"
        className="px-1 text-[clamp(28px,3.2vw,48px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-ink md:px-5 lg:px-11"
      >
        Verlo antes cambia lo que pedís
      </h2>
      <div className="mt-10 grid overflow-hidden rounded-panel lg:h-[600px] lg:grid-cols-3">
        <img
          src="/fotos-demo/grandes/flan-casero.jpg"
          alt="Flan casero servido en un plato"
          loading="lazy"
          className="aspect-[4/3] w-full object-cover lg:col-span-2 lg:aspect-auto lg:h-full"
        />
        <div className="grid grid-cols-2 lg:grid-cols-1">
          <Ficha
            fondo="bg-hoja"
            cifra={'41,2\u00a0%'}
            texto="de los comensales pidió postre después de verlo en realidad aumentada."
          />
          <Ficha fondo="bg-panel" cifra={'18\u00a0%'} texto="lo pidió con la carta de siempre." />
        </div>
      </div>
      <p className="mt-4 px-1 text-sm text-meta md:px-5 lg:px-11">
        Experimento de campo de Fritz, Hadi y Stephen (2023).
      </p>
    </section>
  );
}
