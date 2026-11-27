import { crearAzar } from './azar';
import { armarComensales, armarPlantel, slugMail } from './personas';

const NOMBRES_ARGENTINOS = {
  nombres: [
    'Ana',
    'Luis',
    'María',
    'José',
    'Carla',
    'Diego',
    'Sofía',
    'Pablo',
    'Lucía',
    'Martín',
    'Julia',
    'Hernán',
    'Paula',
    'Ramiro',
    'Vera',
    'Tomás',
    'Nora',
    'Iván',
    'Clara',
    'Bruno',
    'Elena',
    'Fabián',
    'Gisela',
    'Hugo',
    'Irene',
    'Jorge',
    'Karina',
    'Leo',
    'Mara',
    'Nico',
  ],
  apellidos: [
    'Paz',
    'Sosa',
    'Luna',
    'Vega',
    'Rojas',
    'Silva',
    'Gómez',
    'Ríos',
    'Castro',
    'Muñoz',
    'Ortiz',
    'Peña',
    'Cruz',
    'Díaz',
    'Toledo',
    'Acosta',
    'Bravo',
    'Campos',
    'Duarte',
    'Franco',
    'Godoy',
    'Herrera',
    'Ibarra',
    'Juárez',
    'Lara',
    'Medina',
    'Navarro',
    'Ojeda',
    'Pérez',
    'Quiroga',
    'Romero',
    'Suárez',
    'Torres',
    'Urquiza',
    'Vidal',
    'Zárate',
    'Arce',
    'Bazán',
    'Cano',
    'Daza',
  ],
  barrios: [],
};

const RESTAURANTE = {
  nombre: 'Nonna Ermelinda',
  dominio: 'nonnaermelinda.com.ar',
  sucursales: ['Caballito', 'Villa Urquiza'] as [string, string],
};

describe('slugMail', () => {
  it('saca tildes y pasa la ñ a n', () => {
    expect(slugMail('José', 'Muñoz')).toBe('josemunoz');
  });
});

describe('armarPlantel', () => {
  const plantel = armarPlantel(crearAzar(7), RESTAURANTE, NOMBRES_ARGENTINOS);
  const dedicados = (rol: string, s: number) =>
    plantel.filter((e) => e.rol === rol && e.sucursales.includes(s));

  it('tiene un administrador en las dos sucursales', () => {
    const admins = plantel.filter((e) => e.rol === 'Administrador');
    expect(admins).toHaveLength(1);
    expect(admins[0]!.sucursales).toEqual([0, 1]);
  });

  it('tiene gerente y jefe de cocina por sucursal', () => {
    for (const s of [0, 1]) {
      expect(dedicados('Gerente de sucursal', s)).toHaveLength(1);
      expect(dedicados('Jefe de cocina', s)).toHaveLength(1);
    }
  });

  it('respeta la cantidad de mozos y cocineros', () => {
    expect(dedicados('Mozo', 0).length).toBeGreaterThanOrEqual(6);
    expect(dedicados('Mozo', 0).length).toBeLessThanOrEqual(8);
    expect(dedicados('Cocinero', 0).length).toBeGreaterThanOrEqual(3);
    expect(dedicados('Cocinero', 0).length).toBeLessThanOrEqual(4);
    expect(dedicados('Mozo', 1).length).toBeGreaterThanOrEqual(4);
    expect(dedicados('Mozo', 1).length).toBeLessThanOrEqual(5);
    expect(dedicados('Cocinero', 1).length).toBeGreaterThanOrEqual(2);
    expect(dedicados('Cocinero', 1).length).toBeLessThanOrEqual(3);
  });

  it('tiene entre 1 y 2 empleados en las dos sucursales (además del administrador)', () => {
    const comunes = plantel.filter((e) => e.rol !== 'Administrador' && e.sucursales.length === 2);
    expect(comunes.length).toBeGreaterThanOrEqual(1);
    expect(comunes.length).toBeLessThanOrEqual(2);
  });

  it('usa el dominio del restaurante, sin repetir mails ni ids', () => {
    expect(plantel.every((e) => e.email.endsWith('@nonnaermelinda.com.ar'))).toBe(true);
    expect(new Set(plantel.map((e) => e.email)).size).toBe(plantel.length);
    expect(new Set(plantel.map((e) => e.id)).size).toBe(plantel.length);
  });

  it('asigna arquetipo según el rol', () => {
    for (const e of plantel) {
      if (e.rol === 'Mozo') expect(e.arquetipo).toBe('MOZO');
      if (e.rol === 'Cocinero' || e.rol === 'Jefe de cocina') expect(e.arquetipo).toBe('COCINERO');
      if (e.rol === 'Administrador' || e.rol === 'Gerente de sucursal')
        expect(e.arquetipo).toBe('OTRO');
    }
  });

  it('es determinista', () => {
    expect(armarPlantel(crearAzar(7), RESTAURANTE, NOMBRES_ARGENTINOS)).toEqual(plantel);
  });
});

describe('armarComensales', () => {
  const comensales = armarComensales(crearAzar(11), 1000, NOMBRES_ARGENTINOS);

  it('no repite mails ni ids, y ninguno termina en .test', () => {
    expect(new Set(comensales.map((c) => c.email)).size).toBe(1000);
    expect(new Set(comensales.map((c) => c.id)).size).toBe(1000);
    expect(comensales.some((c) => /\.test$|demo|pgim/.test(c.email))).toBe(false);
  });

  it('reparte los perfiles', () => {
    const n = (p: string) => comensales.filter((c) => c.perfil === p).length;
    expect(n('HABITUAL')).toBeGreaterThanOrEqual(180);
    expect(n('HABITUAL')).toBeLessThanOrEqual(220);
    expect(n('OCASIONAL')).toBeGreaterThanOrEqual(420);
    expect(n('OCASIONAL')).toBeLessThanOrEqual(480);
    expect(n('HABITUAL') + n('OCASIONAL') + n('ESPORADICO')).toBe(1000);
  });

  it('reparte los proveedores', () => {
    const gmail = comensales.filter((c) => c.email.endsWith('@gmail.com')).length / 1000;
    expect(gmail).toBeGreaterThanOrEqual(0.55);
    expect(gmail).toBeLessThanOrEqual(0.65);
    expect(comensales.every((c) => /@(gmail|hotmail|outlook|yahoo)\.com$/.test(c.email))).toBe(
      true,
    );
  });

  it('el 60 a 80 % de los mails lleva número o punto', () => {
    const conMarca = comensales.filter((c) => /[.\d]/.test(c.email.split('@')[0]!)).length / 1000;
    expect(conMarca).toBeGreaterThanOrEqual(0.6);
    expect(conMarca).toBeLessThanOrEqual(0.8);
  });

  it('elige preferidos y objetivos según el perfil', () => {
    for (const c of comensales) {
      expect(new Set(c.preferidos).size).toBe(c.preferidos.length);
      if (c.perfil === 'HABITUAL') {
        expect(c.preferidos.length).toBeGreaterThanOrEqual(2);
        expect(c.preferidos.length).toBeLessThanOrEqual(3);
        expect(c.objetivoReservas).toBeGreaterThanOrEqual(30);
        expect(c.objetivoReservas).toBeLessThanOrEqual(48);
      } else if (c.perfil === 'OCASIONAL') {
        expect(c.preferidos.length).toBeGreaterThanOrEqual(2);
        expect(c.preferidos.length).toBeLessThanOrEqual(4);
        expect(c.objetivoReservas).toBeGreaterThanOrEqual(12);
        expect(c.objetivoReservas).toBeLessThanOrEqual(18);
      } else {
        expect(c.preferidos.length).toBeGreaterThanOrEqual(1);
        expect(c.objetivoReservas).toBeGreaterThanOrEqual(3);
        expect(c.objetivoReservas).toBeLessThanOrEqual(8);
      }
    }
  });

  it('deja el teléfono vacío en una parte', () => {
    const sin = comensales.filter((c) => c.telefono === null).length;
    expect(sin).toBeGreaterThan(100);
    expect(sin).toBeLessThan(500);
  });

  it('aplica sufijo cuando dos personas se llaman igual', () => {
    const una = { nombres: ['Ana'], apellidos: ['Paz'], barrios: [] };
    const dos = armarComensales(crearAzar(3), 5, una);
    expect(new Set(dos.map((c) => c.email)).size).toBe(5);
    expect(dos.every((c) => c.nombre === 'Ana Paz')).toBe(true);
  });

  it('es determinista', () => {
    expect(armarComensales(crearAzar(11), 1000, NOMBRES_ARGENTINOS)).toEqual(comensales);
  });
});
