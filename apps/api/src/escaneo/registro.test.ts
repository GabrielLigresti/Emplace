import { AppError } from '../lib/errors';
import type { Proveedor3D } from './proveedor-3d';
import { crearRegistro, proveedoresDisponibles } from './registro';

function falso(nombre: string): Proveedor3D {
  return {
    nombre,
    requisitos: jest.fn(),
    iniciar: jest.fn(),
    consultar: jest.fn(),
  } as unknown as Proveedor3D;
}

describe('registro de proveedores 3D', () => {
  const a = falso('a');
  const b = falso('b');

  it('activo devuelve el proveedor elegido', () => {
    expect(crearRegistro([a, b], 'b').activo()).toBe(b);
  });

  it('buscar devuelve un proveedor por nombre', () => {
    expect(crearRegistro([a, b], 'a').buscar('b')).toBe(b);
  });

  it('buscar lanza 500 para un nombre desconocido', () => {
    const registro = crearRegistro([a], 'a');
    try {
      registro.buscar('zzz');
      throw new Error('no lanzó');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(500);
    }
  });

  it('falla al crearse si el activo no está registrado', () => {
    expect(() => crearRegistro([a], 'zzz')).toThrow(Error);
  });

  describe('proveedoresDisponibles', () => {
    const base = { SIMULADO_DEMORA_MS: 0, SIMULADO_FALLA: false };

    it('sin TRIPO_API_KEY no incluye tripo', () => {
      expect(proveedoresDisponibles(base).map((p) => p.nombre)).toEqual(['simulado']);
    });

    it('con TRIPO_API_KEY incluye tripo', () => {
      const nombres = proveedoresDisponibles({ ...base, TRIPO_API_KEY: 'k' }).map((p) => p.nombre);
      expect(nombres).toEqual(['simulado', 'tripo']);
    });

    it('pedir tripo como activo sin clave lanza un error', () => {
      expect(() => crearRegistro(proveedoresDisponibles(base), 'tripo')).toThrow(Error);
    });
  });
});
