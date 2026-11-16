import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  EVENTOS_SOCKET,
  buscarLugarLibre,
  rectanguloMesa,
  type Mesa,
  type MesaInput,
  type Sucursal,
} from '@pgim/shared';
import { useSesion } from '../../auth/SesionProvider';
import { Lista } from '../../components/Lista';
import { LeyendaSalon, MapaSalon } from '../../components/MapaSalon';
import {
  Aviso,
  Boton,
  Campo,
  Casilla,
  EncabezadoPagina,
  EstadoCarga,
  Etiqueta,
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

// CU-14: mapa del salón de una sucursal. Las mesas nuevas aparecen en un
// lugar libre y se acomodan arrastrándolas; la posición se guarda al soltar.
export function SalonPage() {
  const { id: sucursalId } = useParams();
  const { tienePermiso } = useSesion();
  const editable = tienePermiso('sucursal.editar');
  const ruta = `/sucursales/${sucursalId}/mesas`;
  const { datos, cargando, error, recargar } = useRecurso<Mesa[]>(ruta);
  const sucursales = useRecurso<Sucursal[]>('/sucursales');
  const sucursal = sucursales.datos?.find((s) => s.id === sucursalId);
  // Copia local para que la mesa quede donde se soltó mientras se guarda.
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [editando, setEditando] = useState<Mesa | null>(null);
  const guardar = useGuardar();
  const [sinLugar, setSinLugar] = useState(false);
  const [conflicto, setConflicto] = useState<string | null>(null);

  useEffect(() => {
    if (datos) setMesas(datos);
  }, [datos]);

  // «No hay lugar» vale para el salón de ese momento: si las mesas cambian, se descarta.
  useEffect(() => {
    setSinLugar(false);
  }, [mesas]);

  // Mesa vigente del formulario: otro gerente pudo moverla o quitarla mientras está abierto.
  const vigente = editando ? mesas.find((m) => m.id === editando.id) : undefined;
  useEffect(() => {
    if (editando && datos && !vigente) {
      setEditando(null);
      setConflicto('La mesa que estabas editando ya no existe.');
    }
  }, [editando, datos, vigente]);

  function limpiarAvisos() {
    setSinLugar(false);
    setConflicto(null);
  }

  async function mover(id: string, posX: number, posY: number) {
    const mesa = mesas.find((m) => m.id === id);
    if (!mesa) return;
    limpiarAvisos();
    setMesas((actual) => actual.map((m) => (m.id === id ? { ...m, posX, posY } : m)));
    if (!(await guardar.enviar(`${ruta}/${id}`, 'PUT', { ...datosDe(mesa), posX, posY }))) {
      recargar();
    }
  }

  // Otro gerente puede editar el mapa: se recarga al recibir el aviso. El
  // arrastre en curso vive en el estado local de MapaSalon y no se interrumpe.
  useEventoSocket(EVENTOS_SOCKET.mapaEditado, recargar, sucursalId);

  async function agregar() {
    limpiarAvisos();
    const lugar = buscarLugarLibre(4, false, mesas.filter((m) => m.activa).map(rectanguloMesa));
    if (!lugar) {
      setSinLugar(true);
      return;
    }
    const numero = Math.max(0, ...mesas.map((m) => m.numero)) + 1;
    const nueva: MesaInput = { numero, capacidad: 4, ...lugar };
    if (await guardar.enviar(ruta, 'POST', nueva)) recargar();
  }

  const confirmar = useConfirmar();

  async function darDeBaja(mesa: Mesa) {
    if (
      !(await confirmar({
        mensaje: `¿Dar de baja la mesa ${mesa.numero}?`,
        detalle: 'Deja de poder reservarse. Su historial se conserva.',
        accion: 'Dar de baja',
      }))
    )
      return;
    limpiarAvisos();
    if (await guardar.enviar(`${ruta}/${mesa.id}`, 'DELETE')) recargar();
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
            ? 'Arrastrá las mesas para ubicarlas; la posición se guarda al soltar. Tocá una mesa para editarla.'
            : 'Ubicación y capacidad de las mesas.'
        }
        accion={
          editable && (
            <Boton onClick={agregar} disabled={guardar.enviando}>
              Agregar mesa
            </Boton>
          )
        }
      />
      <EstadoCarga cargando={cargando && !datos} error={error} />
      {datos && (
        <div className="space-y-4">
          <MapaSalon
            mesas={mesas.map((m) => ({ ...m, inactiva: !m.activa }))}
            onMover={editable ? mover : undefined}
            onConflicto={(_, otra) =>
              setConflicto(`No se puede ubicar ahí: se superpone con la mesa ${otra.numero}`)
            }
            onElegir={
              editable ? (id) => setEditando(mesas.find((m) => m.id === id) ?? null) : undefined
            }
          />
          {/* Debajo del plano: al aparecer empuja la lista y no corre el plano. */}
          <Aviso>
            {conflicto ?? (sinLugar ? 'No hay lugar libre en el salón' : null) ?? guardar.error}
          </Aviso>
          {mesas.some((m) => !m.activa) && <LeyendaSalon estados={[]} inactiva />}
          <Lista
            filas={mesas}
            clave={(m) => m.id}
            inactiva={(m) => !m.activa}
            columnas={[
              {
                titulo: 'Mesa',
                valor: (m) => (
                  <span>
                    {m.numero} {!m.activa && <Etiqueta>Dada de baja</Etiqueta>}
                  </span>
                ),
              },
              { titulo: 'Capacidad', valor: (m) => `${m.capacidad} personas` },
            ]}
            acciones={(m) =>
              editable && (
                <span className="inline-flex flex-wrap justify-end gap-x-6 gap-y-2">
                  <Boton variante="secundario" onClick={() => setEditando(m)}>
                    Editar
                  </Boton>
                  {m.activa && (
                    <Boton variante="peligro" onClick={() => darDeBaja(m)}>
                      Dar de baja
                    </Boton>
                  )}
                </span>
              )
            }
          />
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
  const [activa, setActiva] = useState(mesa.activa);
  const { enviar, enviando, error } = useGuardar();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos: MesaInput = {
      // La posición sale de la mesa vigente: la copia pudo quedar vieja si la movieron.
      ...datosDe(vigente ?? mesa),
      numero: aNumero(numero),
      capacidad,
      vertical,
      activa,
    };
    if (await enviar(`${ruta}/${mesa.id}`, 'PUT', datos)) onGuardado();
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
        <Casilla etiqueta="Mesa activa" checked={activa} onChange={setActiva} />
        <Aviso>{error}</Aviso>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
