import { crearAzar, uuidDesde } from './azar';
import { generarOperativa } from './operativa';
import { armarComensales, type ComensalGenerado } from './personas';
import { precioEnFecha, type Escalon } from './precios';
import { diasDelHistorial, instanteBA, sumarDias } from './reloj';
import type { EstructuraSucursal } from './tipos';
import { formatearComprobante } from '../domain/pago/pago';

const HOY = '2026-11-27';
const DIAS = diasDelHistorial(HOY).slice(-28);
const INICIO_HOY = instanteBA(HOY, '00:00').getTime();
const SEMILLA = 2026;

const NOMBRES = {
  nombres: Array.from({ length: 40 }, (_, i) => `Nombre${String.fromCharCode(97 + (i % 26))}${i}`),
  apellidos: Array.from(
    { length: 60 },
    (_, i) => `Apellido${String.fromCharCode(97 + (i % 26))}${i}`,
  ),
};

const HORARIOS: EstructuraSucursal['horarios'] = [
  { franja: 'ALMUERZO', horaInicio: '12:00', horaFin: '16:00' },
  { franja: 'CENA', horaInicio: '20:00', horaFin: '00:00' },
];

const CATEGORIAS = ['Entradas', 'Principales', 'Postres', 'Bebidas'] as const;

function sucursalDePrueba(
  azar: ReturnType<typeof crearAzar>,
  restaurante: string,
  capacidades: number[],
  grande: boolean,
  escalones: Escalon[],
): EstructuraSucursal {
  return {
    id: uuidDesde(azar),
    restaurante,
    grande,
    mesas: capacidades.map((capacidad, i) => ({
      id: uuidDesde(azar),
      numero: i + 1,
      capacidad,
    })),
    horarios: HORARIOS,
    platos: CATEGORIAS.flatMap((categoria, c) =>
      Array.from({ length: 4 }, (_, i) => ({
        id: uuidDesde(azar),
        categoria,
        precioHoy: 8000 + c * 3000 + i * 2500,
        admiteObservaciones: categoria === 'Principales' || categoria === 'Entradas',
        popularidad: 1 + i * 2,
      })),
    ),
    escalones,
    empleadosCocina: [uuidDesde(azar)],
  };
}

// Los comensales armados reparten sus preferencias entre los seis restaurantes. Con solo dos
// sucursales en el escenario se las llevamos a esos dos restaurantes, para que el pool de
// comensales sea el que corresponde al volumen de reservas de la prueba.
function comensalesDePrueba(azar: ReturnType<typeof crearAzar>, restaurantes: string[]) {
  return armarComensales(azar, 150, NOMBRES).map((c): ComensalGenerado => ({
    ...c,
    preferidos:
      c.perfil === 'HABITUAL' || azar() < 0.4
        ? [...restaurantes]
        : [restaurantes[azar.entero(0, restaurantes.length - 1)]!],
  }));
}

function escenario(semilla: number) {
  const azar = crearAzar(semilla);
  const escalones: Escalon[] = [
    { fecha: sumarDias(HOY, -120), factor: 1.06 },
    { fecha: sumarDias(HOY, -62), factor: 1.05 },
    { fecha: sumarDias(HOY, -20), factor: 1.07 },
  ];
  const grande = sucursalDePrueba(
    azar,
    'Fuego de Quebracho',
    [2, 2, 4, 4, 4, 6, 6, 8, 2, 4],
    true,
    escalones,
  );
  const chica = sucursalDePrueba(azar, 'Hoshi Sushi Bar', [2, 4, 4, 6, 2, 8], false, escalones);
  const comensales = comensalesDePrueba(azar, ['Fuego de Quebracho', 'Hoshi Sushi Bar']);
  const sucursales = [grande, chica];
  const res = generarOperativa(azar, sucursales, comensales, DIAS);
  return { sucursales, comensales, escalones, ...res };
}

const E = escenario(SEMILLA);
const F = E.filas;

const ms = (d: unknown): number => (d as Date).getTime();
const fechaBA = (d: unknown): string => new Date(ms(d) - 3 * 3_600_000).toISOString().slice(0, 10);
const media = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const MIN = 60_000;

function porDia(sucursalId: string): number[] {
  const cuenta = new Map<string, number>(DIAS.map((d) => [d, 0]));
  for (const r of F.reserva.filter((x) => x.sucursalId === sucursalId)) {
    const f = fechaBA(r.inicio);
    cuenta.set(f, (cuenta.get(f) ?? 0) + 1);
  }
  return DIAS.map((d) => cuenta.get(d)!);
}

describe('generarOperativa', () => {
  const [grande, chica] = E.sucursales as [EstructuraSucursal, EstructuraSucursal];

  it('no superpone reservas en la misma mesa e inicio, sea cual sea el estado', () => {
    const claves = F.reserva.map((r) => `${r.mesaId}|${ms(r.inicio)}`);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('nunca supera la capacidad de la mesa', () => {
    const capacidad = new Map(
      E.sucursales.flatMap((s) => s.mesas.map((m) => [m.id, m.capacidad] as const)),
    );
    for (const r of F.reserva) {
      expect(r.cantidadPersonas).toBeLessThanOrEqual(capacidad.get(r.mesaId)!);
      expect(r.cantidadPersonas).toBeGreaterThanOrEqual(1);
    }
  });

  it('las reservas son de horas en punto, dentro de las franjas', () => {
    for (const r of F.reserva) {
      const t = ms(r.inicio);
      expect(t % 3_600_000).toBe(0);
      const hora = (((t / 3_600_000 - 3) % 24) + 24) % 24;
      expect([12, 13, 14, 15, 20, 21, 22, 23]).toContain(hora);
    }
  });

  it('el total diario está entre 3 y 18, con la media de cada tamaño de sucursal', () => {
    const g = porDia(grande.id);
    const c = porDia(chica.id);
    for (const n of [...g, ...c]) {
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(18);
    }
    expect(media(g)).toBeGreaterThanOrEqual(8);
    expect(media(g)).toBeLessThanOrEqual(11);
    expect(media(c)).toBeGreaterThanOrEqual(5);
    expect(media(c)).toBeLessThanOrEqual(7);
  });

  it('el viernes y el sábado tienen más reservas que el lunes y el martes', () => {
    const todas = [...porDia(grande.id), ...porDia(chica.id)];
    const dias = [...DIAS, ...DIAS];
    const promedio = (dows: number[]): number =>
      media(todas.filter((_, i) => dows.includes(new Date(`${dias[i]}T12:00:00Z`).getUTCDay())));
    expect(promedio([5, 6])).toBeGreaterThan(promedio([1, 2]) * 1.3);
  });

  it('los estados están cerca de 85, 9 y 6 % (±3 pp)', () => {
    const n = F.reserva.length;
    const pct = (e: string): number => (F.reserva.filter((r) => r.estado === e).length / n) * 100;
    expect(Math.abs(pct('FINALIZADA') - 85)).toBeLessThanOrEqual(3);
    expect(Math.abs(pct('CANCELADA') - 9)).toBeLessThanOrEqual(3);
    expect(Math.abs(pct('VENCIDA') - 6)).toBeLessThanOrEqual(3);
  });

  it('cada VENCIDA tiene su alerta INASISTENCIA, igual que la app, y casi todas resueltas', () => {
    const vencidas = F.reserva.filter((r) => r.estado === 'VENCIDA');
    expect(F.alerta).toHaveLength(vencidas.length);
    const mesaNumero = new Map(
      E.sucursales.flatMap((s) => s.mesas.map((m) => [m.id, m.numero] as const)),
    );
    const nombre = new Map(E.comensales.map((c) => [c.id, c.nombre]));
    const franjaDe = (inicio: Date): 'ALMUERZO' | 'CENA' =>
      inicio.getTime() < instanteBA(fechaBA(inicio), '18:00').getTime() ? 'ALMUERZO' : 'CENA';
    const usadas = new Set<unknown>();
    for (const r of vencidas) {
      const hora = new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(r.inicio as Date);
      const descripcion = `${nombre.get(r.comensalId)} no llegó a su reserva de las ${hora} h, mesa ${mesaNumero.get(r.mesaId)}`;
      const a = F.alerta.find(
        (x) => x.sucursalId === r.sucursalId && x.descripcion === descripcion,
      );
      expect(a).toBeDefined();
      usadas.add(a);
      expect(a!.tipo).toBe('INASISTENCIA');
      expect(a!.severidad).toBe('INFO');
      expect(a!.franja).toBe(franjaDe(r.inicio as Date));
      expect(ms(a!.fechaServicio)).toBe(Date.parse(`${fechaBA(r.inicio)}T00:00:00Z`));
      // Creada al vencer la tolerancia de 15 minutos, antes de la medianoche.
      expect(ms(a!.creadaEn)).toBeGreaterThanOrEqual(ms(r.inicio) + 15 * MIN);
      expect(ms(a!.creadaEn)).toBeLessThan(ms(r.inicio) + 30 * MIN);
      expect(ms(a!.creadaEn)).toBeLessThan(INICIO_HOY);
    }
    expect(usadas.size).toBe(vencidas.length);
    const resueltas = F.alerta.filter((a) => a.resuelta).length / F.alerta.length;
    expect(resueltas).toBeGreaterThanOrEqual(0.8);
    expect(resueltas).toBeLessThan(1.0001);
  });

  it('toda FINALIZADA tiene cuenta CERRADA y un pago APROBADO; las otras no tienen cuenta', () => {
    const cuentaPorReserva = new Map(F.cuenta.map((c) => [c.reservaId, c]));
    expect(cuentaPorReserva.size).toBe(F.cuenta.length);
    for (const r of F.reserva) {
      const cuenta = cuentaPorReserva.get(r.id!);
      if (r.estado === 'FINALIZADA') {
        expect(cuenta).toBeDefined();
        expect(cuenta!.estado).toBe('CERRADA');
        const aprobados = F.pago.filter(
          (p) => p.cuentaMesaId === cuenta!.id && p.estado === 'APROBADO',
        );
        expect(aprobados).toHaveLength(1);
        expect(aprobados[0]!.comensalId).toBe(r.comensalId);
        expect(aprobados[0]!.referenciaExterna).toMatch(/^\d{11}$/);
        expect(F.comprobante.filter((c) => c.pagoId === aprobados[0]!.id)).toHaveLength(1);
      } else {
        expect(cuenta).toBeUndefined();
      }
    }
    expect(F.cuenta).toHaveLength(F.reserva.filter((r) => r.estado === 'FINALIZADA').length);
    expect(E.cuentasCerradas).toHaveLength(F.cuenta.length);
  });

  it('los pedidos y los comprobantes son correlativos por sucursal y crecen en el tiempo', () => {
    for (const s of E.sucursales) {
      const pedidos = F.pedido
        .filter((p) => p.sucursalId === s.id)
        .sort((a, b) => a.numero - b.numero);
      pedidos.forEach((p, i) => expect(p.numero).toBe(i + 1));
      for (let i = 1; i < pedidos.length; i++) {
        expect(ms(pedidos[i]!.creadoEn)).toBeGreaterThanOrEqual(ms(pedidos[i - 1]!.creadoEn));
      }
      const pagoFecha = new Map(F.pago.map((p) => [p.id, ms(p.fecha)]));
      const comprobantes = F.comprobante
        .filter((c) => c.sucursalId === s.id)
        .sort((a, b) => a.numero.localeCompare(b.numero));
      comprobantes.forEach((c, i) => expect(c.numero).toBe(formatearComprobante(i + 1)));
      for (let i = 1; i < comprobantes.length; i++) {
        expect(ms(comprobantes[i]!.fechaEmision)).toBeGreaterThanOrEqual(
          ms(comprobantes[i - 1]!.fechaEmision),
        );
      }
      for (const c of comprobantes) expect(ms(c.fechaEmision)).toBe(pagoFecha.get(c.pagoId));
    }
  });

  it('precioUnitario es el precio de la carta del día del pedido', () => {
    const platos = new Map(E.sucursales.flatMap((s) => s.platos.map((p) => [p.id, p] as const)));
    const pedidos = new Map(F.pedido.map((p) => [p.id!, p]));
    for (const l of F.linea) {
      const plato = platos.get(l.itemMenuId)!;
      const fecha = fechaBA(pedidos.get(l.pedidoId)!.creadoEn);
      expect(Number(l.precioUnitario)).toBe(precioEnFecha(plato.precioHoy, E.escalones, fecha));
    }
  });

  it('nada cae en hoy a las 00:00 ni después (la cena de las 23 h del último día cierra antes)', () => {
    for (const r of F.reserva) expect(ms(r.inicio)).toBeLessThan(INICIO_HOY);
    for (const c of F.cuenta) {
      expect(ms(c.abiertaEn)).toBeLessThan(INICIO_HOY);
      expect(ms(c.cerradaEn)).toBeLessThan(INICIO_HOY);
    }
    for (const p of F.pedido) {
      expect(ms(p.creadoEn)).toBeLessThan(INICIO_HOY);
      if (p.listoEn) expect(ms(p.listoEn)).toBeLessThan(INICIO_HOY);
    }
    for (const p of F.pago) expect(ms(p.fecha)).toBeLessThan(INICIO_HOY);
    for (const c of F.comprobante) expect(ms(c.fechaEmision)).toBeLessThan(INICIO_HOY);
    for (const a of F.alerta) expect(ms(a.creadaEn)).toBeLessThan(INICIO_HOY);
    // Hay reservas de las 23 h (que en UTC caen al día siguiente): el borde está ejercitado.
    const de23 = F.reserva.filter((r) => ms(r.inicio) % 86_400_000 === 2 * 3_600_000);
    expect(de23.length).toBeGreaterThan(0);
  });

  it('los tiempos de cada cuenta caen dentro de su franja de 60 minutos y en orden', () => {
    const reservas = new Map(F.reserva.map((r) => [r.id!, r]));
    const cuentas = new Map(F.cuenta.map((c) => [c.id!, c]));
    for (const c of F.cuenta) {
      const inicio = ms(reservas.get(c.reservaId)!.inicio);
      expect(ms(c.abiertaEn)).toBeGreaterThanOrEqual(inicio);
      expect(ms(c.cerradaEn)).toBeLessThan(inicio + 60 * MIN);
      expect(ms(c.cerradaEn)).toBeGreaterThanOrEqual(inicio + 45 * MIN);
    }
    for (const p of F.pedido) {
      const cuenta = cuentas.get(p.cuentaMesaId)!;
      const inicio = ms(reservas.get(cuenta.reservaId)!.inicio);
      expect(ms(p.creadoEn)).toBeGreaterThanOrEqual(inicio + 3 * MIN);
      expect(ms(p.creadoEn)).toBeLessThan(inicio + 40 * MIN);
      if (p.estado === 'ENTREGADO') {
        expect(ms(p.listoEn)).toBeGreaterThanOrEqual(ms(p.creadoEn) + 10 * MIN);
        expect(ms(p.listoEn)).toBeLessThanOrEqual(ms(cuenta.cerradaEn));
      } else {
        expect(p.listoEn ?? null).toBeNull();
      }
    }
    for (const p of F.pago) {
      const cuenta = cuentas.get(p.cuentaMesaId)!;
      const inicio = ms(reservas.get(cuenta.reservaId)!.inicio);
      expect(ms(p.fecha)).toBeGreaterThanOrEqual(inicio + 38 * MIN);
      expect(ms(p.fecha)).toBeLessThanOrEqual(ms(cuenta.cerradaEn));
      if (p.estado === 'APROBADO') {
        expect(ms(p.fecha)).toBeGreaterThanOrEqual(inicio + 42 * MIN);
        expect(ms(p.fecha)).toBeLessThan(inicio + 56 * MIN);
      }
    }
    // El primer pedido de cada cuenta entra entre 3 y 10 minutos.
    const primeros = new Map<string, number>();
    for (const p of F.pedido) {
      primeros.set(
        p.cuentaMesaId,
        Math.min(primeros.get(p.cuentaMesaId) ?? Infinity, ms(p.creadoEn)),
      );
    }
    for (const [cuentaId, t] of primeros) {
      const inicio = ms(reservas.get(cuentas.get(cuentaId)!.reservaId)!.inicio);
      expect(t).toBeLessThan(inicio + 11 * MIN);
    }
  });

  it('un comensal no tiene dos reservas con el mismo inicio', () => {
    const claves = F.reserva.map((r) => `${r.comensalId}|${ms(r.inicio)}`);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('las visitas por comensal acompañan el rango de su perfil, escalado por los días', () => {
    const escala = DIAS.length / 182;
    const rangos = {
      HABITUAL: [30, 48],
      OCASIONAL: [12, 18],
      ESPORADICO: [3, 8],
    } as const;
    const visitas = new Map<string, number>();
    for (const r of F.reserva) visitas.set(r.comensalId, (visitas.get(r.comensalId) ?? 0) + 1);
    for (const perfil of ['HABITUAL', 'OCASIONAL', 'ESPORADICO'] as const) {
      const [min, max] = rangos[perfil];
      const propios = E.comensales.filter((c) => c.perfil === perfil);
      const cuentas = propios.map((c) => visitas.get(c.id) ?? 0);
      // El promedio queda dentro del rango escalado, con un 25 % de tolerancia.
      expect(media(cuentas)).toBeGreaterThanOrEqual(min * escala * 0.75);
      expect(media(cuentas)).toBeLessThanOrEqual(max * escala * 1.25);
      // Nadie se pasa del doble del tope escalado (más una visita).
      for (const n of cuentas) expect(n).toBeLessThanOrEqual(Math.ceil(max * escala * 2) + 1);
    }
    // Los habituales vienen más que los esporádicos.
    const prom = (p: string): number =>
      media(E.comensales.filter((c) => c.perfil === p).map((c) => visitas.get(c.id) ?? 0));
    expect(prom('HABITUAL')).toBeGreaterThan(prom('OCASIONAL'));
    expect(prom('OCASIONAL')).toBeGreaterThan(prom('ESPORADICO'));
  });

  it('modoAsignacion es MANUAL en alrededor del 10 % (±3 pp)', () => {
    const manual = F.reserva.filter((r) => r.modoAsignacion === 'MANUAL').length;
    expect(Math.abs((manual / F.reserva.length) * 100 - 10)).toBeLessThanOrEqual(3);
  });

  it('alrededor del 4 % de las cuentas tiene un RECHAZADO antes del APROBADO', () => {
    const rechazados = F.pago.filter((p) => p.estado === 'RECHAZADO');
    const pct = (rechazados.length / F.cuenta.length) * 100;
    expect(pct).toBeGreaterThanOrEqual(2);
    expect(pct).toBeLessThanOrEqual(6.5);
    for (const rz of rechazados) {
      expect(rz.metodo).toBeTruthy();
      expect(F.comprobante.some((c) => c.pagoId === rz.id)).toBe(false);
      const aprobado = F.pago.find(
        (p) => p.cuentaMesaId === rz.cuentaMesaId && p.estado === 'APROBADO',
      )!;
      expect(ms(rz.fecha)).toBeLessThan(ms(aprobado.fecha));
      expect(rz.comensalId).toBe(aprobado.comensalId);
    }
  });

  it('los pagos aprobados cubren el total de la cuenta y las referencias son únicas', () => {
    const lineasPorPedido = new Map<string, typeof F.linea>();
    for (const l of F.linea) {
      lineasPorPedido.set(l.pedidoId, [...(lineasPorPedido.get(l.pedidoId) ?? []), l]);
    }
    const totalDe = new Map<string, number>();
    for (const p of F.pedido) {
      if (p.estado === 'CANCELADO') continue;
      const t = (lineasPorPedido.get(p.id!) ?? []).reduce(
        (a, l) => a + l.cantidad * Number(l.precioUnitario),
        0,
      );
      totalDe.set(p.cuentaMesaId, (totalDe.get(p.cuentaMesaId) ?? 0) + t);
    }
    for (const p of F.pago) {
      expect(Number(p.monto)).toBe(totalDe.get(p.cuentaMesaId));
      expect(Number(p.monto)).toBeGreaterThan(0);
    }
    for (const c of F.comprobante) {
      expect(Number(c.total)).toBe(Number(F.pago.find((p) => p.id === c.pagoId)!.monto));
    }
    const refs = F.pago.map((p) => p.referenciaExterna).filter((r) => r != null);
    expect(new Set(refs).size).toBe(refs.length);
    const cerradas = new Map(E.cuentasCerradas.map((c) => [c.cuentaMesaId, c]));
    for (const [cuentaId, total] of totalDe) {
      const c = cerradas.get(cuentaId)!;
      expect(c.total).toBe(total);
      expect(F.pago.find((p) => p.id === c.pagoAprobadoId)!.estado).toBe('APROBADO');
    }
  });

  it('alrededor del 2 % de los pedidos está CANCELADO, con motivo y sin consumir stock', () => {
    const cancelados = F.pedido.filter((p) => p.estado === 'CANCELADO');
    const pct = (cancelados.length / F.pedido.length) * 100;
    expect(pct).toBeGreaterThanOrEqual(1);
    expect(pct).toBeLessThanOrEqual(3.5);
    const entregadas = new Set(
      E.cuentasCerradas.flatMap((c) => c.lineasEntregadas.map((l) => l.id)),
    );
    for (const p of cancelados) {
      expect(p.motivoCancelacion).toBeTruthy();
      for (const l of F.linea.filter((x) => x.pedidoId === p.id)) {
        expect(entregadas.has(l.id!)).toBe(false);
      }
    }
    for (const p of F.pedido.filter((x) => x.estado !== 'CANCELADO')) {
      expect(p.motivoCancelacion ?? null).toBeNull();
    }
    // Cada cuenta tiene entre 1 y 3 pedidos y el primero nunca se cancela.
    const porCuenta = new Map<string, number>();
    for (const p of F.pedido)
      porCuenta.set(p.cuentaMesaId, (porCuenta.get(p.cuentaMesaId) ?? 0) + 1);
    for (const n of porCuenta.values()) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
    expect(porCuenta.size).toBe(F.cuenta.length);
    // lineasEntregadas coincide con los pedidos entregados.
    const pedidosEntregados = new Set(
      F.pedido.filter((p) => p.estado !== 'CANCELADO').map((p) => p.id),
    );
    const lineasEntregables = F.linea.filter((l) => pedidosEntregados.has(l.pedidoId));
    expect(entregadas.size).toBe(lineasEntregables.length);
  });

  it('las observaciones solo van en los platos que las admiten', () => {
    const platos = new Map(E.sucursales.flatMap((s) => s.platos.map((p) => [p.id, p] as const)));
    let con = 0;
    for (const l of F.linea) {
      if (l.observaciones) {
        con++;
        expect(platos.get(l.itemMenuId)!.admiteObservaciones).toBe(true);
      }
    }
    expect(con).toBeGreaterThan(0);
  });

  it('las líneas son de platos de la sucursal y los platos populares se piden más', () => {
    const pedidoSucursal = new Map(F.pedido.map((p) => [p.id!, p.sucursalId]));
    const platosDe = new Map(E.sucursales.map((s) => [s.id, new Set(s.platos.map((p) => p.id))]));
    const unidades = new Map<string, number>();
    for (const l of F.linea) {
      expect(platosDe.get(pedidoSucursal.get(l.pedidoId)!)!.has(l.itemMenuId)).toBe(true);
      unidades.set(l.itemMenuId, (unidades.get(l.itemMenuId) ?? 0) + l.cantidad);
    }
    // Dentro de una categoría, el de más peso vende más que el de menos peso.
    const principales = grande.platos.filter((p) => p.categoria === 'Principales');
    const masPopular = principales.reduce((a, b) => (b.popularidad > a.popularidad ? b : a));
    const menosPopular = principales.reduce((a, b) => (b.popularidad < a.popularidad ? b : a));
    expect(unidades.get(masPopular.id) ?? 0).toBeGreaterThan(unidades.get(menosPopular.id) ?? 0);
  });

  it('con la misma semilla, la salida es idéntica', () => {
    const otra = escenario(SEMILLA);
    expect(otra.filas).toEqual(E.filas);
    expect(otra.cuentasCerradas).toEqual(E.cuentasCerradas);
  });

  it('con otra semilla, la salida cambia', () => {
    expect(escenario(SEMILLA + 1).filas.reserva).not.toEqual(F.reserva);
  });
});
