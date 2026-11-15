import { LayoutComensal } from '../../components/LayoutComensal';
import { BuscadorSucursales } from '../../components/BuscadorSucursales';

// Inicio del comensal con sesión: buscar un restaurante, mirar su carta y reservar.
export function InicioPage() {
  return (
    <LayoutComensal>
      <div className="landing-clasica tipografia-app text-tinta-clasica">
        <BuscadorSucursales compacto />
      </div>
    </LayoutComensal>
  );
}
