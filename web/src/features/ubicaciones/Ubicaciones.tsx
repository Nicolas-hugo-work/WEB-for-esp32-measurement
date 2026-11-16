import { useState, type FormEvent } from "react";
import { Boton, Encabezado, Entrada } from "../../components/ui";
import { Cargando, EstadoError, EstadoVacio } from "../../components/Estados";
import { Dialogo } from "../../components/Dialogo";
import { useAviso } from "../../components/avisos";
import { mensajeError } from "../../lib/errores";
import { useUsuario } from "../../auth/contexto";
import { useMedidores } from "../medidores/api";
import { useBorrarUbicacion, useCrearUbicacion, useRenombrarUbicacion, useUbicaciones } from "./api";

const errorUbicacion = (e: unknown) =>
  (e as { code?: string })?.code === "23505" ? "Ya tienes una ubicación con ese nombre." : mensajeError(e);

export function Ubicaciones() {
  const usuario = useUsuario();
  const ubicaciones = useUbicaciones();
  const medidores = useMedidores();
  const crear = useCrearUbicacion();
  const renombrar = useRenombrarUbicacion();
  const borrar = useBorrarUbicacion();
  const avisar = useAviso();
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<{ id: number; nombre: string } | null>(null);
  const [aBorrar, setABorrar] = useState<{ id: number; nombre: string } | null>(null);

  const usos = (id: number) => medidores.data?.filter((m) => m.aparato?.id_ubicacion === id).length ?? 0;

  function agregar(e: FormEvent) {
    e.preventDefault();
    if (!nueva.trim()) return;
    crear.mutate(
      { nombre: nueva, id_usuario: usuario.id },
      { onSuccess: () => { setNueva(""); avisar("Ubicación creada"); }, onError: (er) => avisar(errorUbicacion(er), "error") },
    );
  }

  function guardarNombre(e: FormEvent) {
    e.preventDefault();
    if (!editando?.nombre.trim()) return;
    renombrar.mutate(
      { id_ubicacion: editando.id, nombre: editando.nombre },
      { onSuccess: () => setEditando(null), onError: (er) => avisar(errorUbicacion(er), "error") },
    );
  }

  return (
    <>
      <Encabezado titulo="Ubicaciones" />
      <form onSubmit={agregar} className="mb-4 flex gap-2">
        <Entrada aria-label="Nueva ubicación" placeholder="Ej. Cocina" value={nueva} maxLength={40} onChange={(e) => setNueva(e.target.value)} />
        <Boton type="submit" cargando={crear.isPending} disabled={!nueva.trim()}>Agregar</Boton>
      </form>

      {ubicaciones.isPending ? (
        <Cargando filas={3} alto="h-12" />
      ) : ubicaciones.isError ? (
        <EstadoError error={ubicaciones.error} onReintentar={() => ubicaciones.refetch()} />
      ) : ubicaciones.data.length === 0 ? (
        <EstadoVacio titulo="Sin ubicaciones" texto="Agrega lugares como Cocina o Taller para ordenar tus medidores." />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
          {ubicaciones.data.map((u) => (
            <li key={u.id_ubicacion} className="flex items-center gap-2 px-4 py-2">
              {editando?.id === u.id_ubicacion ? (
                <form onSubmit={guardarNombre} className="flex flex-1 gap-2">
                  <Entrada
                    aria-label="Nuevo nombre"
                    autoFocus
                    value={editando.nombre}
                    maxLength={40}
                    onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  />
                  <Boton type="submit" className="px-3" cargando={renombrar.isPending}>OK</Boton>
                  <Boton variante="fantasma" className="px-2" onClick={() => setEditando(null)}>✕</Boton>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.nombre}</p>
                    <p className="text-xs text-slate-500">{usos(u.id_ubicacion)} {usos(u.id_ubicacion) === 1 ? "medidor" : "medidores"}</p>
                  </div>
                  <Boton variante="fantasma" className="min-h-9 px-2" onClick={() => setEditando({ id: u.id_ubicacion, nombre: u.nombre })}>Renombrar</Boton>
                  <Boton variante="fantasma" className="min-h-9 px-2 text-red-600" onClick={() => setABorrar({ id: u.id_ubicacion, nombre: u.nombre })}>Borrar</Boton>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialogo abierto={!!aBorrar} onCerrar={() => setABorrar(null)} titulo="Borrar ubicación">
        {aBorrar && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Borrar «{aBorrar.nombre}»?{usos(aBorrar.id) > 0 && ` Los ${usos(aBorrar.id)} medidores que están ahí quedarán sin ubicación.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Boton variante="fantasma" onClick={() => setABorrar(null)}>Cancelar</Boton>
              <Boton
                variante="peligro"
                cargando={borrar.isPending}
                onClick={() =>
                  borrar.mutate(aBorrar.id, {
                    onSuccess: () => { avisar("Ubicación borrada"); setABorrar(null); },
                    onError: (er) => avisar(mensajeError(er), "error"),
                  })
                }
              >
                Borrar
              </Boton>
            </div>
          </>
        )}
      </Dialogo>
    </>
  );
}
