import { useEffect, useRef, useState } from 'react';

export type EstadoSesion = 'abriendo' | 'buscando' | 'apuntando' | 'colocado';

// Sesión de RA propia (WebXR, ver lib/ra-webxr) compartida por el visor del comensal
// y la vista previa del borrador en el panel. `capa` es el overlay que se renderiza
// con <CapaRa>; `webXR` es null hasta saber si el dispositivo la soporta.
export function useSesionRa() {
  const [webXR, setWebXR] = useState<boolean | null>(null);
  const [sesion, setSesion] = useState<EstadoSesion | null>(null);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);
  const capa = useRef<HTMLDivElement>(null);
  const salir = useRef<(() => void) | null>(null);
  const conDiagnostico = new URLSearchParams(window.location.search).has('diag');

  useEffect(() => {
    let vigente = true;
    void import('./ra-webxr')
      .then(({ soportaRaWebXR }) => soportaRaWebXR())
      .catch(() => false)
      .then((ok) => {
        if (vigente) setWebXR(ok);
      });
    return () => {
      vigente = false;
    };
  }, []);

  // Si se sale de la página con la RA abierta, se cierra la sesión.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      salir.current?.();
    };
  }, []);

  // Devuelve false si no se pudo abrir (por ejemplo, se negó el permiso de la cámara).
  async function abrir(modelo: { urlModelo: string; escalaReal: number }): Promise<boolean> {
    if (!capa.current) return false;
    setSesion('abriendo');
    try {
      const { iniciarRa } = await import('./ra-webxr');
      const cerrar = await iniciarRa({
        urlModelo: modelo.urlModelo,
        escalaReal: modelo.escalaReal,
        overlay: capa.current,
        onEstado: setSesion,
        ...(conDiagnostico && { onDiagnostico: setDiagnostico }),
        onFin: () => {
          salir.current = null;
          setSesion(null);
        },
      });
      // Si se desmontó mientras se esperaba, la sesión recién abierta se cierra enseguida.
      if (!montado.current) {
        cerrar();
        return true;
      }
      salir.current = cerrar;
      return true;
    } catch {
      setSesion(null);
      return false;
    }
  }

  return { webXR, sesion, diagnostico, capa, abrir, salir: () => salir.current?.() };
}
