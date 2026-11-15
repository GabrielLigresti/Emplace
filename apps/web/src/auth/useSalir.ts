import { useNavigate } from 'react-router';
import { useSesion } from './SesionProvider';

// Cerrar sesión lleva a la landing: es la única forma de volver a ella con sesión previa.
export function useSalir() {
  const { logout } = useSesion();
  const navigate = useNavigate();
  return async () => {
    await logout();
    navigate('/', { replace: true });
  };
}
