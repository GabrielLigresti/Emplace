// Operativa diaria de la seed de producción: reservas, cuentas, pedidos, pagos, comprobantes y
// alertas de inasistencia. Es una función pura: el azar, la estructura y los días llegan por
// parámetro y devuelve filas listas para `createMany`.
import { formatearComprobante } from '../domain/pago/pago';
import { DURACION_FRANJA_MIN } from '../domain/reserva/reserva';
import type { Prisma } from '../generated/prisma/client';
import { horaArgentina } from '../lib/hora';
import { uuidDesde, type Azar } from './azar';
import type { ComensalGenerado } from './personas';
import { precioEnFecha } from './precios';
import { FERIADOS_2026, fechaAMs } from './reloj';
import type { CuentaCerrada, EstructuraSucursal, Filas } from './tipos';

const MIN = 60_000;
const DIAS_SEMESTRE = 182;
const TOLERANCIA_NO_SHOW_MIN = 15;

// Volumen medio por día y sucursal: da 7 a 8 reservas de media entre una grande y una chica.
const BASE_GRANDE = 9.5;
const BASE_CHICA = 6;
const MIN_POR_DIA = 3;
const MAX_POR_DIA = 18;
// Domingo a sábado: lunes y martes bajos, viernes y sábado en pico.
const FACTOR_DIA = [1.1, 0.65, 0.7, 0.85, 1.0, 1.3, 1.45];
// Restaurantes que venden más al mediodía.
const DE_MEDIODIA = new Set(['El Bodegón de Don Anselmo', 'Doble Medallón']);

const PESO_HORA: Record<'ALMUERZO' | 'CENA', number[]> = {
  ALMUERZO: [2, 4, 3, 1],
  CENA: [2, 4, 4, 2],
};
const PERSONAS: [number, number][] = [
  [1, 4],
  [2, 38],
  [3, 12],
  [4, 28],
  [5, 7],
  [6, 8],
  [7, 1.5],
  [8, 1.5],
];

const FRACCION_FINALIZADA = 0.85;
const FRACCION_CANCELADA = 0.09;
const FRACCION_MANUAL = 0.1;
const FRACCION_RECHAZO = 0.04;
const FRACCION_PEDIDO_CANCELADO = 0.02;
const FRACCION_ALERTA_RESUELTA = 0.9;
// Un comensal que ya cumplió su cuota sigue pudiendo reservar, con este mínimo de su cuota.
const PISO_CUOTA = 0.1;

const MOTIVOS_CANCELACION = [
  'El cliente cambió de idea',
  'Se acabó el plato',
  'Error al tomar la comanda',
  'Demora en la cocina',
];
const OBSERVACIONES = [
  'Sin sal',
  'Punto jugoso',
  'Bien cocido',
  'Sin cebolla',
  'Sin picante',
  'Apto celíaco',
  'Para compartir',
];

type Plato = EstructuraSucursal['platos'][number];
type Franja = 'ALMUERZO' | 'CENA';
type Par = [Plato, number];

interface Turno {
  suc: number;
  fecha: string;
  franja: Franja;
  inicioMs: number;
  mesaIdx: number;
  personas: number;
}

interface Pools {
  comidas: Par[];
  extras: Par[];
  bebidas: Par[];
  postres: Par[];
  todos: Par[];
}

function mezclar<T>(azar: Azar, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = azar.entero(0, i);
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}

// n banderas con exactamente round(n × fracción) verdaderas, en orden al azar: el reparto sale
// clavado en la fracción y no depende de la suerte de la semilla.
function marcarExactos(azar: Azar, n: number, fraccion: number): boolean[] {
  const cuantas = Math.round(n * fraccion);
  return mezclar(
    azar,
    Array.from({ length: n }, (_, i) => i < cuantas),
  );
}

function horasDe(horario: { horaInicio: string; horaFin: string }): number[] {
  const ini = Number(horario.horaInicio.split(':')[0]);
  let fin = Number(horario.horaFin.split(':')[0]);
  if (fin <= ini) fin = 24;
  return Array.from({ length: fin - ini }, (_, i) => ini + i);
}

function armarPools(platos: Plato[]): Pools {
  const par = (p: Plato): Par => [p, p.popularidad];
  const esBebida = (p: Plato): boolean => /bebida/i.test(p.categoria);
  const esPostre = (p: Plato): boolean => /postre/i.test(p.categoria);
  const esExtra = (p: Plato): boolean => /entrada|guarnici/i.test(p.categoria);
  const comidas = platos.filter((p) => !esBebida(p) && !esPostre(p) && !esExtra(p)).map(par);
  const todos = platos.map(par);
  return {
    comidas: comidas.length ? comidas : todos,
    extras: platos.filter(esExtra).map(par),
    bebidas: platos.filter(esBebida).map(par),
    postres: platos.filter(esPostre).map(par),
    todos,
  };
}

// --- Etapa 1: turnos de mesa -----------------------------------------------------------------

function armarTurnos(azar: Azar, sucursales: EstructuraSucursal[], dias: string[]): Turno[] {
  const turnos: Turno[] = [];
  sucursales.forEach((s, suc) => {
    const horasPorFranja = new Map<Franja, number[]>(s.horarios.map((h) => [h.franja, horasDe(h)]));
    const franjas = [...horasPorFranja.keys()];
    const capacidadMaxima = Math.max(...s.mesas.map((m) => m.capacidad));
    const base = s.grande ? BASE_GRANDE : BASE_CHICA;
    const pCenaBase = DE_MEDIODIA.has(s.restaurante) ? 0.4 : 0.62;

    dias.forEach((fecha, i) => {
      const dia = new Date(fechaAMs(fecha)).getUTCDay();
      // Los últimos meses un poco más altos que los primeros (media 1).
      const tendencia = 0.93 + 0.14 * (dias.length > 1 ? i / (dias.length - 1) : 0.5);
      const feriado = FERIADOS_2026.has(fecha) ? 1.25 : 1;
      const lluvia = azar() < 0.05 ? 0.75 : 1;
      const esperado = base * FACTOR_DIA[dia]! * tendencia * feriado * lluvia;
      const total = Math.min(
        MAX_POR_DIA,
        Math.max(MIN_POR_DIA, Math.round(azar.normal(esperado, esperado * 0.15))),
      );
      const pCena = Math.min(0.9, pCenaBase + (dia === 5 || dia === 6 ? 0.1 : 0));
      const ocupadas = new Map<number, Set<number>>();

      for (let k = 0; k < total; k++) {
        const personas = Math.min(azar.ponderado(PERSONAS), capacidadMaxima);
        for (let intento = 0; intento < 15; intento++) {
          const franja: Franja =
            franjas.length === 1 ? franjas[0]! : azar() < pCena ? 'CENA' : 'ALMUERZO';
          const horas = horasPorFranja.get(franja);
          if (!horas) continue;
          const pesos = PESO_HORA[franja];
          const hora = azar.ponderado(horas.map((h, j) => [h, pesos[j] ?? 2] as [number, number]));
          const usadas = ocupadas.get(hora) ?? new Set<number>();
          const libres = s.mesas
            .map((m, idx) => ({ m, idx }))
            .filter(({ m, idx }) => m.capacidad >= personas && !usadas.has(idx));
          if (libres.length === 0) continue;
          // Prefiere la mesa más justa para el grupo.
          const { idx } = azar.ponderado(
            libres.map((l) => [l, 1 / (1 + l.m.capacidad - personas) ** 2] as [typeof l, number]),
          );
          usadas.add(idx);
          ocupadas.set(hora, usadas);
          turnos.push({
            suc,
            fecha,
            franja,
            inicioMs: fechaAMs(fecha) + (hora + 3) * 60 * MIN,
            mesaIdx: idx,
            personas,
          });
          break;
        }
      }
    });
  });
  // Orden cronológico (estable): el reparto de comensales recorre el semestre en orden.
  return turnos.sort((a, b) => a.inicioMs - b.inicioMs || a.suc - b.suc);
}

// --- Etapa 2: comensal de cada turno ---------------------------------------------------------

// Cada comensal tiene una cuota de visitas para el período (su objetivo del semestre escalado por
// los días). Cada turno se reparte entre los comensales que prefieren ese restaurante, con peso
// igual a la cuota que les queda y sin pasarse del mismo `inicio` de otra reserva propia.
// Si la demanda supera a las cuotas, los comensales siguen reservando con un piso del 10 % de su
// cuota, de modo que el excedente se reparte en proporción a su frecuencia.
function asignarComensales(
  azar: Azar,
  turnos: Turno[],
  sucursales: EstructuraSucursal[],
  comensales: ComensalGenerado[],
  dias: string[],
): number[] {
  const escala = dias.length / DIAS_SEMESTRE;
  const cuota = comensales.map((c) => c.objetivoReservas * escala);
  const hechas = comensales.map(() => 0);
  const ocupado = comensales.map(() => new Set<number>());
  const todos = comensales.map((_, i) => i);
  const porRestaurante = new Map<string, number[]>();
  comensales.forEach((c, i) => {
    for (const r of c.preferidos) {
      const lista = porRestaurante.get(r) ?? [];
      lista.push(i);
      porRestaurante.set(r, lista);
    }
  });

  const elegir = (candidatos: number[], inicioMs: number): number => {
    let total = 0;
    const acumulado = new Float64Array(candidatos.length);
    for (let k = 0; k < candidatos.length; k++) {
      const i = candidatos[k]!;
      if (!ocupado[i]!.has(inicioMs)) {
        total += Math.max(cuota[i]! - hechas[i]!, PISO_CUOTA * cuota[i]!);
      }
      acumulado[k] = total;
    }
    if (total === 0) return -1;
    const punto = azar() * total;
    for (let k = 0; k < candidatos.length; k++) {
      if (acumulado[k]! > punto && !ocupado[candidatos[k]!]!.has(inicioMs)) return candidatos[k]!;
    }
    // Resto de punto flotante: el último disponible.
    for (let k = candidatos.length - 1; k >= 0; k--) {
      if (!ocupado[candidatos[k]!]!.has(inicioMs)) return candidatos[k]!;
    }
    return -1;
  };

  return turnos.map((t) => {
    const restaurante = sucursales[t.suc]!.restaurante;
    let i = elegir(porRestaurante.get(restaurante) ?? todos, t.inicioMs);
    if (i < 0) i = elegir(todos, t.inicioMs);
    if (i < 0) throw new Error('No hay comensales libres para el turno');
    hechas[i] = hechas[i]! + 1;
    ocupado[i]!.add(t.inicioMs);
    return i;
  });
}

// --- Etapa 3: consumo, pagos y alertas -------------------------------------------------------

interface LineaArmada {
  plato: Plato;
  cantidad: number;
  observaciones: string | null;
}

export function generarOperativa(
  azar: Azar,
  sucursales: EstructuraSucursal[],
  comensales: ComensalGenerado[],
  dias: string[],
): { filas: Filas; cuentasCerradas: CuentaCerrada[] } {
  const turnos = armarTurnos(azar, sucursales, dias);
  const comensalDe = asignarComensales(azar, turnos, sucursales, comensales, dias);
  const pools = sucursales.map((s) => armarPools(s.platos));

  // Estados y modos con el reparto exacto, mezclados.
  const n = turnos.length;
  const cuantasFin = Math.round(n * FRACCION_FINALIZADA);
  const cuantasCan = Math.round(n * FRACCION_CANCELADA);
  const estados = mezclar(
    azar,
    Array.from({ length: n }, (_, i) =>
      i < cuantasFin ? 'FINALIZADA' : i < cuantasFin + cuantasCan ? 'CANCELADA' : 'VENCIDA',
    ),
  ) as ('FINALIZADA' | 'CANCELADA' | 'VENCIDA')[];
  const manual = marcarExactos(azar, n, FRACCION_MANUAL);

  // Decisiones de las cuentas, tomadas de antemano para clavar los porcentajes: cuántos pedidos,
  // quién tiene un pago rechazado antes del aprobado y qué pedidos se cancelan (nunca el primero).
  const finalizadas = estados.filter((e) => e === 'FINALIZADA').length;
  const cantidadPedidos = Array.from({ length: finalizadas }, () =>
    azar.ponderado([
      [1, 30],
      [2, 45],
      [3, 25],
    ]),
  );
  const conRechazo = marcarExactos(azar, finalizadas, FRACCION_RECHAZO);
  const cancelables: number[] = [];
  cantidadPedidos.forEach((cant, c) => {
    for (let k = 1; k < cant; k++) cancelables.push(c * 3 + k);
  });
  const totalPedidos = cantidadPedidos.reduce((a, b) => a + b, 0);
  const cancelados = new Set(
    mezclar(azar, cancelables).slice(0, Math.round(totalPedidos * FRACCION_PEDIDO_CANCELADO)),
  );
  const vencidas = n - cuantasFin - cuantasCan;
  const resueltas = marcarExactos(azar, vencidas, FRACCION_ALERTA_RESUELTA);

  const filas: Filas = {
    reserva: [],
    cuenta: [],
    pedido: [],
    linea: [],
    pago: [],
    comprobante: [],
    alerta: [],
  };
  const cuentasCerradas: CuentaCerrada[] = [];
  const referencias = new Set<string>();
  const pedidosPorSucursal = sucursales.map(() => [] as Prisma.PedidoCreateManyInput[]);
  const comprobantesPorSucursal = sucursales.map(
    () => [] as { fila: Prisma.ComprobanteCreateManyInput; ms: number }[],
  );

  const segundos = (): number => azar.entero(0, 59) * 1000;
  const referencia = (): string => {
    for (;;) {
      let r = String(azar.entero(1, 9));
      for (let i = 0; i < 10; i++) r += azar.entero(0, 9);
      if (!referencias.has(r)) {
        referencias.add(r);
        return r;
      }
    }
  };

  const unidades = (azarPlatos: Par[], cantidad: number): Plato[] =>
    azarPlatos.length === 0
      ? []
      : Array.from({ length: cantidad }, () => azar.ponderado(azarPlatos));

  const agrupar = (platos: Plato[]): LineaArmada[] => {
    const porId = new Map<string, LineaArmada>();
    for (const plato of platos) {
      const linea = porId.get(plato.id);
      if (linea) linea.cantidad++;
      else
        porId.set(plato.id, {
          plato,
          cantidad: 1,
          observaciones:
            plato.admiteObservaciones && azar() < 0.07 ? azar.elegir(OBSERVACIONES) : null,
        });
    }
    return [...porId.values()];
  };

  // El primer pedido es la comida (con algo para compartir y bebida); el segundo y el tercero,
  // postres o bebidas.
  const armarLineas = (p: Pools, personas: number, orden: number): LineaArmada[] => {
    const platos: Plato[] = [];
    if (orden === 0) {
      platos.push(...unidades(p.comidas, personas));
      if (p.extras.length && azar() < 0.65) {
        platos.push(...unidades(p.extras, personas >= 4 ? 2 : 1));
      }
      if (p.bebidas.length && azar() < 0.8) {
        platos.push(...unidades(p.bebidas, Math.ceil(personas * 0.8)));
      }
    } else if (p.postres.length && (azar() < 0.65 || p.bebidas.length === 0)) {
      platos.push(...unidades(p.postres, Math.max(1, Math.round(personas * 0.7))));
    } else {
      platos.push(
        ...unidades(
          p.bebidas.length ? p.bebidas : p.todos,
          Math.max(1, Math.round(personas * 0.6)),
        ),
      );
    }
    if (platos.length === 0) platos.push(...unidades(p.todos, 1));
    return agrupar(platos);
  };

  let cuentaN = 0;
  let alertaN = 0;
  turnos.forEach((t, idx) => {
    const sucursal = sucursales[t.suc]!;
    const comensal = comensales[comensalDe[idx]!]!;
    const mesa = sucursal.mesas[t.mesaIdx]!;
    const estado = estados[idx]!;
    const reservaId = uuidDesde(azar);
    const inicioMs = t.inicioMs;
    filas.reserva.push({
      id: reservaId,
      sucursalId: sucursal.id,
      mesaId: mesa.id,
      comensalId: comensal.id,
      inicio: new Date(inicioMs),
      cantidadPersonas: t.personas,
      modoAsignacion: manual[idx] ? 'MANUAL' : 'AUTOMATICA',
      estado,
    });

    if (estado === 'VENCIDA') {
      // Igual que `crearInasistencia`: INFO, con la fecha y la franja del servicio, creada al
      // vencer la tolerancia de llegada.
      filas.alerta.push({
        id: uuidDesde(azar),
        sucursalId: sucursal.id,
        tipo: 'INASISTENCIA',
        severidad: 'INFO',
        fechaServicio: new Date(`${t.fecha}T00:00:00Z`),
        franja: t.franja,
        descripcion: `${comensal.nombre} no llegó a su reserva de las ${horaArgentina(new Date(inicioMs))} h, mesa ${mesa.numero}`,
        creadaEn: new Date(
          inicioMs + (TOLERANCIA_NO_SHOW_MIN + azar.entero(0, 4)) * MIN + segundos(),
        ),
        resuelta: resueltas[alertaN++]!,
      });
      return;
    }
    if (estado === 'CANCELADA') return;

    // --- reserva FINALIZADA: cuenta cerrada con su consumo y su pago ---
    const c = cuentaN++;
    const cuentaId = uuidDesde(azar);
    const cierreMax = DURACION_FRANJA_MIN - 2;
    const minPedido1 = azar.entero(3, 10);
    const minPedido2 = azar.entero(14, 24);
    const minPedido3 = azar.entero(minPedido2 + 4, 30);
    const minPago = azar.entero(42, 55);
    const minCierre = azar.entero(Math.max(45, minPago + 1), cierreMax);
    const abiertaEn = new Date(inicioMs + azar.entero(0, 2) * MIN + segundos());
    const cerradaEn = new Date(inicioMs + minCierre * MIN + segundos());
    const fechaPago = new Date(inicioMs + minPago * MIN + segundos());
    filas.cuenta.push({
      id: cuentaId,
      reservaId,
      abiertaEn,
      cerradaEn,
      estado: 'CERRADA',
    });

    const minutosPedido = [minPedido1, minPedido2, minPedido3];
    const lineasEntregadas: CuentaCerrada['lineasEntregadas'] = [];
    let total = 0;
    for (let k = 0; k < cantidadPedidos[c]!; k++) {
      const cancelado = cancelados.has(c * 3 + k);
      const creadoMs = inicioMs + minutosPedido[k]! * MIN + segundos();
      // Listo entre 10 y 25 minutos después, y antes del pago.
      const listoMs = Math.max(
        creadoMs + 10 * MIN,
        Math.min(creadoMs + azar.entero(10, 25) * MIN + segundos(), inicioMs + minPago * MIN),
      );
      const pedido: Prisma.PedidoCreateManyInput = {
        id: uuidDesde(azar),
        cuentaMesaId: cuentaId,
        sucursalId: sucursal.id,
        numero: 0,
        creadoEn: new Date(creadoMs),
        listoEn: cancelado ? null : new Date(listoMs),
        estado: cancelado ? 'CANCELADO' : 'ENTREGADO',
        motivoCancelacion: cancelado ? azar.elegir(MOTIVOS_CANCELACION) : null,
      };
      filas.pedido.push(pedido);
      pedidosPorSucursal[t.suc]!.push(pedido);
      for (const l of armarLineas(pools[t.suc]!, t.personas, k)) {
        const precio = precioEnFecha(l.plato.precioHoy, sucursal.escalones, t.fecha);
        const lineaId = uuidDesde(azar);
        filas.linea.push({
          id: lineaId,
          pedidoId: pedido.id!,
          itemMenuId: l.plato.id,
          cantidad: l.cantidad,
          precioUnitario: precio,
          observaciones: l.observaciones,
        });
        if (!cancelado) {
          total += l.cantidad * precio;
          lineasEntregadas.push({
            id: lineaId,
            itemMenuId: l.plato.id,
            cantidad: l.cantidad,
            fecha: new Date(creadoMs),
          });
        }
      }
    }

    const metodo = azar() < 0.7 ? 'TARJETA' : 'BILLETERA_VIRTUAL';
    if (conRechazo[c]) {
      // El pago rechazado no lleva referencia ni comprobante, como en la app.
      filas.pago.push({
        id: uuidDesde(azar),
        cuentaMesaId: cuentaId,
        comensalId: comensal.id,
        monto: total,
        metodo,
        estado: 'RECHAZADO',
        referenciaExterna: null,
        fecha: new Date(inicioMs + (minPago - azar.entero(2, 4)) * MIN + segundos()),
      });
    }
    const pagoId = uuidDesde(azar);
    filas.pago.push({
      id: pagoId,
      cuentaMesaId: cuentaId,
      comensalId: comensal.id,
      monto: total,
      metodo,
      estado: 'APROBADO',
      referenciaExterna: referencia(),
      fecha: fechaPago,
    });
    const comprobante: Prisma.ComprobanteCreateManyInput = {
      id: uuidDesde(azar),
      pagoId,
      sucursalId: sucursal.id,
      numero: '',
      fechaEmision: fechaPago,
      total,
    };
    filas.comprobante.push(comprobante);
    comprobantesPorSucursal[t.suc]!.push({ fila: comprobante, ms: fechaPago.getTime() });

    cuentasCerradas.push({
      cuentaMesaId: cuentaId,
      reservaId,
      comensalId: comensal.id,
      restaurante: sucursal.restaurante,
      sucursalId: sucursal.id,
      cerradaEn,
      total,
      pagoAprobadoId: pagoId,
      lineasEntregadas,
    });
  });

  // Numeración correlativa por sucursal, en orden cronológico (max + 1 en la app).
  pedidosPorSucursal.forEach((pedidos) => {
    pedidos
      .sort((a, b) => (a.creadoEn as Date).getTime() - (b.creadoEn as Date).getTime())
      .forEach((p, i) => {
        p.numero = i + 1;
      });
  });
  comprobantesPorSucursal.forEach((comprobantes) => {
    comprobantes
      .sort((a, b) => a.ms - b.ms)
      .forEach(({ fila }, i) => {
        fila.numero = formatearComprobante(i + 1);
      });
  });

  return { filas, cuentasCerradas };
}
