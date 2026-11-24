import { useState, type FormEvent } from 'react';
import type { ProgramaInput, ProgramaPanel } from '@pgim/shared';
import { useSesion } from '../../auth/SesionProvider';
import { useConfirmar } from '../../components/Confirmacion';
import {
  Aviso,
  Boton,
  Campo,
  EstadoCarga,
  Panel,
  claseInput,
  propsDecimal,
} from '../../components/ui';
import { aNumero, formatoPesos } from '../../lib/formato';
import { useGuardar } from '../../lib/useGuardar';
import { useRecurso } from '../../lib/useRecurso';

const EJEMPLO = 10000;

const puntosDe = (monto: number, tasa: number) => Math.floor(monto * tasa + 1e-9);

// La base guarda puntos por cada $1 (0,01); el restaurante piensa en "1 punto
// cada $100". Se muestra y se carga así.
const pesosPorPunto = (tasa: number) => Math.round((1 / tasa) * 100) / 100;
const tasaDe = (pesos: number) => Math.round((1 / pesos) * 10_000) / 10_000;

// Programa de puntos del restaurante. Es permanente: una vez creado siempre
// acumula, la tasa no cambia y los puntos no vencen.
export function ProgramaPuntos() {
  const { tienePermiso } = useSesion();
  const { datos, cargando, error, recargar } = useRecurso<ProgramaPanel | null>(
    '/fidelizacion/programa',
  );

  return (
    <section className="mb-6 max-w-2xl">
      <h2 className="text-base font-semibold text-ink">Programa de puntos</h2>
      <p className="mb-3 text-sm text-meta">
        Cada pago aprobado desde la app suma puntos en este restaurante.
      </p>
      <EstadoCarga cargando={cargando && datos === null} error={error} />
      {datos ? (
        <Panel>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-meta">Tasa</dt>
              <dd className="text-2xl font-semibold tabular-nums text-ink">
                1 punto cada {formatoPesos(pesosPorPunto(datos.puntosPorUnidad))}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-meta">Por ejemplo</dt>
              <dd className="text-ink">
                Un consumo de {formatoPesos(EJEMPLO)} suma{' '}
                {puntosDe(EJEMPLO, datos.puntosPorUnidad)} puntos.
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-meta">
            El programa es permanente: la tasa no se puede cambiar y los puntos no vencen.
          </p>
        </Panel>
      ) : (
        !cargando &&
        !error &&
        (tienePermiso('beneficio.crear') ? (
          <FormularioPrograma onCreado={recargar} />
        ) : (
          <p className="text-sm text-meta">
            Todavía no hay programa de puntos. Lo puede crear quien administra los beneficios.
          </p>
        ))
      )}
    </section>
  );
}

function FormularioPrograma({ onCreado }: { onCreado(): void }) {
  const [pesos, setPesos] = useState('100');
  const { enviar, enviando, error } = useGuardar();
  const confirmar = useConfirmar();
  const porPunto = aNumero(pesos);
  const valor = porPunto > 0 ? tasaDe(porPunto) : Number.NaN;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !(await confirmar({
        mensaje: '¿Crear el programa de puntos?',
        detalle:
          'Es permanente: una vez creado no se puede cambiar la tasa ni desactivar, y los puntos no vencen.',
        accion: 'Crear programa',
      }))
    )
      return;
    const datos: ProgramaInput = { puntosPorUnidad: valor };
    if (await enviar('/fidelizacion/programa', 'POST', datos)) onCreado();
  }

  return (
    <Panel>
      <form onSubmit={onSubmit} className="space-y-4">
        <Campo
          etiqueta="Cada cuántos pesos se suma 1 punto"
          ayuda={
            Number.isFinite(valor) && valor > 0
              ? `Un consumo de ${formatoPesos(EJEMPLO)} sumaría ${puntosDe(EJEMPLO, valor)} puntos.`
              : 'Por ejemplo, con 100 se suma 1 punto cada $100.'
          }
        >
          <input
            {...propsDecimal}
            required
            value={pesos}
            onChange={(e) => setPesos(e.target.value)}
            className={claseInput}
          />
        </Campo>
        <Aviso>{error}</Aviso>
        <div className="flex justify-end">
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear programa'}
          </Boton>
        </div>
      </form>
    </Panel>
  );
}
