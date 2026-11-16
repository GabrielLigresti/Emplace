import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  EVENTOS_SOCKET,
  buscarLugarLibre,
  rectanguloMesa,
  type DistribucionInput,
  type Mesa,
  type MesaInput,
  type Sucursal,
} from '@pgim/shared';
import { useSesion } from '../../auth/SesionProvider';
import { LeyendaSalon, MapaSalon } from '../../components/MapaSalon';
import {
  Aviso,
  Boton,
  Campo,
  EncabezadoPagina,
  EstadoCarga,
  Modal,
  claseInput,
} from '../../components/ui';
import { aNumero } from '../../lib/formato';
import { useGuardar } from '../../lib/useGuardar';
import { useEventoSocket } from '../../lib/socket';
import { useRecurso } from '../../lib/useRecurso';
import { useConfirmar } from '../../components/Confirmacion';

function datosDe(mesa: Mesa): MesaInput {
  return {
    numero: mesa.numero,
    capacidad: mesa.capacidad,
    posX: mesa.posX,
    posY: mesa.posY,
    vertical: mesa.vertical,
  };
}

type Pendientes = Record<string, { posX: number; posY: number }>;

// CU-14: mapa del salón de una sucursal. Las mesas nuevas aparecen en un
// lugar libre; las posiciones se arman como borrador arrastrando y se guardan
// juntas al confirmar la distribución.
export function SalonPage() {
  const { id: sucursalId } = useParams();
  const { tienePermiso } = useSesion();
  const editable = tienePermiso('sucursal.editar');
  const ruta = `/sucursales/${sucursalId}/mesas`;
  const { datos, cargando, error, recargar } = useRecurso<Mesa[]>(ruta);
  const sucursales = useRecurso<Sucursal[]>('/sucursales');
  const sucursal = sucursales.datos?.find((s) => s.id === sucursalId);
  const [editando, setEditando] = useState<Mesa | null>(null);
  const guardar = useGuardar();
  const [sinLugar, setSinLugar] = useState(false);
  const [conflicto, setConflicto] = useState<string | null>(null);
  // Borrador: mesas movidas y todavía sin confirmar (id → posición nueva).
  const [pendientes, setPendientes] = useState<Pendientes>({});
  const cantidadPendientes = Object.keys(pendientes).length;

  // Las mesas del servidor con el borrador encima.
  const mesas = useMemo(
    () =>
      (datos ?? []).map((m) => {
        const p = pendientes[m.id];
        return p ? { ...m, ...p } : m;
      }),
    [datos, pendientes],
  );

  // Tras una recarga, el borrador pierde las mesas que ya no existen, las que
  // se dieron de baja y las que otro gerente dejó justo donde el borrador las puso.
  useEffect(() => {
    if (!datos) return;
    setPendientes((actual) => {
      const resto = Object.fromEntries(
        Object.entries(actual).filter(([id, p]) => {
          const m = datos.find((x) => x.id === id);
          return m?.activa && (m.posX !== p.posX || m.posY !== p.posY);
        }),
      );
      return Object.keys(resto).length === Object.keys(actual).length ? actual : resto;
    });
  }, [datos]);

  // «No hay lugar» vale para el salón de ese momento: si las mesas cambian, se descarta.
  useEffect(() => {
    setSinLugar(false);
  }, [mesas]);

  // Con borrador, el navegador avisa antes de cerrar o recargar la pestaña.
  useEffect(() => {
    if (cantidadPendientes === 0) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [cantidadPendientes]);

  // Mesa vigente del formulario, tal como está guardada: otro gerente pudo
  // moverla o quitarla mientras está abierto, y el borrador no se guarda desde ahí.
  const vigente = editando ? datos?.find((m) => m.id === editando.id) : undefined;
  useEffect(() => {
    if (editando && datos && !vigente) {
      setEditando(null);
      setConflicto('La mesa que estabas editando ya no existe.');
    }
  }, [editando, datos, vigente]);

  function limpiarAvisos() {
    setSinLugar(false);
    setConflicto(null);
    guardar.setError(null);
  }

  // Mover solo arma el borrador; si la mesa vuelve a su lugar guardado, sale de él.
  function mover(id: string, posX: number, posY: number) {
    const guardada = datos?.find((m) => m.id === id);
    if (!guardada) return;
    limpiarAvisos();
    setPendientes((actual) => {
      const { [id]: _, ...resto } = actual;
      return guardada.posX === posX && guardada.posY === posY
        ? resto
        : { ...resto, [id]: { posX, posY } };
    });
  }

  function descartar() {
    limpiarAvisos();
    setPendientes({});
  }

  async function confirmarDistribucion() {
    limpiarAvisos();
    const cuerpo: DistribucionInput = {
      mesas: Object.entries(pendientes).map(([id, p]) => ({ id, ...p })),
    };
    if (await guardar.enviar(`${ruta}/distribucion`, 'PUT', cuerpo)) {
      setPendientes({});
      recargar();
    }
  }

  // Otro gerente puede editar el mapa: se recarga al recibir el aviso. El
  // arrastre en curso vive en el estado local de MapaSalon y el borrador queda.
  useEventoSocket(EVENTOS_SOCKET.mapaEditado, recargar, sucursalId);

  async function agregar() {
    limpiarAvisos();
    // El servidor valida contra lo guardado y el borrador se confirmará después:
    // el lugar libre debe serlo en ambas distribuciones.
    const ocupados = [...(datos ?? []), ...mesas].filter((m) => m.activa).map(rectanguloMesa);
    const lugar = buscarLugarLibre(4, false, ocupados);
    if (!lugar) {
      setSinLugar(true);
      return;
    }
    const numero = Math.max(0, ...mesas.map((m) => m.numero)) + 1;
    const nueva: MesaInput = { numero, capacidad: 4, ...lugar };
    if (await guardar.enviar(ruta, 'POST', nueva)) recargar();
  }

  return (
    <section>
      <p className="mb-2 text-sm">
        <Link to="/panel/sucursales" className="text-meta underline">
          ← Sucursales
        </Link>
      </p>
      <EncabezadoPagina
        titulo={`Salón${sucursal ? ` de ${sucursal.nombre}` : ''}`}
        descripcion={
          editable
            ? 'Arrastrá las mesas para ubicarlas y confirmá la distribución. Tocá una mesa para editarla.'
            : 'Ubicación y capacidad de las mesas.'
        }
        accion={
          editable && (
            <Boton variante="secundario" onClick={agregar} disabled={guardar.enviando}>
              Agregar mesa
            </Boton>
          )
        }
      />
      <EstadoCarga cargando={cargando && !datos} error={error} />
      {datos && (
        <div className="space-y-4">
          <MapaSalon
            mesas={mesas.map((m) => ({
              ...m,
              inactiva: !m.activa,
              pendiente: m.id in pendientes,
            }))}
            onMover={editable ? mover : undefined}
            onConflicto={(_, otra) =>
              setConflicto(`No se puede ubicar ahí: se superpone con la mesa ${otra.numero}`)
            }
            onElegir={
              editable ? (id) => setEditando(datos.find((m) => m.id === id) ?? null) : undefined
            }
            inactivasElegibles={editable}
          />
          {/* Debajo del plano: al aparecer empuja lo de abajo y no corre el plano. */}
          {cantidadPendientes > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <p className="text-sm text-text">
                {cantidadPendientes === 1
                  ? '1 mesa movida sin confirmar'
                  : `${cantidadPendientes} mesas movidas sin confirmar`}
              </p>
              <div className="flex gap-2">
                <Boton variante="secundario" onClick={descartar} disabled={guardar.enviando}>
                  Descartar
                </Boton>
                <Boton onClick={confirmarDistribucion} disabled={guardar.enviando}>
                  {guardar.enviando ? 'Guardando…' : 'Confirmar distribución'}
                </Boton>
              </div>
            </div>
          )}
          <Aviso>
            {conflicto ?? (sinLugar ? 'No hay lugar libre en el salón' : null) ?? guardar.error}
          </Aviso>
          {mesas.some((m) => !m.activa) && <LeyendaSalon estados={[]} inactiva />}
        </div>
      )}

      {editando && (
        <FormularioMesa
          key={editando.id}
          ruta={ruta}
          mesa={editando}
          vigente={vigente}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            limpiarAvisos();
            setEditando(null);
            recargar();
          }}
        />
      )}
    </section>
  );
}

function FormularioMesa({
  ruta,
  mesa,
  vigente,
  onCerrar,
  onGuardado,
}: {
  ruta: string;
  mesa: Mesa;
  vigente?: Mesa;
  onCerrar(): void;
  onGuardado(): void;
}) {
  const [numero, setNumero] = useState(String(mesa.numero));
  const [capacidad, setCapacidad] = useState(mesa.capacidad);
  const [vertical, setVertical] = useState(mesa.vertical);
  const opciones = [2, 4, 6, 8].includes(mesa.capacidad)
    ? [2, 4, 6, 8]
    : [...[2, 4, 6, 8, mesa.capacidad]].sort((a, b) => a - b);
  const { enviar, enviando, error } = useGuardar();
  const confirmar = useConfirmar();
  // Posición y estado salen de la mesa vigente del servidor: la copia pudo quedar
  // vieja si la movieron, y un movimiento del borrador no se guarda desde acá.
  const base = vigente ?? mesa;

  function datosFormulario(activa: boolean): MesaInput {
    return {
      ...datosDe(base),
      numero: aNumero(numero),
      capacidad,
      vertical,
      activa,
    };
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await enviar(`${ruta}/${mesa.id}`, 'PUT', datosFormulario(base.activa))) onGuardado();
  }

  async function reactivar() {
    if (await enviar(`${ruta}/${mesa.id}`, 'PUT', datosFormulario(true))) onGuardado();
  }

  async function darDeBaja() {
    if (
      !(await confirmar({
        mensaje: `¿Dar de baja la mesa ${mesa.numero}?`,
        detalle: 'Deja de poder reservarse. Su historial se conserva.',
        accion: 'Dar de baja',
      }))
    )
      return;
    if (await enviar(`${ruta}/${mesa.id}`, 'DELETE')) onGuardado();
  }

  return (
    <Modal titulo={`Editar mesa ${mesa.numero}`} onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Número">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              required
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className={claseInput}
            />
          </Campo>
          <Campo etiqueta="Capacidad">
            <select
              value={capacidad}
              onChange={(e) => setCapacidad(Number(e.target.value))}
              className={claseInput}
            >
              {opciones.map((n) => (
                <option key={n} value={n}>
                  {n} personas
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="space-y-1">
          <span className="block text-sm font-medium text-text">Orientación</span>
          <div
            role="radiogroup"
            aria-label="Orientación"
            className="grid grid-cols-2 gap-2"
            onKeyDown={(e) => {
              const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
              if (!paso) return;
              e.preventDefault();
              // Con dos opciones, avanzar o retroceder alterna; el foco acompaña la selección.
              const nueva = !vertical;
              setVertical(nueva);
              e.currentTarget
                .querySelectorAll<HTMLElement>('[role="radio"]')
                [nueva ? 1 : 0]?.focus();
            }}
          >
            {[
              { valor: false, texto: 'Horizontal' },
              { valor: true, texto: 'Vertical' },
            ].map((o) => (
              <Boton
                key={o.texto}
                role="radio"
                aria-checked={vertical === o.valor}
                tabIndex={vertical === o.valor ? 0 : -1}
                variante={vertical === o.valor ? 'principal' : 'secundario'}
                densidad="tactil"
                onClick={() => setVertical(o.valor)}
              >
                {o.texto}
              </Boton>
            ))}
          </div>
        </div>
        <Aviso>{error}</Aviso>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          {base.activa ? (
            <Boton variante="peligro" onClick={darDeBaja} disabled={enviando}>
              Dar de baja
            </Boton>
          ) : (
            <Boton variante="secundario" onClick={reactivar} disabled={enviando}>
              Reactivar
            </Boton>
          )}
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
