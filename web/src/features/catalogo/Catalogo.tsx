import { useState } from "react";
import { Boton, Encabezado, Insignia } from "../../components/ui";
import { Cargando, EstadoError, EstadoVacio } from "../../components/Estados";
import { Dialogo } from "../../components/Dialogo";
import { useAviso } from "../../components/avisos";
import { fmtA } from "../../lib/electrica";
import { mensajeError } from "../../lib/errores";
import { describirAparato, useBorrarAparato, useCatalogo, useEsAdmin, useUsoCatalogo, type Aparato } from "./api";
import { FormAparato } from "./FormAparato";

type Edicion = { modo: "nuevo"; global: boolean } | { modo: "editar"; a: Aparato } | { modo: "duplicar"; a: Aparato };

export function Catalogo() {
  const catalogo = useCatalogo();
  const esAdmin = useEsAdmin().data ?? false;
  const uso = useUsoCatalogo();
  const borrar = useBorrarAparato();
  const avisar = useAviso();
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [aBorrar, setABorrar] = useState<Aparato | null>(null);

  const generales = catalogo.data?.filter((a) => a.es_global) ?? [];
  const mios = catalogo.data?.filter((a) => !a.es_global) ?? [];

  const fila = (a: Aparato) => {
    const editable = !a.es_global || esAdmin;
    const n = uso.data?.get(a.id_catalogo) ?? 0;
    return (
      <li key={a.id_catalogo} className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{describirAparato(a)}</p>
          <p className="text-sm text-slate-500 tabular-nums dark:text-slate-400">
            {a.potencia_nominal_w} W · {a.voltaje_nominal_v} V · {fmtA(Number(a.corriente_nominal_a))}
            {n > 0 && ` · en uso (${n})`}
          </p>
        </div>
        {editable ? (
          <>
            <Boton variante="fantasma" className="min-h-9 px-2" onClick={() => setEdicion({ modo: "editar", a })}>Editar</Boton>
            <Boton variante="fantasma" className="min-h-9 px-2 text-red-600" onClick={() => setABorrar(a)}>Borrar</Boton>
          </>
        ) : (
          <Boton variante="fantasma" className="min-h-9 px-2" onClick={() => setEdicion({ modo: "duplicar", a })}>Duplicar</Boton>
        )}
      </li>
    );
  };

  const lista = (items: Aparato[]) => (
    <ul className="divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
      {items.map(fila)}
    </ul>
  );

  const tituloDialogo =
    edicion?.modo === "editar" ? "Editar aparato" : edicion?.modo === "duplicar" ? "Duplicar como propio" : edicion?.global ? "Nuevo aparato general" : "Nuevo aparato";

  return (
    <>
      <Encabezado
        titulo="Catálogo de aparatos"
        acciones={<Boton className="min-h-9 px-3" onClick={() => setEdicion({ modo: "nuevo", global: false })}>+ Nuevo</Boton>}
      />
      {catalogo.isPending ? (
        <Cargando filas={4} alto="h-14" />
      ) : catalogo.isError ? (
        <EstadoError error={catalogo.error} onReintentar={() => catalogo.refetch()} />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-semibold">Mis aparatos</h2>
            {mios.length ? lista(mios) : (
              <EstadoVacio titulo="Todavía no creaste aparatos" texto="Crea uno si el tuyo no está en la lista general, o duplica uno general para ajustarlo." />
            )}
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Generales</h2>
              {esAdmin && (
                <div className="flex items-center gap-2">
                  <Insignia tono="azul">Administrador</Insignia>
                  <Boton variante="secundario" className="min-h-9 px-3" onClick={() => setEdicion({ modo: "nuevo", global: true })}>+ General</Boton>
                </div>
              )}
            </div>
            {lista(generales)}
            {!esAdmin && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Los aparatos generales los mantiene el administrador.</p>}
          </section>
        </div>
      )}

      <Dialogo abierto={!!edicion} onCerrar={() => setEdicion(null)} titulo={tituloDialogo}>
        {edicion && (
          <FormAparato
            inicial={
              edicion.modo === "editar"
                ? edicion.a
                : edicion.modo === "duplicar"
                  ? { ...edicion.a, id_catalogo: undefined, marca: edicion.a.marca === "Generica" ? "" : edicion.a.marca }
                  : undefined
            }
            global={edicion.modo === "nuevo" ? edicion.global : edicion.modo === "editar" && Boolean(edicion.a.es_global)}
            usos={edicion.modo === "editar" ? uso.data?.get(edicion.a.id_catalogo) ?? 0 : 0}
            onCancelar={() => setEdicion(null)}
            onListo={() => {
              avisar("Aparato guardado");
              setEdicion(null);
            }}
          />
        )}
      </Dialogo>

      <Dialogo abierto={!!aBorrar} onCerrar={() => { borrar.reset(); setABorrar(null); }} titulo="Borrar aparato">
        {aBorrar && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Borrar «{describirAparato(aBorrar)}»? Los códigos de vinculación sin usar que lo tengan también se borran.
            </p>
            {borrar.isError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {(borrar.error as { code?: string }).code === "23503"
                  ? "Este aparato está en uso en un medidor. Cámbialo allí antes de borrarlo."
                  : mensajeError(borrar.error)}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Boton variante="fantasma" onClick={() => { borrar.reset(); setABorrar(null); }}>Cancelar</Boton>
              <Boton
                variante="peligro"
                cargando={borrar.isPending}
                onClick={() => borrar.mutate(aBorrar.id_catalogo, { onSuccess: () => { avisar("Aparato borrado"); setABorrar(null); } })}
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
