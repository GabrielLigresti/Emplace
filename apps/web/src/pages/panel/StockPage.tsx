import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { CodigoPermiso } from '@pgim/shared';
import { useSesion } from '../../auth/SesionProvider';
import { EncabezadoPagina, Segmentado } from '../../components/ui';
import { ExistenciasTab } from './stock/ExistenciasTab';
import { MovimientosTab } from './stock/MovimientosTab';
import { PreparacionesTab } from './stock/PreparacionesTab';
import { ProduccionTab } from './stock/ProduccionTab';

type Pestaña = 'existencias' | 'produccion' | 'preparaciones' | 'movimientos';

// La pestaña activa vive en la URL para que "Volver" y la recarga la conserven.
const PESTAÑAS: { valor: Pestaña; texto: string; permisos: CodigoPermiso[] }[] = [
  { valor: 'existencias', texto: 'Existencias', permisos: ['insumo.ver', 'stock.registrar'] },
  { valor: 'produccion', texto: 'Producción', permisos: ['insumo.ver', 'stock.registrar'] },
  { valor: 'preparaciones', texto: 'Preparaciones', permisos: ['receta.ver'] },
  { valor: 'movimientos', texto: 'Movimientos', permisos: ['insumo.ver', 'stock.registrar'] },
];

export function StockPage() {
  const { sesion, tienePermiso } = useSesion();
  const [params, setParams] = useSearchParams();
  // Las pestañas ponen su acción principal a la derecha de las secciones.
  const [acciones, setAcciones] = useState<HTMLDivElement | null>(null);
  const pedida = params.get('pestaña');
  // Cada pestaña pide el permiso de lo que consulta; con más de uno alcanza con cualquiera.
  const visibles = PESTAÑAS.filter((p) => p.permisos.some((c) => tienePermiso(c)));
  const activa = (visibles.find((p) => p.valor === pedida) ?? visibles[0])?.valor;

  return (
    <section>
      <EncabezadoPagina
        titulo="Stock"
        descripcion={sesion?.sucursalActiva?.nombre ?? 'Sucursal de trabajo'}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="max-sm:w-full max-sm:[&>div]:flex max-sm:[&>div]:w-full max-sm:[&_button]:flex-1">
          <Segmentado<Pestaña>
            etiqueta="Secciones de stock"
            valor={activa ?? 'existencias'}
            onCambiar={(v) => setParams({ pestaña: v })}
            opciones={visibles}
          />
        </div>
        <div ref={setAcciones} className="max-sm:w-full empty:hidden" />
      </div>
      {activa === 'existencias' && <ExistenciasTab accionesEncabezado={acciones} />}
      {activa === 'produccion' && <ProduccionTab accionesEncabezado={acciones} />}
      {activa === 'preparaciones' && <PreparacionesTab accionesEncabezado={acciones} />}
      {activa === 'movimientos' && <MovimientosTab />}
    </section>
  );
}
