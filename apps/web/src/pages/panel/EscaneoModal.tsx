import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Box, Camera, Check, Eye, Loader } from 'lucide-react';
import {
  VISTAS,
  escalaPorDiametro,
  type Escaneo,
  type InformeCalidad as Informe,
  type ModeloRaInput,
  type Plato,
  type UmbralesCalidad,
  type VistaEscaneo,
} from '@pgim/shared';
import { CapaRa } from '../../components/CapaRa';
import { useConfirmar } from '../../components/Confirmacion';
import { Aviso, Boton, Campo, Etiqueta, Modal, Vacio, claseInput } from '../../components/ui';
import { ApiError, api, enviarFotos } from '../../lib/api';
import { formatoCantidad } from '../../lib/formato';
import type { ProgresoEscaneo } from '../../lib/escaneo-webxr';
import { useEscaneo } from '../../lib/useEscaneo';
import { useModelViewer } from '../../lib/useModelViewer';
import { useSesionRa } from '../../lib/useSesionRa';
import { InformeCalidad, NOMBRES_VISTA } from './InformeCalidad';

type Modo = 'inicio' | 'escaneando' | 'fotos';
type Dimensiones = { src: string; ancho: number; profundidad: number };

const MENSAJE_SIN_DIAMETRO = 'Cargá el diámetro del plato para escanearlo';
const MOTIVO_PORCION = 'Ingresá la porción en gramos, con un número entero mayor a 0';
const MENSAJE_SIN_SOPORTE = 'El escaneo se hace desde un celular Android con Chrome';
const PROGRESO_INICIAL: ProgresoEscaneo = {
  fase: 'colocar',
  tramos: [],
  vistas: { front: false, left: false, back: false, right: false },
  mensaje: 'Mové el celular despacio hasta ver la mesa',
};
const frenarSeleccion = (e: Event) => e.preventDefault();
const CLAVE_FALLA_VISTA = 'pgim:escaneo-falla-vista:';

// localStorage puede no estar disponible (modo privado, cuota): nunca debe romper la pantalla.
function fallaYaVista(id: string): boolean {
  try {
    return localStorage.getItem(CLAVE_FALLA_VISTA + id) !== null;
  } catch {
    return false;
  }
}

function recordarFallaVista(id: string) {
  try {
    localStorage.setItem(CLAVE_FALLA_VISTA + id, '1');
  } catch {
    // Sin almacenamiento, el aviso se oculta solo durante esta apertura del modal.
  }
}

// Pie del modal: en el celular los botones se apilan a ancho completo con el
// principal arriba (por eso el principal va último); en escritorio van en fila.
function Pie({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
      {children}
    </div>
  );
}

// Vista previa del modelo. model-viewer 4.4 tira un error si se cambia el modelo
// en vivo, así que la clave remonta el visor. Las medidas se leen con escala 1
// al terminar de cargar: la escala real sale del diámetro que indica el restaurante.
// Con `ra` (el modelo publicado, o el borrador ya medido) aparece "Ver en mi mesa" si el
// dispositivo tiene RA, igual que lo ve el comensal: la propia de lib/ra-webxr en Android, o
// la de model-viewer (Quick Look o Scene Viewer).
function Vista({
  src,
  nombre,
  borrador,
  onMedidas,
  ra,
}: {
  src: string;
  nombre: string;
  borrador?: boolean;
  onMedidas(d: Dimensiones): void;
  ra?: { escalaReal: number; urlModeloIos: string | null; porcion?: string } | null;
}) {
  const listo = useModelViewer();
  const visor = useRef<HTMLElementTagNameMap['model-viewer']>(null);
  const alMedir = useRef(onMedidas);
  const { webXR, sesion, diagnostico, capa, abrir, salir } = useSesionRa();
  // null hasta que carga el modelo y se sabe si el dispositivo puede.
  const [puedeVerRa, setPuedeVerRa] = useState<boolean | null>(null);
  const [falloRa, setFalloRa] = useState(false);
  useEffect(() => {
    alMedir.current = onMedidas;
  });

  useEffect(() => {
    const el = visor.current;
    if (!el) return;
    const leer = () => {
      const { x, z } = el.getDimensions();
      if (x > 0 || z > 0) alMedir.current({ src, ancho: x, profundidad: z });
    };
    el.addEventListener('load', leer);
    if (el.loaded) leer();
    return () => el.removeEventListener('load', leer);
  }, [src, listo]);

  // Sin WebXR, la RA la abre model-viewer; se muestra el botón solo si el dispositivo puede.
  useEffect(() => {
    const el = visor.current;
    if (!el || webXR !== false) return;
    let vigente = true;
    // El atributo `ar` se activa recién cuando se sabe que no hay WebXR: se espera a que
    // model-viewer lo procese antes de leer canActivateAR.
    const leer = () => {
      void el.updateComplete.then(() => {
        if (vigente) setPuedeVerRa(el.canActivateAR);
      });
    };
    if (el.loaded) leer();
    el.addEventListener('load', leer);
    el.addEventListener('ar-status', leer);
    return () => {
      vigente = false;
      el.removeEventListener('load', leer);
      el.removeEventListener('ar-status', leer);
    };
  }, [webXR, src, listo]);

  async function verEnMiMesa() {
    if (!ra) return;
    setFalloRa(false);
    if (webXR) {
      if (!(await abrir({ urlModelo: src, escalaReal: ra.escalaReal }))) setFalloRa(true);
      return;
    }
    const el = visor.current;
    if (!el) return;
    // Al terminar la RA se restaura la escala, para no dejar la vista previa escalada ni
    // leer medidas escaladas. En Scene Viewer y en Quick Look con ios-src la escala no se
    // aplica (limitación conocida, igual que en el comensal).
    const restaurar = (e: Event) => {
      const estado = (e as CustomEvent<{ status: string }>).detail?.status;
      if (estado !== 'not-presenting' && estado !== 'failed') return;
      el.scale = '1 1 1';
      el.removeEventListener('ar-status', restaurar);
    };
    el.addEventListener('ar-status', restaurar);
    el.scale = `${ra.escalaReal} ${ra.escalaReal} ${ra.escalaReal}`;
    try {
      await el.activateAR();
    } catch {
      el.scale = '1 1 1';
      el.removeEventListener('ar-status', restaurar);
      setFalloRa(true);
    }
  }

  const mostrarBoton = ra && (webXR === true || (webXR === false && puedeVerRa));

  return (
    <div className="space-y-3">
      <div className="relative">
        {listo ? (
          <model-viewer
            key={src}
            ref={visor}
            src={src}
            ios-src={ra?.urlModeloIos ?? undefined}
            alt={`Vista previa de ${nombre}`}
            ar={webXR === false}
            ar-modes="quick-look scene-viewer"
            ar-scale="fixed"
            camera-controls
            touch-action="pan-y"
            style={{
              width: '100%',
              height: '16rem',
              background: 'var(--color-panel)',
              borderRadius: 10,
            }}
          >
            {/* Oculta el botón por defecto de model-viewer: la única entrada es "Ver en mi mesa". */}
            <button slot="ar-button" hidden />
          </model-viewer>
        ) : (
          <div className="h-64 rounded-control bg-panel" />
        )}
        {borrador && (
          <span className="absolute left-2 top-2">
            <Etiqueta tono="warn">Borrador</Etiqueta>
          </span>
        )}
      </div>
      {mostrarBoton && (
        <Boton variante="secundario" onClick={() => void verEnMiMesa()} disabled={sesion !== null}>
          <Eye aria-hidden className="size-4" />
          {sesion === 'abriendo' ? 'Abriendo…' : 'Ver en mi mesa'}
        </Boton>
      )}
      {webXR === false && puedeVerRa === false && (
        <p className="text-sm text-meta">
          Para verlo sobre tu mesa, como lo ven los comensales, abrí esta pantalla desde un celular
          compatible.
        </p>
      )}
      {falloRa && (
        <Aviso tono="bad">
          No se pudo abrir la cámara para verlo en la mesa. Revisá el permiso e intentá de nuevo.
        </Aviso>
      )}
      <CapaRa
        capa={capa}
        sesion={sesion}
        nombre={nombre}
        porcion={ra?.porcion}
        diagnostico={diagnostico}
        alSalir={salir}
      />
    </div>
  );
}

// CU-16, modelo 3D del plato: se escanea con 4 fotos, se revisa la calidad antes
// de enviarlo, se espera el modelo y se revisa el borrador antes de publicarlo.
export function EscaneoModal({
  plato,
  onCerrar,
  onCambio,
  onEditarPlato,
}: {
  plato: Plato;
  onCerrar(): void;
  onCambio(): void;
  // Abre el formulario del plato (por ejemplo, para cargar el diámetro).
  onEditarPlato(): void;
}) {
  const actual = plato.modeloRa;
  const { escaneo, error: errorConsulta, recargar } = useEscaneo(plato.id);
  const confirmar = useConfirmar();

  const [modo, setModo] = useState<Modo>('inicio');
  const [fotos, setFotos] = useState<Record<VistaEscaneo, Blob> | null>(null);
  const [informe, setInforme] = useState<Informe | null>(null);
  const [progreso, setProgreso] = useState<ProgresoEscaneo>(PROGRESO_INICIAL);
  const [soporta, setSoporta] = useState<boolean | null>(null);
  const capa = useRef<HTMLDivElement>(null);
  const cortar = useRef<AbortController | null>(null);
  const [porcion, setPorcion] = useState(actual ? String(actual.porcionGramos) : '');
  const [medidas, setMedidas] = useState<Dimensiones | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoNoEnviado, setAvisoNoEnviado] = useState(false);
  // Escaneos fallidos cuyo aviso se cerró en esta apertura (cubre también si localStorage falla).
  const [fallasCerradas, setFallasCerradas] = useState<string[]>([]);

  const gramosPorcion = Number(porcion);
  const porcionValida =
    porcion.trim() !== '' &&
    Number.isInteger(gramosPorcion) &&
    gramosPorcion >= 1 &&
    gramosPorcion <= 10000;

  const estado = escaneo?.estado;
  const vista =
    escaneo === undefined
      ? 'cargando'
      : estado === 'PENDIENTE' || estado === 'PROCESANDO'
        ? 'generando'
        : estado === 'EN_REVISION'
          ? 'revision'
          : modo;
  const urlVista = vista === 'revision' ? escaneo?.urlModelo : (actual?.urlModelo ?? null);
  const medidasVista = medidas && medidas.src === urlVista ? medidas : null;

  // Cuando el modelo termina de generarse, la lista de Platos se entera.
  const estadoPrevio = useRef(estado);
  useEffect(() => {
    if (estadoPrevio.current !== estado && estadoPrevio.current !== undefined) onCambio();
    estadoPrevio.current = estado;
  });

  // Cuando manda el estado del escaneo (generando o para revisar), lo de las fotos anteriores ya
  // no aplica: ni su informe ni el error de ese envío. Si el escaneo falla, se vuelve al inicio.
  // El aviso de "no se envió" sí se conserva. Va en un efecto de layout para que un error viejo
  // no llegue a pintarse en la vista de revisión.
  const mandaElEscaneo = vista === 'generando' || vista === 'revision';
  useLayoutEffect(() => {
    if (!mandaElEscaneo) return;
    // Si había una sesión de cámara abierta, se corta antes de volver al inicio.
    cortar.current?.abort();
    setModo('inicio');
    setFotos(null);
    setInforme(null);
    setError(null);
  }, [mandaElEscaneo]);

  // Si el dispositivo puede escanear (WebXR); en la compu no, y el modal sigue
  // sirviendo para revisar y publicar.
  useEffect(() => {
    let vigente = true;
    void import('../../lib/escaneo-webxr')
      .then((m) => m.soportaEscaneoRa())
      .catch(() => false)
      .then((ok) => {
        if (vigente) setSoporta(ok);
      });
    return () => {
      vigente = false;
    };
  }, []);

  // Si se cierra el modal con el escaneo abierto, se corta la sesión.
  useEffect(() => () => cortar.current?.abort(), []);

  // Miniaturas de las 4 fotos antes de enviar; se liberan al volver o desmontar.
  const [miniaturas, setMiniaturas] = useState<Record<VistaEscaneo, string> | null>(null);
  useEffect(() => {
    if (!fotos) {
      setMiniaturas(null);
      return;
    }
    const urls = {} as Record<VistaEscaneo, string>;
    for (const v of VISTAS) urls[v] = URL.createObjectURL(fotos[v]);
    setMiniaturas(urls);
    return () => {
      for (const v of VISTAS) URL.revokeObjectURL(urls[v]);
    };
  }, [fotos]);

  // El último escaneo fallido se avisa hasta que el usuario lo cierra, tenga o no modelo el plato.
  const fallaVisible =
    escaneo?.estado === 'FALLIDO' &&
    !fallasCerradas.includes(escaneo.id) &&
    !fallaYaVista(escaneo.id)
      ? escaneo
      : null;

  function cerrarFalla(id: string) {
    recordarFallaVista(id);
    setFallasCerradas((ids) => [...ids, id]);
  }

  // `conservarEscala`: al guardar solo la porción de un modelo ya publicado, la escala no se
  // recalcula (el modelo publicado mantiene su tamaño hasta volver a escanear).
  function datosMedidas(conservarEscala = false): ModeloRaInput | string {
    const gramos = Number(porcion);
    if (!porcionValida) return MOTIVO_PORCION;
    if (conservarEscala && actual) return { escalaReal: actual.escalaReal, porcionGramos: gramos };
    if (plato.diametroCm === null) return MENSAJE_SIN_DIAMETRO;
    if (!medidasVista) return 'Esperá a que cargue la vista previa para guardar';
    return {
      escalaReal: escalaPorDiametro(plato.diametroCm, medidasVista.ancho, medidasVista.profundidad),
      porcionGramos: gramos,
    };
  }

  async function ejecutar(accion: () => Promise<void>, falla: string) {
    setEnviando(true);
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : falla);
    } finally {
      setEnviando(false);
    }
  }

  function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = datosMedidas(true);
    if (typeof datos === 'string') return setError(datos);
    void ejecutar(async () => {
      await api(`/platos/${plato.id}/modelo-ra`, { method: 'PUT', body: datos });
      onCambio();
      onCerrar();
    }, 'No se pudo guardar el modelo');
  }

  function publicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = datosMedidas();
    if (!escaneo) return;
    if (typeof datos === 'string') return setError(datos);
    void ejecutar(async () => {
      await api(`/escaneos/${escaneo.id}/publicar`, { method: 'POST', body: datos });
      setAvisoNoEnviado(false);
      onCambio();
      onCerrar();
    }, 'No se pudo publicar el modelo');
  }

  async function descartar() {
    if (!escaneo) return;
    if (
      !(await confirmar({
        mensaje: `¿Descartar el modelo nuevo de ${plato.nombre}?`,
        detalle: 'Se borra el borrador. Si el plato ya tenía un modelo, se queda con ese.',
        accion: 'Descartar',
      }))
    )
      return;
    void ejecutar(async () => {
      await api(`/escaneos/${escaneo.id}/descartar`, { method: 'POST' });
      setAvisoNoEnviado(false);
      setModo('inicio');
      recargar();
      onCambio();
    }, 'No se pudo descartar el modelo');
  }

  async function quitar() {
    if (
      !(await confirmar({
        mensaje: `¿Quitar el modelo 3D de ${plato.nombre}?`,
        detalle:
          'Se borra el modelo y el plato deja de mostrar "Ver en mi mesa". No se puede deshacer.',
        accion: 'Quitar modelo',
      }))
    )
      return;
    void ejecutar(async () => {
      await api(`/platos/${plato.id}/modelo-ra`, { method: 'DELETE' });
      onCambio();
      onCerrar();
    }, 'No se pudo quitar el modelo');
  }

  async function escanear() {
    if (plato.diametroCm === null) return;
    const diametroCm = plato.diametroCm;
    setError(null);
    setProgreso(PROGRESO_INICIAL);
    setModo('escaneando');
    const control = new AbortController();
    cortar.current = control;
    let modulo: typeof import('../../lib/escaneo-webxr');
    let umbrales: UmbralesCalidad;
    try {
      [modulo, umbrales] = await Promise.all([
        import('../../lib/escaneo-webxr'),
        api<UmbralesCalidad>('/escaneos/requisitos'),
      ]);
    } catch (e) {
      // Sin respuesta de la API (red caída o error del servidor): no es un problema de la cámara.
      if (cortar.current === control) cortar.current = null;
      // Si la sesión ya se cortó (Cancelar o llegó otro escaneo), el error no aplica.
      if (control.signal.aborted) {
        setModo('inicio');
        return;
      }
      if (e instanceof ApiError || e instanceof TypeError) {
        setError('No pudimos conectarnos. Revisá la conexión e intentá de nuevo.');
      } else {
        setError('No pudimos abrir la cámara. Revisá el permiso e intentá de nuevo.');
      }
      setModo('inicio');
      return;
    }
    try {
      if (!capa.current) return;
      const resultado = await modulo.iniciarEscaneo({
        overlay: capa.current,
        diametroCm,
        umbrales,
        onProgreso: setProgreso,
        signal: control.signal,
      });
      if (resultado.estado === 'completo') {
        setFotos(resultado.fotos);
        setInforme(resultado.informe);
        setModo('fotos');
      } else {
        setModo('inicio');
      }
    } catch {
      if (!control.signal.aborted) {
        setError('No pudimos abrir la cámara. Revisá el permiso e intentá de nuevo.');
      }
      setModo('inicio');
    } finally {
      if (cortar.current === control) cortar.current = null;
    }
  }

  function enviar() {
    if (!fotos || !informe) return;
    void ejecutar(async () => {
      // Cada envío empieza limpio: el aviso de un intento anterior no vale para este.
      setAvisoNoEnviado(false);
      try {
        await enviarFotos<Escaneo>(`/platos/${plato.id}/escaneos`, fotos, informe);
      } catch (e) {
        // Un escaneo que ya estaba en curso: se muestra ese en vez de las fotos y se avisa
        // que estas no se enviaron.
        if (e instanceof ApiError && e.status === 409) {
          setAvisoNoEnviado(true);
          recargar();
          return;
        }
        throw e;
      }
      setFotos(null);
      setInforme(null);
      setModo('inicio');
      recargar();
      onCambio();
    }, 'No pudimos enviar las fotos');
  }

  function escanearDeNuevo() {
    setFotos(null);
    setInforme(null);
    setError(null);
    setModo('inicio');
  }

  const camposMedidas = (
    <Campo
      etiqueta="Porción (g)"
      ayuda="Los comensales la ven junto al plato, por ejemplo 350 g."
      error={porcionValida ? undefined : MOTIVO_PORCION}
    >
      <input
        type="number"
        inputMode="numeric"
        min={1}
        required
        value={porcion}
        onChange={(e) => setPorcion(e.target.value)}
        className={claseInput}
      />
    </Campo>
  );

  const avisoNoEnviadoTexto = (
    <Aviso>
      {avisoNoEnviado
        ? 'Ya había un escaneo en curso para este plato. Tus fotos no se enviaron.'
        : null}
    </Aviso>
  );

  // "Ver en mi mesa" del borrador: a la escala que se guarda al publicar, cuando ya hay medidas.
  const raBorrador =
    escaneo?.urlModelo && plato.diametroCm !== null && medidasVista
      ? {
          escalaReal: escalaPorDiametro(
            plato.diametroCm,
            medidasVista.ancho,
            medidasVista.profundidad,
          ),
          urlModeloIos: escaneo.urlModeloIos ?? null,
          ...(porcionValida && { porcion: formatoCantidad(gramosPorcion, 'GRAMO') }),
        }
      : null;

  // "Ver en mi mesa" del publicado: con la escala y la porción guardadas, las que ve el comensal.
  const raPublicado = actual && {
    escalaReal: actual.escalaReal,
    urlModeloIos: actual.urlModeloIos,
    porcion: formatoCantidad(actual.porcionGramos, 'GRAMO'),
  };

  const textoTamano =
    plato.diametroCm === null
      ? MENSAJE_SIN_DIAMETRO
      : `Se va a ver en su tamaño real: el plato mide ${String(plato.diametroCm).replace('.', ',')} cm de diámetro.`;
  const puedeEscanear = plato.diametroCm !== null && soporta === true;
  // Un solo motivo por vez: el diámetro tiene prioridad sobre el soporte del dispositivo.
  const sinDiametro = plato.diametroCm === null;
  const mostrarEscanear = soporta !== false;

  const cuerpo = (() => {
    switch (vista) {
      case 'cargando':
        return <p className="text-sm text-meta">{errorConsulta ?? 'Cargando…'}</p>;

      case 'generando':
        return (
          <>
            {avisoNoEnviadoTexto}
            <div className="grid h-64 place-content-center justify-items-center gap-2 text-center">
              <Loader aria-hidden className="size-8 text-accent motion-safe:animate-spin" />
              <p className="text-lg font-semibold text-ink">Estamos armando el modelo</p>
              <p className="max-w-[45ch] text-sm text-meta">
                Puede tardar unos minutos. Podés cerrar esta ventana: en la lista de platos vas a
                ver «Generando» hasta que esté listo.
              </p>
            </div>
            <Pie>
              <Boton variante="secundario" onClick={onCerrar}>
                Cerrar
              </Boton>
            </Pie>
          </>
        );

      case 'escaneando':
        return (
          <div className="grid h-64 place-content-center justify-items-center gap-2 text-center">
            <Loader aria-hidden className="size-8 text-accent motion-safe:animate-spin" />
            <p className="text-lg font-semibold text-ink">Abriendo la cámara…</p>
          </div>
        );

      case 'fotos': {
        if (!informe) return null;
        const nivel = informe.nivelGlobal;
        return (
          <div className="space-y-4">
            <InformeCalidad informe={informe} miniaturas={miniaturas ?? undefined} />
            <Aviso>{error}</Aviso>
            <Pie>
              <Boton
                variante={nivel === 'RECHAZO' ? 'principal' : 'secundario'}
                onClick={escanearDeNuevo}
                disabled={enviando}
              >
                Volver a escanear
              </Boton>
              {nivel !== 'RECHAZO' && (
                <Boton onClick={enviar} disabled={enviando}>
                  {enviando ? 'Enviando…' : nivel === 'OK' ? 'Enviar' : 'Enviar igual'}
                </Boton>
              )}
            </Pie>
          </div>
        );
      }

      case 'revision':
        return (
          <form onSubmit={publicar} className="space-y-4">
            {avisoNoEnviadoTexto}
            {escaneo?.urlModelo && (
              <Vista
                src={escaneo.urlModelo}
                nombre={plato.nombre}
                borrador
                onMedidas={setMedidas}
                ra={raBorrador}
              />
            )}
            <p className="text-sm text-meta">{textoTamano}</p>
            {camposMedidas}
            <Aviso>{error}</Aviso>
            <Pie>
              <Boton
                variante="peligro"
                onClick={descartar}
                disabled={enviando}
                className="sm:mr-auto"
              >
                Descartar
              </Boton>
              <Boton type="submit" disabled={enviando || !porcionValida}>
                <Check aria-hidden className="size-4" />
                {enviando ? 'Publicando…' : 'Publicar'}
              </Boton>
            </Pie>
          </form>
        );

      default:
        return (
          <form onSubmit={guardar} className="space-y-4">
            {actual ? (
              <Vista
                src={actual.urlModelo}
                nombre={plato.nombre}
                onMedidas={setMedidas}
                ra={raPublicado}
              />
            ) : (
              <Vacio icono={Box} titulo="Este plato todavía no tiene modelo 3D" />
            )}
            {actual && (
              <>
                <p className="text-sm text-meta">{textoTamano}</p>
                {camposMedidas}
              </>
            )}
            {puedeEscanear && (
              <p className="text-sm text-meta">
                Vas a caminar alrededor del plato con el celular y la app saca 4 fotos sola.
              </p>
            )}
            <Aviso
              accion={
                fallaVisible && (
                  <Boton variante="fantasma" onClick={() => cerrarFalla(fallaVisible.id)}>
                    Entendido
                  </Boton>
                )
              }
            >
              {fallaVisible &&
                (fallaVisible.error ?? 'No pudimos armar el modelo. Probá de nuevo.')}
            </Aviso>
            <Aviso>{error}</Aviso>
            <Aviso
              tono="info"
              accion={
                sinDiametro && (
                  <Boton variante="fantasma" onClick={onEditarPlato}>
                    Editar plato
                  </Boton>
                )
              }
            >
              {sinDiametro ? MENSAJE_SIN_DIAMETRO : soporta === false ? MENSAJE_SIN_SOPORTE : null}
            </Aviso>
            <Pie>
              {actual && (
                <Boton
                  variante="peligro"
                  onClick={quitar}
                  disabled={enviando}
                  className="sm:mr-auto"
                >
                  Quitar modelo
                </Boton>
              )}
              {mostrarEscanear && (
                <Boton
                  variante={actual ? 'secundario' : 'principal'}
                  onClick={() => void escanear()}
                  disabled={enviando || !puedeEscanear}
                >
                  <Camera aria-hidden className="size-4" />
                  Escanear plato
                </Boton>
              )}
              {actual && (
                <Boton type="submit" disabled={enviando || !porcionValida}>
                  {enviando ? 'Guardando…' : 'Guardar'}
                </Boton>
              )}
            </Pie>
          </form>
        );
    }
  })();

  return (
    <Modal titulo={`Modelo 3D: ${plato.nombre}`} onCerrar={onCerrar}>
      <div aria-live="polite">{cuerpo}</div>
      {/* Capa sobre la cámara durante el escaneo (dom-overlay de WebXR). */}
      <div ref={capa} className={modo === 'escaneando' ? 'fixed inset-0 z-50' : 'hidden'}>
        <div className="absolute inset-x-4 top-4 space-y-2 rounded-panel bg-black/60 px-4 py-3 text-center text-white">
          <p className="font-medium">{plato.nombre}</p>
          <p className="text-base" aria-live="polite">
            {progreso.mensaje}
          </p>
          <ul className="flex flex-wrap justify-center gap-2">
            {VISTAS.map((v) => (
              <li
                key={v}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  progreso.vistas[v] ? 'bg-ok text-white' : 'border border-white/50 text-white/80'
                }`}
              >
                {progreso.vistas[v] && <Check aria-hidden className="size-3.5" />}
                {NOMBRES_VISTA[v]}
              </li>
            ))}
          </ul>
        </div>
        <div className="absolute inset-x-4 bottom-8 flex justify-center">
          <button
            type="button"
            ref={(b) => {
              b?.addEventListener('beforexrselect', frenarSeleccion);
            }}
            onClick={() => cortar.current?.abort()}
            className="min-h-12 rounded-full bg-surface px-6 font-semibold text-ink shadow-flotante"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
