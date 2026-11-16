import { useState, type FormEvent, type ReactNode } from 'react';
import { Gift } from 'lucide-react';
import {
  hoyArgentina,
  TIPOS_CRITERIO,
  type BeneficioInput,
  type BeneficioPanel,
  type ClaseBeneficio,
  type GrupoPanel,
  type Menu,
  type TipoCriterio,
  type TipoDescuento,
} from '@pgim/shared';
import { useSesion } from '../../auth/SesionProvider';
import { useConfirmar } from '../../components/Confirmacion';
import { Lista } from '../../components/Lista';
import { ProgramaPuntos } from './ProgramaPuntos';
import {
  Aviso,
  Boton,
  Campo,
  EncabezadoPagina,
  Estado,
  EstadoCarga,
  Modal,
  Segmentado,
  Vacio,
  claseInput,
  propsDecimal,
} from '../../components/ui';
import {
  NOMBRE_CRITERIO,
  diaDe,
  finDelDia,
  inicioDelDia,
  textoCondicion,
  textoDescuento,
  textoStock,
  textoVigencia,
  ultimoDiaDe,
} from '../../lib/beneficios';
import { aNumero, sumarDias } from '../../lib/formato';
import { useGuardar } from '../../lib/useGuardar';
import { useRecurso } from '../../lib/useRecurso';

type FiltroClase = 'TODOS' | ClaseBeneficio;

// CU-17: recompensas (por visitas, monto, puntos o primera visita) y
// promociones de un menú, con vigencia y stock opcional.
export function BeneficiosPage() {
  const { tienePermiso } = useSesion();
  const [clase, setClase] = useState<FiltroClase>('TODOS');
  const {
    datos: todos,
    cargando,
    error,
    recargar,
  } = useRecurso<BeneficioPanel[]>('/fidelizacion/beneficios');
  const grupos = useRecurso<GrupoPanel[]>('/fidelizacion/grupos');
  const [editando, setEditando] = useState<BeneficioPanel | 'nuevo' | null>(null);
  const [grupoModal, setGrupoModal] = useState<GrupoPanel | 'nuevo' | null>(null);
  const accion = useGuardar();
  const confirmar = useConfirmar();

  function cambio() {
    setEditando(null);
    recargar();
    grupos.recargar();
  }

  async function relanzar(b: BeneficioPanel) {
    if (
      !(await confirmar({
        mensaje: `¿Relanzar ${b.nombre}?`,
        detalle:
          'Empieza hoy con la misma duración y el stock completo. El progreso de los comensales vuelve a cero.',
        accion: 'Relanzar',
      }))
    )
      return;
    if (await accion.enviar(`/fidelizacion/beneficios/${b.id}/relanzar`, 'POST')) cambio();
  }

  async function darDeBaja(b: BeneficioPanel) {
    if (
      !(await confirmar({
        mensaje: `¿Dar de baja ${b.nombre}?`,
        detalle: 'Deja de ofrecerse. Los pagos que ya lo usaron lo conservan.',
        accion: 'Dar de baja',
      }))
    )
      return;
    if (await accion.enviar(`/fidelizacion/beneficios/${b.id}`, 'DELETE')) cambio();
  }

  async function borrarGrupo(g: GrupoPanel) {
    if (!(await confirmar({ mensaje: `¿Borrar el grupo ${g.nombre}?`, accion: 'Borrar' }))) return;
    if (await accion.enviar(`/fidelizacion/grupos/${g.id}`, 'DELETE')) cambio();
  }

  const sinFiltros = clase === 'TODOS';
  const listaGrupos = grupos.datos ?? [];
  // Se pide la lista completa y el tipo se filtra acá, para no mostrar datos viejos al cambiar.
  const datos =
    todos && (grupos.datos || grupos.error)
      ? todos.filter((b) => sinFiltros || b.clase === clase)
      : null;
  const idsGrupos = new Set(listaGrupos.map((g) => g.id));
  const sinGrupo = (datos ?? []).filter((b) => !b.grupo || !idsGrupos.has(b.grupo.id));

  const lista = (filas: BeneficioPanel[], vacio?: ReactNode) => (
    <Lista<BeneficioPanel>
      filas={filas}
      clave={(b) => b.id}
      inactiva={(b) => b.estado === 'BAJA'}
      vacio={vacio}
      anchos={['20%', '8%', '17%', '9%', '13%', '8%', '7%', '18%']}
      columnas={[
        { titulo: 'Beneficio', valor: (b) => b.nombre },
        {
          titulo: 'Tipo',
          valor: (b) => (b.clase === 'RECOMPENSA' ? 'Recompensa' : 'Promoción'),
        },
        { titulo: 'Condición', valor: textoCondicion },
        { titulo: 'Descuento', valor: textoDescuento },
        { titulo: 'Vigencia', valor: textoVigencia },
        { titulo: 'Disponibles', valor: textoStock },
        { titulo: 'Estado', valor: (b) => <Estado entidad="beneficio" valor={b.estado} /> },
      ]}
      acciones={(b) => (
        <span className="inline-flex flex-wrap justify-end gap-x-6 gap-y-2">
          {tienePermiso('beneficio.editar') && b.estado === 'PROGRAMADO' && (
            <Boton variante="secundario" onClick={() => setEditando(b)}>
              Editar
            </Boton>
          )}
          {tienePermiso('beneficio.editar') && b.estado === 'TERMINADO' && (
            <Boton
              variante="secundario"
              disabled={b.pagosEnCurso > 0}
              title={
                b.pagosEnCurso > 0
                  ? 'Hay pagos en curso con este beneficio. Esperá a que terminen.'
                  : undefined
              }
              onClick={() => relanzar(b)}
            >
              Relanzar
            </Boton>
          )}
          {tienePermiso('beneficio.eliminar') && b.estado !== 'VIGENTE' && b.estado !== 'BAJA' && (
            <Boton variante="peligro" onClick={() => darDeBaja(b)}>
              Dar de baja
            </Boton>
          )}
        </span>
      )}
    />
  );

  // Con un filtro de tipo, los grupos que quedan sin beneficios se ocultan.
  const gruposVisibles = listaGrupos.filter(
    (g) => sinFiltros || (datos ?? []).some((b) => b.grupo?.id === g.id),
  );
  const hayBeneficios = (datos ?? []).length > 0;

  return (
    <section>
      <EncabezadoPagina
        titulo="Beneficios"
        descripcion="Programa de puntos, recompensas por fidelidad y promociones de un menú. El comensal usa uno por mesa."
        accion={
          tienePermiso('beneficio.crear') && (
            <span className="inline-flex flex-wrap gap-2">
              <Boton variante="secundario" onClick={() => setGrupoModal('nuevo')}>
                Crear grupo de beneficios
              </Boton>
              <Boton onClick={() => setEditando('nuevo')}>Nuevo beneficio</Boton>
            </span>
          )
        }
      />
      <ProgramaPuntos />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmentado<FiltroClase>
          etiqueta="Tipo de beneficio"
          valor={clase}
          onCambiar={setClase}
          opciones={[
            { valor: 'TODOS', texto: 'Todos' },
            { valor: 'RECOMPENSA', texto: 'Recompensas' },
            { valor: 'PROMOCION', texto: 'Promociones' },
          ]}
        />
      </div>
      <EstadoCarga
        cargando={(cargando && !todos) || (grupos.cargando && !grupos.datos)}
        error={error ?? grupos.error}
      />
      <div className="mb-3">
        <Aviso>{accion.error}</Aviso>
      </div>
      {datos && !hayBeneficios && gruposVisibles.length === 0 && (
        <Vacio
          icono={Gift}
          titulo={sinFiltros ? 'Todavía no hay beneficios' : 'No hay beneficios con este filtro'}
          texto={
            sinFiltros
              ? 'Creá una recompensa para premiar a los comensales que vuelven, o una promoción para un menú.'
              : undefined
          }
        />
      )}
      {datos &&
        gruposVisibles.map((g) => {
          const filas = datos.filter((b) => b.grupo?.id === g.id);
          return (
            <div key={g.id} className="mb-6">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="min-w-0 text-base font-semibold text-ink [overflow-wrap:anywhere]">
                  {g.nombre} <span className="text-sm font-normal text-meta">({filas.length})</span>
                </h2>
                <span className="-mr-3 inline-flex shrink-0 gap-1">
                  {tienePermiso('beneficio.editar') && (
                    <Boton
                      variante="fantasma"
                      aria-label={`Renombrar el grupo ${g.nombre}`}
                      onClick={() => setGrupoModal(g)}
                    >
                      Renombrar
                    </Boton>
                  )}
                  {tienePermiso('beneficio.eliminar') && (
                    <Boton
                      variante="peligroFantasma"
                      aria-label={`Borrar el grupo ${g.nombre}`}
                      disabled={g.cantidadBeneficios > 0}
                      title={
                        g.cantidadBeneficios > 0
                          ? 'Solo se puede borrar un grupo sin beneficios.'
                          : undefined
                      }
                      onClick={() => borrarGrupo(g)}
                    >
                      Borrar
                    </Boton>
                  )}
                </span>
              </div>
              {tienePermiso('beneficio.eliminar') && g.cantidadBeneficios > 0 && (
                <p className="mb-2 text-xs text-meta">
                  Solo se puede borrar un grupo sin beneficios.
                </p>
              )}
              {lista(
                filas,
                <p className="py-3 text-sm text-meta">Este grupo no tiene beneficios.</p>,
              )}
            </div>
          );
        })}
      {datos && sinGrupo.length > 0 && (
        <div className="mb-6">
          {listaGrupos.length > 0 && (
            <h2 className="mb-2 text-base font-semibold text-ink">Sin grupo</h2>
          )}
          {lista(sinGrupo)}
        </div>
      )}

      {editando && (
        <FormularioBeneficio
          beneficio={editando === 'nuevo' ? null : editando}
          grupos={listaGrupos}
          onCerrar={() => setEditando(null)}
          onGuardado={cambio}
        />
      )}
      {grupoModal && (
        <FormularioGrupo
          grupo={grupoModal === 'nuevo' ? null : grupoModal}
          onCerrar={() => setGrupoModal(null)}
          onGuardado={() => {
            setGrupoModal(null);
            cambio();
          }}
        />
      )}
    </section>
  );
}

function FormularioGrupo({
  grupo,
  onCerrar,
  onGuardado,
}: {
  grupo: GrupoPanel | null;
  onCerrar(): void;
  onGuardado(): void;
}) {
  const [nombre, setNombre] = useState(grupo?.nombre ?? '');
  const { enviar, enviando, error } = useGuardar();
  const [falta, setFalta] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nombre.trim()) {
      setFalta(true);
      return;
    }
    const ok = grupo
      ? await enviar(`/fidelizacion/grupos/${grupo.id}`, 'PUT', { nombre: nombre.trim() })
      : await enviar('/fidelizacion/grupos', 'POST', { nombre: nombre.trim() });
    if (ok) onGuardado();
  }

  return (
    <Modal
      titulo={grupo ? `Renombrar ${grupo.nombre}` : 'Crear grupo de beneficios'}
      onCerrar={onCerrar}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Campo etiqueta="Nombre">
          <input
            maxLength={60}
            value={nombre}
            aria-invalid={falta || undefined}
            onChange={(e) => {
              setNombre(e.target.value);
              setFalta(false);
            }}
            className={claseInput}
          />
        </Campo>
        <Aviso>{falta ? 'Ingresá un nombre' : error}</Aviso>
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

const ETIQUETA_VALOR_CRITERIO: Record<Exclude<TipoCriterio, 'NUEVO_CLIENTE'>, string> = {
  VISITAS: 'Visitas necesarias',
  MONTO: 'Monto a gastar, en pesos',
  PUNTOS: 'Puntos que cuesta',
};

const AYUDA_CRITERIO: Record<TipoCriterio, string> = {
  VISITAS: 'Se cuentan desde que empieza el beneficio o desde el último canje.',
  MONTO: 'Se suma lo pagado desde que empieza el beneficio o desde el último canje.',
  PUNTOS: 'Al usarlo, se descuentan los puntos del saldo del comensal.',
  NUEVO_CLIENTE: 'Para quien nunca pagó en este restaurante desde la app.',
};

function FormularioBeneficio({
  beneficio,
  grupos,
  onCerrar,
  onGuardado,
}: {
  beneficio: BeneficioPanel | null;
  grupos: GrupoPanel[];
  onCerrar(): void;
  onGuardado(): void;
}) {
  const menus = useRecurso<Menu[]>('/menus');
  const hoy = hoyArgentina();
  const [nombre, setNombre] = useState(beneficio?.nombre ?? '');
  const [clase, setClase] = useState<ClaseBeneficio>(beneficio?.clase ?? 'RECOMPENSA');
  const [grupoId, setGrupoId] = useState(beneficio?.grupo?.id ?? '');
  const [menuId, setMenuId] = useState(beneficio?.menu?.id ?? '');
  const [criterioTipo, setCriterioTipo] = useState<TipoCriterio>(
    beneficio?.criterioTipo ?? 'VISITAS',
  );
  const [criterioValor, setCriterioValor] = useState(
    beneficio?.criterioValor === null || !beneficio ? '' : String(beneficio.criterioValor),
  );
  const [tipoDescuento, setTipoDescuento] = useState<TipoDescuento>(
    beneficio?.tipoDescuento ?? 'PORCENTAJE',
  );
  const [valor, setValor] = useState(beneficio ? String(beneficio.valor) : '');
  const [desde, setDesde] = useState(beneficio ? diaDe(beneficio.vigenciaDesde) : hoy);
  const [hasta, setHasta] = useState(
    beneficio ? ultimoDiaDe(beneficio.vigenciaHasta) : sumarDias(hoy, 29),
  );
  const [conStock, setConStock] = useState(beneficio ? beneficio.stockInicial !== null : false);
  const [stock, setStock] = useState(beneficio?.stockInicial ? String(beneficio.stockInicial) : '');
  const { enviar, enviando, error } = useGuardar();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const recompensa = clase === 'RECOMPENSA';
    const datos: BeneficioInput = {
      nombre,
      clase,
      grupoId: grupoId || null,
      menuId: recompensa ? null : menuId || null,
      criterioTipo: recompensa ? criterioTipo : null,
      criterioValor: recompensa && criterioTipo !== 'NUEVO_CLIENTE' ? aNumero(criterioValor) : null,
      tipoDescuento,
      valor: aNumero(valor),
      vigenciaDesde: inicioDelDia(desde),
      vigenciaHasta: finDelDia(hasta),
      stockInicial: conStock ? aNumero(stock) : null,
    };
    const respuesta = beneficio
      ? await enviar(`/fidelizacion/beneficios/${beneficio.id}`, 'PUT', datos)
      : await enviar('/fidelizacion/beneficios', 'POST', datos);
    if (respuesta) onGuardado();
  }

  return (
    <Modal
      titulo={beneficio ? `Editar ${beneficio.nombre}` : 'Nuevo beneficio'}
      onCerrar={onCerrar}
      ancho="max-w-xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Segmentado<ClaseBeneficio>
          etiqueta="Tipo de beneficio"
          valor={clase}
          onCambiar={setClase}
          opciones={[
            { valor: 'RECOMPENSA', texto: 'Recompensa' },
            { valor: 'PROMOCION', texto: 'Promoción' },
          ]}
        />
        <Campo etiqueta="Nombre" ayuda="Lo ve el comensal al pagar">
          <input
            required
            maxLength={80}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={claseInput}
          />
        </Campo>

        {clase === 'RECOMPENSA' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Condición" ayuda={AYUDA_CRITERIO[criterioTipo]}>
              <select
                value={criterioTipo}
                onChange={(e) => setCriterioTipo(e.target.value as TipoCriterio)}
                className={claseInput}
              >
                {TIPOS_CRITERIO.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_CRITERIO[t]}
                  </option>
                ))}
              </select>
            </Campo>
            {criterioTipo !== 'NUEVO_CLIENTE' && (
              <Campo etiqueta={ETIQUETA_VALOR_CRITERIO[criterioTipo]}>
                <input
                  {...propsDecimal}
                  required
                  value={criterioValor}
                  onChange={(e) => setCriterioValor(e.target.value)}
                  className={claseInput}
                />
              </Campo>
            )}
          </div>
        ) : (
          <Campo etiqueta="Menú" ayuda="Se ofrece en las sucursales que tienen este menú activo">
            <select
              required
              value={menuId}
              onChange={(e) => setMenuId(e.target.value)}
              className={claseInput}
            >
              <option value="">Elegí un menú</option>
              {menus.datos?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Descuento">
            <select
              value={tipoDescuento}
              onChange={(e) => setTipoDescuento(e.target.value as TipoDescuento)}
              className={claseInput}
            >
              <option value="PORCENTAJE">Porcentaje del total</option>
              <option value="MONTO_FIJO">Monto fijo en pesos</option>
            </select>
          </Campo>
          <Campo etiqueta={tipoDescuento === 'PORCENTAJE' ? 'Porcentaje' : 'Monto en pesos'}>
            <input
              {...propsDecimal}
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={claseInput}
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Desde">
            <input
              type="date"
              required
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={claseInput}
            />
          </Campo>
          <Campo etiqueta="Hasta (inclusive)">
            <input
              type="date"
              required
              min={desde}
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={claseInput}
            />
          </Campo>
        </div>
        <p className="-mt-2 text-sm text-meta">
          Mientras esté vigente no se puede editar ni interrumpir. Al terminar, se puede relanzar.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Cantidad disponible">
            <select
              value={conStock ? 'LIMITADA' : 'SIN_LIMITE'}
              onChange={(e) => setConStock(e.target.value === 'LIMITADA')}
              className={claseInput}
            >
              <option value="SIN_LIMITE">Sin límite</option>
              <option value="LIMITADA">Limitada</option>
            </select>
          </Campo>
          {conStock && (
            <Campo etiqueta="Cuántos" ayuda="Termina al agotarse, aunque siga en fecha">
              <input
                inputMode="numeric"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className={claseInput}
              />
            </Campo>
          )}
        </div>

        {grupos.length > 0 && (
          <Campo etiqueta="Grupo (opcional)">
            <select
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
              className={claseInput}
            >
              <option value="">Sin grupo</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}

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
