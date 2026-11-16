import { Link } from 'react-router';
import { EVENTOS_SOCKET, type ReservaComensal } from '@pgim/shared';
import { LayoutComensal, TituloComensal } from '../../components/LayoutComensal';
import { Aviso, Boton, Estado, EstadoCarga } from '../../components/ui';
import { formatoDiaYHora, formatoHora } from '../../lib/formato';
import { esCancelable } from '../../lib/reservas';
import { useEventoSocket } from '../../lib/socket';
import { useAhora } from '../../lib/useAhora';
import { useGuardar } from '../../lib/useGuardar';
import { useRecurso } from '../../lib/useRecurso';
import { useConfirmar } from '../../components/Confirmacion';

const esVigente = (r: ReservaComensal) => r.estado === 'PENDIENTE' || r.estado === 'ACTIVA';

function agruparPorRestaurante(reservas: ReservaComensal[]) {
  const grupos = new Map<
    string,
    { restaurante: ReservaComensal['restaurante']; reservas: ReservaComensal[] }
  >();
  for (const r of reservas) {
    const g = grupos.get(r.restaurante.id);
    if (g) g.reservas.push(r);
    else grupos.set(r.restaurante.id, { restaurante: r.restaurante, reservas: [r] });
  }
  const porInicio = (a: ReservaComensal, b: ReservaComensal) => a.inicio.localeCompare(b.inicio);
  const resultado = [...grupos.values()].map((g) => {
    const vigentes = g.reservas.filter(esVigente).sort(porInicio);
    const anteriores = g.reservas.filter((r) => !esVigente(r)).sort((a, b) => porInicio(b, a));
    return { ...g, reservas: [...vigentes, ...anteriores], proxima: vigentes[0]?.inicio };
  });
  return resultado.sort((a, b) => {
    if (a.proxima && b.proxima) return a.proxima.localeCompare(b.proxima);
    if (a.proxima || b.proxima) return a.proxima ? -1 : 1;
    return b.reservas[0]!.inicio.localeCompare(a.reservas[0]!.inicio);
  });
}

export function MisReservasPage() {
  const { datos, cargando, error, recargar } = useRecurso<ReservaComensal[]>('/comensal/reservas');
  const cancelacion = useGuardar();
  const ahora = useAhora();
  // Activación desde el panel o vencimiento: el estado cambia sin recargar.
  useEventoSocket(EVENTOS_SOCKET.cambioReserva, recargar);

  const confirmar = useConfirmar();

  // Por restaurante. Las reservas vigentes van primero, la más próxima arriba, y
  // los grupos se ordenan por su reserva vigente más próxima; los que solo tienen
  // historial van después, por su reserva más reciente.
  const grupos = agruparPorRestaurante(datos ?? []);

  async function cancelar(r: ReservaComensal) {
    const ok = await confirmar({
      mensaje: `¿Cancelar tu reserva en ${r.restaurante.nombre} (${r.sucursal.nombre})?`,
      detalle: `Mesa ${r.mesa.numero}, ${formatoDiaYHora(r.inicio)} h.`,
      accion: 'Cancelar reserva',
    });
    if (!ok) return;
    await cancelacion.enviar(`/comensal/reservas/${r.id}/cancelar`, 'POST');
    recargar();
  }

  return (
    <LayoutComensal volver={{ a: '/inicio', texto: 'Sucursales' }}>
      <div className="mb-4">
        <TituloComensal>Mis reservas</TituloComensal>
      </div>
      <EstadoCarga cargando={cargando && !datos} error={error} />
      <div className="mb-3">
        <Aviso>{cancelacion.error}</Aviso>
      </div>
      {datos?.length === 0 && (
        <p className="text-sm text-meta">Todavía no hiciste ninguna reserva.</p>
      )}
      <div className="space-y-8">
        {grupos.map((g) => (
          <section key={g.restaurante.id} aria-labelledby={`rest-${g.restaurante.id}`}>
            <h2 id={`rest-${g.restaurante.id}`} className="mb-3 text-lg font-semibold text-ink">
              {g.restaurante.nombre}
            </h2>
            <ul className="space-y-3">
              {g.reservas.map((r) => (
                <li
                  key={r.id}
                  className="space-y-2 rounded-panel border border-line bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {r.sucursal.nombre}{' '}
                        <span className="whitespace-nowrap">· Mesa {r.mesa.numero}</span>
                      </p>
                      <p className="text-sm text-meta">{formatoDiaYHora(r.inicio)} h</p>
                      <p className="text-sm text-meta">
                        {r.cantidadPersonas} {r.cantidadPersonas === 1 ? 'persona' : 'personas'}
                      </p>
                    </div>
                    <Estado entidad="reserva" valor={r.estado} publico="comensal" />
                  </div>
                  {r.estado === 'PENDIENTE' && (
                    <p className="text-xs text-meta">
                      Tolerancia de llegada hasta las {formatoHora(r.limiteLlegada)}.
                    </p>
                  )}
                  {r.estado === 'ACTIVA' && (
                    <p className="text-sm text-text">
                      Ya estás en la mesa {r.mesa.numero}. Pronto vas a poder pedir desde acá.
                    </p>
                  )}
                  {r.estado === 'VENCIDA' && (
                    <Link
                      to={`/s/${r.sucursal.id}/reservar`}
                      className="inline-flex min-h-11 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-semibold text-text hover:bg-panel"
                    >
                      Reservar de nuevo
                    </Link>
                  )}
                  {esCancelable(r, ahora) && (
                    <Boton
                      variante="peligro"
                      densidad="comensal"
                      disabled={cancelacion.enviando}
                      onClick={() => cancelar(r)}
                    >
                      Cancelar reserva
                    </Boton>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </LayoutComensal>
  );
}
