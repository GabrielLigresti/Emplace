import {
  buscarLugarLibre,
  dimensionesMesa,
  entraEnLienzo,
  rectanguloMesa,
  seSuperponen,
} from '@pgim/shared';

const mesa4 = (posX: number, posY: number) => rectanguloMesa({ capacidad: 4, posX, posY });

describe('geometría del salón', () => {
  describe('dimensionesMesa', () => {
    it.each([
      [2, undefined, 10, 8],
      [4, undefined, 15, 10],
      [6, undefined, 20, 10],
      [8, undefined, 26, 12],
      [4, true, 10, 15],
      [1, undefined, 10, 8],
      [3, undefined, 15, 10],
      [5, undefined, 20, 10],
      [20, undefined, 26, 12],
    ])('capacidad %i vertical %s → %i×%i', (capacidad, vertical, ancho, alto) => {
      expect(dimensionesMesa(capacidad, vertical)).toEqual({ ancho, alto });
    });
  });

  describe('rectanguloMesa', () => {
    it('usa posX/posY como centro', () => {
      expect(rectanguloMesa({ capacidad: 4, posX: 50, posY: 30 })).toEqual({
        x: 42.5,
        y: 25,
        ancho: 15,
        alto: 10,
      });
    });
  });

  describe('entraEnLienzo', () => {
    it('acepta la mesa que toca los bordes', () => {
      expect(entraEnLienzo(mesa4(7.5, 5))).toBe(true);
      expect(entraEnLienzo(mesa4(92.5, 30))).toBe(true);
    });
    it('rechaza la mesa que se sale', () => {
      expect(entraEnLienzo(mesa4(7.4, 5))).toBe(false);
      expect(entraEnLienzo(mesa4(50, 55.1))).toBe(false);
      expect(entraEnLienzo(mesa4(92.6, 30))).toBe(false);
    });
  });

  describe('seSuperponen', () => {
    it('el borde compartido no cuenta', () => {
      expect(seSuperponen(mesa4(10, 30), mesa4(25, 30))).toBe(false);
    });
    it('un solape de 0,1 cuenta', () => {
      expect(seSuperponen(mesa4(10, 30), mesa4(24.9, 30))).toBe(true);
    });
    it('misma x con las y separadas 10 no se superponen', () => {
      expect(seSuperponen(mesa4(10, 20), mesa4(10, 30))).toBe(false);
    });
    it('una dentro de otra se superponen', () => {
      expect(seSuperponen(mesa4(50, 30), mesa4(50, 30))).toBe(true);
    });
  });

  describe('buscarLugarLibre', () => {
    it('con el salón vacío devuelve la esquina con margen', () => {
      expect(buscarLugarLibre(4, false, [])).toEqual({ posX: 9.5, posY: 7 });
    });

    it('esquiva la ocupada ensanchada en la separación', () => {
      const ocupada = { x: 0, y: 0, ancho: 40, alto: 60 };
      const lugar = buscarLugarLibre(4, false, [ocupada]);
      expect(lugar).not.toBeNull();
      const r = rectanguloMesa({ capacidad: 4, ...lugar! });
      expect(entraEnLienzo(r)).toBe(true);
      const ensanchada = { x: -2, y: -2, ancho: 44, alto: 64 };
      expect(seSuperponen(r, ensanchada)).toBe(false);
    });

    it('devuelve null si no hay lugar', () => {
      const todo = { x: 0, y: 0, ancho: 100, alto: 60 };
      expect(buscarLugarLibre(4, false, [todo])).toBeNull();
    });
  });
});
