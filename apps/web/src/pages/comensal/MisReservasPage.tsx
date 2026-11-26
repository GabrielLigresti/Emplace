import { Link } from 'react-router';
import { EVENTOS_SOCKET, agruparReservasPorRestaurante, type ReservaComensal } from '@pgim/shared';
import { LayoutComensal, TituloComensal } from '../../components/LayoutComensal';
import { Aviso, Boton, Estado, EstadoCarga } from '../../components/ui';
import { formatoDiaYHora, formatoHora } from '../../lib/formato';
import { esCancelable } from '../../lib/reservas';
import { useEventoSocket } from '../../lib/socket';
import { useAhora } from '../../lib/useAhora';
import { useGuardar } from '../../lib/useGuardar';
import { useRecurso } from '../../lib/useRecurso';
import { useConfirmar } from '../../components/Confirmacion';

export function MisReservasPage() {
  const { datos, cargando, error, recargar } = useRecurso<ReservaComensal[]>('/comensal/reservas');
  const cancelacion = useGuardar();
  const ahora = useAhora();
  // Activación desde el panel o vencimiento: el estado cambia sin recargar.
  useEventoSocket(EVENTOS_SOCKET.cambioReserva, recargar);

  const confirmar = useConfirmar();

  const grupos = agruparReservasPorRestaurante(datos ?? []);

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

  function tarjeta(r: ReservaComensal, anterior: boolean) {
    return (
      <li
        key={r.id}
        className={`space-y-2 rounded-panel border border-line p-4 ${anterior ? '' : 'bg-surface'}`}
      >
        <p
          className={`[overflow-wrap:anywhere] ${anterior ? 'font-medium text-text' : 'font-semibold text-ink'}`}
        >
          {r.sucursal.nombre}
        </p>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 text-sm text-meta">
            <p className={anterior ? '' : 'font-medium text-text'}>{formatoDiaYHora(r.inicio)} h</p>
            <p>
              Mesa {r.mesa.numero} · {r.cantidadPersonas}{' '}
              {r.cantidadPersonas === 1 ? 'persona' : 'personas'}
            </p>
          </div>
          <Estado entidad="reserva" valor={r.estado} publico="comensal" />
        </div>
        {r.estado === 'PENDIENTE' && (
          <p className="text-sm text-meta">
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
    );
  }

  return (
    <LayoutComensal volver={{ a: '/inicio', texto: 'Restaurantes' }}>
      <div className="mb-4">
        <TituloComensal>Mis reservas</TituloComensal>
      </div>
      <EstadoCarga cargando={cargando && !datos} error={error} />
      <div className="mb-3">
        <Aviso>{cancelacion.error}</Aviso>
      </div>
      {datos?.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-meta">Todavía no hiciste ninguna reserva.</p>
          <Link
            to="/inicio"
            className="inline-flex min-h-11 items-center rounded-control border border-accent bg-accent px-4 text-sm font-semibold text-white hover:border-accent-hover hover:bg-accent-hover"
          >
            Buscar un restaurante
          </Link>
        </div>
      )}
      <div className="space-y-10">
        {grupos.map((g) => (
          <section key={g.restaurante.id} aria-labelledby={`rest-${g.restaurante.id}`}>
            <h2
              id={`rest-${g.restaurante.id}`}
              className="mb-4 border-b border-line-strong pb-2 font-display text-xl font-semibold tracking-tight text-balance text-ink [overflow-wrap:anywhere]"
            >
              {g.restaurante.nombre}
            </h2>
            {g.vigentes.length > 0 && (
              <ul className="space-y-3">{g.vigentes.map((r) => tarjeta(r, false))}</ul>
            )}
            {g.anteriores.length > 0 && (
              <div className={g.vigentes.length > 0 ? 'mt-6' : ''}>
                <h3 className="mb-2 text-sm font-medium text-meta">Anteriores</h3>
                <ul className="space-y-3">{g.anteriores.map((r) => tarjeta(r, true))}</ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </LayoutComensal>
  );
}
