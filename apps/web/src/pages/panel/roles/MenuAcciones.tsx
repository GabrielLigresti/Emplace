import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Ellipsis, type LucideIcon } from 'lucide-react';

export interface AccionMenu {
  texto: string;
  onSeleccionar(): void;
  icono?: LucideIcon;
  // Acción destructiva: el texto va en rojo.
  peligro?: boolean;
}

interface Posicion {
  top?: number;
  bottom?: number;
  right: number;
}

// Menú "⋯" de una fila. El panel va con position fixed para que no lo recorte el
// contenedor con scroll horizontal de la tabla. Sin acciones, no se dibuja.
export function MenuAcciones({
  etiqueta,
  acciones,
}: {
  // Nombre accesible del botón ("Más acciones para Mozo").
  etiqueta: string;
  acciones: AccionMenu[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState<Posicion>({ right: 0 });
  const boton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  function cerrar(devolverFoco: boolean) {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }

  function abrir() {
    const r = boton.current?.getBoundingClientRect();
    if (r) {
      const alto = acciones.length * 44 + 8;
      const derecha = window.innerWidth - r.right;
      // Si no entra hacia abajo, se abre hacia arriba del botón.
      setPosicion(
        r.bottom + alto > window.innerHeight
          ? { bottom: window.innerHeight - r.top + 4, right: derecha }
          : { top: r.bottom + 4, right: derecha },
      );
    }
    setAbierto(true);
  }

  useEffect(() => {
    if (!abierto) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    function alClickAfuera(e: MouseEvent) {
      const destino = e.target as Node;
      if (!menu.current?.contains(destino) && !boton.current?.contains(destino)) setAbierto(false);
    }
    const cerrarSinFoco = () => setAbierto(false);
    document.addEventListener('mousedown', alClickAfuera);
    window.addEventListener('resize', cerrarSinFoco);
    // Solo el scroll de la página (el de un contenedor interno no mueve el botón).
    const alScroll = (e: Event) => {
      if (e.target === document || e.target === document.documentElement) setAbierto(false);
    };
    window.addEventListener('scroll', alScroll, true);
    return () => {
      document.removeEventListener('mousedown', alClickAfuera);
      window.removeEventListener('resize', cerrarSinFoco);
      window.removeEventListener('scroll', alScroll, true);
    };
  }, [abierto]);

  if (acciones.length === 0) return null;

  function onTeclasMenu(e: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const actual = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(actual + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(actual - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cerrar(true);
    } else if (e.key === 'Tab') {
      // Tab cierra el menú y sigue desde el botón ⋯ (al siguiente o al
      // anterior control), en vez de saltar al principio de la página.
      e.preventDefault();
      const controles = [
        ...document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !menu.current?.contains(el));
      const posicion = boton.current ? controles.indexOf(boton.current) : -1;
      setAbierto(false);
      (controles[posicion + (e.shiftKey ? -1 : 1)] ?? boton.current)?.focus();
    }
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        onClick={() => (abierto ? cerrar(false) : abrir())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !abierto) {
            e.preventDefault();
            abrir();
          }
        }}
        className="inline-flex size-11 items-center justify-center rounded-cuadrado bg-panel text-ink hover:bg-line"
      >
        <Ellipsis aria-hidden className="size-[18px]" />
      </button>
      {abierto && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={etiqueta}
          onKeyDown={onTeclasMenu}
          style={{ position: 'fixed', ...posicion }}
          className="z-30 min-w-48 rounded-panel border border-line bg-surface py-1 shadow-flotante"
        >
          {acciones.map(({ texto, onSeleccionar, icono: Icono, peligro }) => (
            <button
              key={texto}
              type="button"
              role="menuitem"
              onClick={() => {
                cerrar(true);
                onSeleccionar();
              }}
              className={`flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-panel focus:bg-panel focus:outline-none sm:min-h-9 ${peligro ? 'text-bad' : 'text-text'}`}
            >
              {Icono && <Icono aria-hidden className="size-4 shrink-0" />}
              {texto}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
