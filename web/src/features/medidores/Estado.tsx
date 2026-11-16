import { Insignia } from "../../components/ui";
import type { EstadoConexion } from "../../lib/electrica";
import { haceCuanto } from "../../lib/fechas";

export function EstadoMedidor({ estado, ultimaConexion, ahora }: {
  estado: EstadoConexion; ultimaConexion: string | null; ahora: number;
}) {
  switch (estado) {
    case "en_linea":
      return (
        <Insignia tono="verde">
          <span className="size-2 rounded-full bg-emerald-500" /> En línea
        </Insignia>
      );
    case "sin_conexion":
      return (
        <Insignia tono="gris">
          <span className="size-2 rounded-full border border-current" /> Sin conexión · {haceCuanto(ultimaConexion!, ahora)}
        </Insignia>
      );
    case "nunca":
      return <Insignia tono="azul">Esperando primera conexión</Insignia>;
    case "desvinculado":
      return <Insignia tono="gris">Desvinculado</Insignia>;
  }
}
