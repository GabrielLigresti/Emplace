import { parsearTrustProxy } from './trust-proxy';

describe('parsearTrustProxy', () => {
  it('convierte una cadena de dígitos en número', () => {
    expect(parsearTrustProxy('1')).toBe(1);
    expect(parsearTrustProxy('2')).toBe(2);
  });

  it('ignora los espacios alrededor', () => {
    expect(parsearTrustProxy(' 1 ')).toBe(1);
  });

  it('deja como texto lo que no es un número', () => {
    expect(parsearTrustProxy('loopback')).toBe('loopback');
    expect(parsearTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
  });
});
