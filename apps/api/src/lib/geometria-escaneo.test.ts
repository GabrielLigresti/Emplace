import {
  anguloAlrededor,
  apuntaAlCentro,
  radioAureolaM,
  tramoDeAngulo,
  vistaCercana,
  vueltaCompleta,
} from '@pgim/shared';

const centro = { x: 0, y: 0, z: 0 };

describe('geometria-escaneo', () => {
  it('anguloAlrededor mide en el plano XZ, horario visto desde arriba', () => {
    expect(anguloAlrededor(centro, { x: 0, y: 1, z: -1 })).toBeCloseTo(0, 6);
    expect(anguloAlrededor(centro, { x: 1, y: 1, z: 0 })).toBeCloseTo(90, 6);
    expect(anguloAlrededor(centro, { x: 0, y: 1, z: 1 })).toBeCloseTo(180, 6);
    expect(anguloAlrededor(centro, { x: -1, y: 1, z: 0 })).toBeCloseTo(270, 6);
  });

  it('tramoDeAngulo cubre 0..35', () => {
    expect(tramoDeAngulo(359.9)).toBe(35);
    expect(tramoDeAngulo(0)).toBe(0);
    expect(tramoDeAngulo(10)).toBe(1);
  });

  it('vistaCercana respeta la tolerancia y la circularidad', () => {
    expect(vistaCercana(95, 10)).toBe('left');
    expect(vistaCercana(45, 10)).toBeNull();
    expect(vistaCercana(352, 10)).toBe('front');
  });

  it('apuntaAlCentro compara la dirección con la línea al centro', () => {
    const camara = { x: 0, y: 1, z: -1 };
    const k = Math.SQRT1_2;
    expect(apuntaAlCentro(camara, { x: 0, y: -k, z: k }, centro, 15)).toBe(true);
    expect(apuntaAlCentro(camara, { x: 1, y: 0, z: 0 }, centro, 15)).toBe(false);
  });

  it('vueltaCompleta exige los 36 tramos', () => {
    expect(vueltaCompleta(Array(36).fill(true))).toBe(true);
    expect(vueltaCompleta([...Array(35).fill(true), false])).toBe(false);
    expect(vueltaCompleta(Array(35).fill(true))).toBe(false);
  });

  it('radioAureolaM(26) es 0.17', () => {
    expect(radioAureolaM(26)).toBeCloseTo(0.17, 10);
  });
});
