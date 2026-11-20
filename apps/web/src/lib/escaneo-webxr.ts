/// <reference types="webxr" />
import {
  ANGULO_VISTA,
  TRAMOS_AUREOLA,
  VISTAS,
  anguloAlrededor,
  anguloRelativo,
  apuntaAlCentro,
  aLuminancia,
  evaluarCalidad,
  evaluarFoto,
  radioAureolaM,
  tramoDeAngulo,
  vistaCercana,
  vueltaCompleta,
  type FotoEvaluable,
  type InformeCalidad,
  type Punto3,
  type UmbralesCalidad,
  type VistaEscaneo,
} from '@pgim/shared';
import {
  CircleGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from 'three';
import { MS_SIN_SUPERFICIE, abrirFuenteImpacto, conCapaClasica, crearAnillo } from './ra-webxr';

// Escaneo del plato en RA (CU-10). El staff ancla el centro del plato, camina
// alrededor y la app saca sola 4 fotos (frente, izquierda, atrás y derecha) cuando
// el celular apunta al plato, está quieto y la foto pasa la verificación. Las
// decisiones de geometría y calidad viven en @pgim/shared; acá solo está WebXR.

export type FaseEscaneo = 'colocar' | 'recorrer';
export interface ProgresoEscaneo {
  fase: FaseEscaneo;
  tramos: boolean[];
  vistas: Record<VistaEscaneo, boolean>;
  mensaje: string;
}
export type ResultadoEscaneoRa =
  | { estado: 'completo'; fotos: Record<VistaEscaneo, Blob>; informe: InformeCalidad }
  | { estado: 'cancelado' };

export interface OpcionesEscaneo {
  // Capa HTML sobre la cámara (la dibuja el modal).
  overlay: HTMLElement;
  diametroCm: number;
  umbrales: UmbralesCalidad;
  onProgreso(p: ProgresoEscaneo): void;
}

// getCameraImage (módulo camera-access) todavía no está en @types/webxr.
interface CamaraXR {
  width: number;
  height: number;
}
interface VistaConCamara extends XRView {
  camera?: CamaraXR;
}
interface BindingConCamara {
  getCameraImage(camara: CamaraXR): WebGLTexture;
}

const TOLERANCIA_VISTA_GRADOS = 10;
const APUNTA_AL_PLATO_GRADOS = 15;
// Giro máximo entre dos cuadros seguidos para considerar que el celular está quieto.
const QUIETUD_MAX_GRADOS = 2;
// Entre dos intentos de foto de la misma vista: leer la cámara es caro y, si el
// intento falla, repetirlo en el cuadro siguiente daría lo mismo.
const MS_ENTRE_INTENTOS = 600;
const DISTANCIA_MAX_M = 0.8;
const ANCHO_MUESTRA_PX = 320;
const CALIDAD_JPEG = 0.9;

const COLOR_PENDIENTE = 0xffffff;
const COLOR_RECORRIDO = 0xb68235; // Dorado
const COLOR_LISTO = 0x1d5fb4; // Azul Listo
const COLOR_FILETE = 0x0f172a;
const Y_AUREOLA = 0.001; // 1 mm sobre la mesa
const ANCHO_BANDA_M = 0.016;
const GRADOS_SECTOR = 8.5;
const GRADOS_SEPARACION = 1.5;

const rad = (g: number) => (g * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

const DE_LA_VISTA: Record<VistaEscaneo, string> = {
  front: 'frente',
  left: 'la izquierda',
  back: 'atrás',
  right: 'la derecha',
};

export async function soportaEscaneoRa(): Promise<boolean> {
  try {
    return (await navigator.xr?.isSessionSupported('immersive-ar')) ?? false;
  } catch {
    return false;
  }
}

interface Aureola {
  grupo: Group;
  sectores: Mesh[];
  marcas: Record<VistaEscaneo, Mesh>;
  materialPendiente: MeshBasicMaterial;
  materialRecorrido: MeshBasicMaterial;
  materialMarcaPendiente: MeshBasicMaterial;
  materialMarcaLista: MeshBasicMaterial;
  liberar(): void;
}

// Banda de 36 sectores con filetes oscuros continuos por dentro y por fuera, y
// una barra radial por vista. Todo en el plano de la mesa, sin aros superpuestos.
// El grupo se gira con el ángulo de partida para que el 0° sea el frente.
function crearAureola(diametroCm: number, inicio: number): Aureola {
  const geometrias: BufferGeometry[] = [];
  const materiales: MeshBasicMaterial[] = [];
  const material = (color: number, opacidad: number) => {
    const m = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: opacidad,
      depthWrite: false,
    });
    materiales.push(m);
    return m;
  };
  const malla = <G extends BufferGeometry>(g: G, m: MeshBasicMaterial, orden: number, y = 0) => {
    geometrias.push(g);
    const mesh = new Mesh(g, m);
    mesh.renderOrder = orden;
    mesh.position.y = y;
    return mesh;
  };

  const radio = radioAureolaM(diametroCm);
  const radioExterior = radio + ANCHO_BANDA_M;
  const filete = material(COLOR_FILETE, 0.55);
  const materialPendiente = material(COLOR_PENDIENTE, 0.45);
  const materialRecorrido = material(COLOR_RECORRIDO, 0.95);
  const materialMarcaPendiente = material(COLOR_PENDIENTE, 0.95);
  const materialMarcaLista = material(COLOR_LISTO, 0.95);

  const grupo = new Group();
  grupo.rotation.y = -rad(inicio);
  grupo.position.y = Y_AUREOLA;

  // RingGeometry mide el ángulo desde +X en sentido antihorario; después de
  // rotateX(-90°) la partida (-Z) y el sentido horario salen de φ = 90° - a.
  const sectores: Mesh[] = [];
  const paso = 360 / TRAMOS_AUREOLA;
  for (let i = 0; i < TRAMOS_AUREOLA; i++) {
    const a1 = i * paso + GRADOS_SEPARACION / 2 + GRADOS_SECTOR;
    const sector = malla(
      new RingGeometry(radio, radioExterior, 4, 1, rad(90 - a1), rad(GRADOS_SECTOR)).rotateX(
        -Math.PI / 2,
      ),
      materialPendiente,
      2,
    );
    sectores.push(sector);
    grupo.add(sector);
  }
  grupo.add(
    malla(new RingGeometry(radio - 0.0025, radio, 96).rotateX(-Math.PI / 2), filete, 1),
    malla(
      new RingGeometry(radioExterior, radioExterior + 0.0025, 96).rotateX(-Math.PI / 2),
      filete,
      1,
    ),
  );

  // Marcas de vista: una barra radial por fuera de la banda; la del frente, más larga.
  const marcas = {} as Record<VistaEscaneo, Mesh>;
  for (const vista of VISTAS) {
    const largo = vista === 'front' ? 0.018 : 0.012;
    const desde = radioExterior + 0.0025 + 0.003;
    const orientada = new Group();
    orientada.rotation.y = -rad(ANGULO_VISTA[vista]);
    const fondo = malla(
      new PlaneGeometry(0.006, largo + 0.003).rotateX(-Math.PI / 2),
      filete,
      1,
      -0.0004,
    );
    const barra = malla(
      new PlaneGeometry(0.003, largo).rotateX(-Math.PI / 2),
      materialMarcaPendiente,
      2,
    );
    fondo.position.z = barra.position.z = -(desde + largo / 2);
    orientada.add(fondo, barra);
    grupo.add(orientada);
    marcas[vista] = barra;
  }

  // El punto central de la retícula queda fijo en el ancla.
  const blanco = material(COLOR_PENDIENTE, 0.95);
  const punto = malla(new CircleGeometry(0.0075, 32).rotateX(-Math.PI / 2), blanco, 2);
  const borde = malla(new RingGeometry(0.0075, 0.0095, 32).rotateX(-Math.PI / 2), filete, 1);
  grupo.add(punto, borde);

  return {
    grupo,
    sectores,
    marcas,
    materialPendiente,
    materialRecorrido,
    materialMarcaPendiente,
    materialMarcaLista,
    liberar() {
      geometrias.forEach((g) => g.dispose());
      materiales.forEach((m) => m.dispose());
    },
  };
}

function aBlob(lienzo: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => lienzo.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG));
}

// Abre la sesión y resuelve cuando se toman las 4 fotos o se corta. Si el
// navegador rechaza la sesión (sin permiso de cámara, por ejemplo) la promesa
// falla y el modal muestra el aviso.
export async function iniciarEscaneo(opciones: OpcionesEscaneo): Promise<ResultadoEscaneoRa> {
  const { overlay, diametroCm, umbrales, onProgreso } = opciones;

  const renderer = new WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');

  const escena = new Scene();
  const camara = new PerspectiveCamera();
  const { anillo: reticula } = crearAnillo();
  escena.add(reticula);

  let sesion: XRSession;
  try {
    sesion = await navigator.xr!.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'local', 'camera-access'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: overlay },
    });
  } catch (e) {
    renderer.dispose();
    throw e;
  }

  return new Promise<ResultadoEscaneoRa>((resolverPromesa, rechazarPromesa) => {
    // --- Estado ---
    let resuelto = false;
    let fuenteImpacto: XRHitTestSource | null = null;
    let aureola: Aureola | null = null;
    let framebuffer: WebGLFramebuffer | null = null;
    let binding: (XRWebGLBinding & BindingConCamara) | null = null;
    let centro: Punto3 | null = null;
    let inicio = 0;
    let fase: FaseEscaneo = 'colocar';
    let mensajeRechazo: { vista: VistaEscaneo; texto: string } | null = null;
    const tramos: boolean[] = new Array<boolean>(TRAMOS_AUREOLA).fill(false);
    const vistas: Record<VistaEscaneo, boolean> = {
      front: false,
      left: false,
      back: false,
      right: false,
    };
    // Una vista queda reservada desde que se pide la foto hasta que se confirma o
    // falla el JPEG, y no se reintenta antes de MS_ENTRE_INTENTOS.
    const enCurso: Record<VistaEscaneo, boolean> = {
      front: false,
      left: false,
      back: false,
      right: false,
    };
    const ultimoIntento: Partial<Record<VistaEscaneo, number>> = {};
    const blobs: Partial<Record<VistaEscaneo, Blob>> = {};
    const evaluables: Partial<Record<VistaEscaneo, FotoEvaluable>> = {};
    let ultimaPosicion: Punto3 | null = null;
    let direccionPrevia: Vector3 | null = null;
    let ultimoProgreso = '';
    let ultimaSuperficie = -Infinity;
    const matriz = new Matrix4();
    const adelante = new Vector3();
    const cuaternion = new Quaternion();
    const lienzo = document.createElement('canvas');
    const lienzoMuestra = document.createElement('canvas');

    const emitir = (mensaje: string) => {
      const progreso: ProgresoEscaneo = {
        fase,
        tramos: [...tramos],
        vistas: { ...vistas },
        mensaje,
      };
      const huella = JSON.stringify(progreso);
      if (huella === ultimoProgreso) return;
      ultimoProgreso = huella;
      onProgreso(progreso);
    };

    // --- Liberación: se corre una sola vez, cualquiera sea el motivo del fin ---
    let liberado = false;
    const alTerminar = () => {
      if (liberado) return;
      liberado = true;
      sesion.removeEventListener('select', alTocar);
      sesion.removeEventListener('end', alTerminar);
      renderer.setAnimationLoop(null);
      fuenteImpacto?.cancel();
      fuenteImpacto = null;
      if (framebuffer) renderer.getContext().deleteFramebuffer(framebuffer);
      framebuffer = null;
      reticula.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (o.material as MeshBasicMaterial).dispose();
        }
      });
      aureola?.liberar();
      renderer.dispose();
      if (!resuelto) {
        resuelto = true;
        resolverPromesa({ estado: 'cancelado' });
      }
    };

    const terminarCompleto = () => {
      if (resuelto) return;
      const fotos = {} as Record<VistaEscaneo, Blob>;
      const evaluadas: FotoEvaluable[] = [];
      for (const vista of VISTAS) {
        fotos[vista] = blobs[vista]!;
        evaluadas.push(evaluables[vista]!);
      }
      resuelto = true;
      resolverPromesa({
        estado: 'completo',
        fotos,
        informe: evaluarCalidad(evaluadas, umbrales),
      });
      void sesion.end().catch(() => undefined);
    };

    // --- Colocar ---
    function alTocar() {
      if (fase !== 'colocar' || !reticula.visible) return;
      const punto = new Vector3().setFromMatrixPosition(reticula.matrix);
      centro = { x: punto.x, y: punto.y, z: punto.z };
      inicio = ultimaPosicion ? anguloAlrededor(centro, ultimaPosicion) : 0;
      aureola = crearAureola(diametroCm, inicio);
      aureola.grupo.position.set(centro.x, centro.y + Y_AUREOLA, centro.z);
      escena.add(aureola.grupo);
      reticula.visible = false;
      fuenteImpacto?.cancel();
      fuenteImpacto = null;
      fase = 'recorrer';
      navigator.vibrate?.(30);
    }

    // --- Foto: cámara → framebuffer → canvas → luminancia y JPEG ---
    function sacarFoto(vista: VistaEscaneo, camaraXR: CamaraXR, anguloGrados: number): void {
      const gl = renderer.getContext();
      const { width: ancho, height: alto } = camaraXR;
      const textura = binding!.getCameraImage(camaraXR);
      framebuffer ??= gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textura, 0);
      const completo = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      const pixeles = new Uint8Array(ancho * alto * 4);
      if (completo) gl.readPixels(0, 0, ancho, alto, gl.RGBA, gl.UNSIGNED_BYTE, pixeles);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      renderer.resetState();
      if (!completo) return;

      // readPixels entrega las filas de abajo hacia arriba: se dan vuelta.
      lienzo.width = ancho;
      lienzo.height = alto;
      const ctx = lienzo.getContext('2d')!;
      const imagen = ctx.createImageData(ancho, alto);
      for (let y = 0; y < alto; y++) {
        imagen.data.set(
          pixeles.subarray((alto - 1 - y) * ancho * 4, (alto - y) * ancho * 4),
          y * ancho * 4,
        );
      }
      ctx.putImageData(imagen, 0, 0);

      const escala = Math.min(1, ANCHO_MUESTRA_PX / ancho);
      const anchoM = Math.max(1, Math.round(ancho * escala));
      const altoM = Math.max(1, Math.round(alto * escala));
      lienzoMuestra.width = anchoM;
      lienzoMuestra.height = altoM;
      const ctxM = lienzoMuestra.getContext('2d', { willReadFrequently: true })!;
      ctxM.drawImage(lienzo, 0, 0, anchoM, altoM);
      const muestra = aLuminancia(ctxM.getImageData(0, 0, anchoM, altoM).data, anchoM, altoM);

      const foto: FotoEvaluable = { vista, anguloGrados, ancho, alto, muestra };
      const rechazo = evaluarFoto(foto, umbrales)
        .criterios.filter((c) => c.nivel === 'RECHAZO')
        .find((c) => c.mensaje);
      if (rechazo) {
        mensajeRechazo = { vista, texto: rechazo.mensaje! };
        return;
      }

      // El JPEG se arma después: la vista queda reservada hasta tenerlo.
      enCurso[vista] = true;
      vistas[vista] = true;
      mensajeRechazo = null;
      navigator.vibrate?.(30);
      void aBlob(lienzo).then((blob) => {
        enCurso[vista] = false;
        if (!blob || resuelto) {
          vistas[vista] = false;
          return;
        }
        blobs[vista] = blob;
        evaluables[vista] = foto;
      });
    }

    // --- Cuadro ---
    const alCuadro = (tiempo: number, cuadro?: XRFrame) => {
      if (!cuadro || resuelto) return;
      const espacio = renderer.xr.getReferenceSpace();
      const pose = espacio ? cuadro.getViewerPose(espacio) : undefined;
      const vista = pose?.views[0] as VistaConCamara | undefined;
      if (vista) {
        const p = vista.transform.position;
        ultimaPosicion = { x: p.x, y: p.y, z: p.z };
      }

      if (fase === 'colocar') {
        const impacto =
          fuenteImpacto && espacio ? cuadro.getHitTestResults(fuenteImpacto)[0] : undefined;
        const posicion = espacio ? impacto?.getPose(espacio) : undefined;
        if (posicion) {
          reticula.matrix.copy(matriz.fromArray(posicion.transform.matrix));
          ultimaSuperficie = tiempo;
        }
        const apuntando = tiempo - ultimaSuperficie < MS_SIN_SUPERFICIE;
        reticula.visible = apuntando;
        emitir(
          apuntando
            ? 'Apuntá al centro del plato y tocá'
            : 'Mové el celular despacio hasta ver la mesa',
        );
      } else if (centro && aureola && vista) {
        recorrer(tiempo, vista);
      }
      renderer.render(escena, camara);
    };

    function recorrer(tiempo: number, vista: VistaConCamara) {
      const centroFijo = centro!;
      const p = vista.transform.position;
      const o = vista.transform.orientation;
      const posicion: Punto3 = { x: p.x, y: p.y, z: p.z };
      const relativo = anguloRelativo(anguloAlrededor(centroFijo, posicion), inicio);

      const tramo = tramoDeAngulo(relativo);
      if (!tramos[tramo]) {
        tramos[tramo] = true;
        aureola!.sectores[tramo]!.material = aureola!.materialRecorrido;
      }
      for (const v of VISTAS) {
        aureola!.marcas[v].material = vistas[v]
          ? aureola!.materialMarcaLista
          : aureola!.materialMarcaPendiente;
      }

      // Dirección de la cámara: -Z del visor girado por su orientación.
      cuaternion.set(o.x, o.y, o.z, o.w);
      adelante.set(0, 0, -1).applyQuaternion(cuaternion);
      const giro = direccionPrevia ? deg(adelante.angleTo(direccionPrevia)) : Infinity;
      direccionPrevia = (direccionPrevia ?? new Vector3()).copy(adelante);

      const cercana = vistaCercana(relativo, TOLERANCIA_VISTA_GRADOS);
      const pendiente = cercana && !vistas[cercana] ? cercana : null;
      if (!pendiente && mensajeRechazo && mensajeRechazo.vista !== cercana) mensajeRechazo = null;

      let mensaje = 'Caminá alrededor del plato';
      if (pendiente) {
        const distancia = Math.hypot(
          centroFijo.x - posicion.x,
          centroFijo.y - posicion.y,
          centroFijo.z - posicion.z,
        );
        const apunta = apuntaAlCentro(posicion, adelante, centroFijo, APUNTA_AL_PLATO_GRADOS);
        if (!apunta) mensaje = 'Apuntá el celular al plato';
        else if (distancia > DISTANCIA_MAX_M) mensaje = 'Acercate un poco más';
        else if (mensajeRechazo?.vista === pendiente) mensaje = mensajeRechazo.texto;
        else mensaje = 'Sostené el celular quieto';

        const reciente = tiempo - (ultimoIntento[pendiente] ?? -Infinity) < MS_ENTRE_INTENTOS;
        if (
          apunta &&
          distancia <= DISTANCIA_MAX_M &&
          giro < QUIETUD_MAX_GRADOS &&
          !enCurso[pendiente] &&
          !reciente &&
          vista.camera &&
          binding
        ) {
          ultimoIntento[pendiente] = tiempo;
          try {
            sacarFoto(pendiente, vista.camera, relativo);
          } catch {
            // Un intento fallido no corta el escaneo: se reintenta pasado el plazo.
          }
        }
      } else if (vueltaCompleta(tramos)) {
        const falta = VISTAS.find((v) => !vistas[v]);
        if (falta) mensaje = `Falta la foto de ${DE_LA_VISTA[falta]}: volvé a pasar despacio`;
      }

      emitir(mensaje);
      if (vueltaCompleta(tramos) && VISTAS.every((v) => blobs[v])) terminarCompleto();
    }

    // --- Arranque ---
    // El loop se registra antes de armar la sesión, como en ra-webxr.
    renderer.setAnimationLoop(alCuadro);
    sesion.addEventListener('select', alTocar);
    sesion.addEventListener('end', alTerminar);
    void (async () => {
      try {
        await conCapaClasica(() => renderer.xr.setSession(sesion));
        // El binding va después de setSession; getCameraImage solo vale dentro del
        // cuadro y antes de renderer.render.
        binding = new XRWebGLBinding(sesion, renderer.getContext()) as XRWebGLBinding &
          BindingConCamara;
        fuenteImpacto = await abrirFuenteImpacto(sesion);
        emitir('Mové el celular despacio hasta ver la mesa');
      } catch (e) {
        resuelto = true;
        await sesion.end().catch(() => undefined);
        alTerminar();
        rechazarPromesa(e);
      }
    })();
  });
}
