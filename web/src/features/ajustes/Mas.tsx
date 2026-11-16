import { Link } from "react-router";
import { Encabezado } from "../../components/ui";
import { IcoFlecha } from "../../components/Iconos";

const OPCIONES = [
  { a: "/catalogo", titulo: "Catálogo de aparatos", texto: "Aparatos generales y los tuyos" },
  { a: "/ubicaciones", titulo: "Ubicaciones", texto: "Cocina, taller, dormitorio…" },
  { a: "/ajustes", titulo: "Ajustes", texto: "Avisos, tarifa y cuenta" },
];

export function Mas() {
  return (
    <>
      <Encabezado titulo="Más" />
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        {OPCIONES.map((o) => (
          <li key={o.a}>
            <Link to={o.a} className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <span className="flex-1">
                <span className="block font-medium">{o.titulo}</span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">{o.texto}</span>
              </span>
              <IcoFlecha className="size-5 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
