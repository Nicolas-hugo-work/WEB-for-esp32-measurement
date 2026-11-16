import { useState, type FormEvent } from "react";
import { Boton, Campo, Entrada } from "../../components/ui";
import { fmtA } from "../../lib/electrica";
import { mensajeError } from "../../lib/errores";
import { useUsuario } from "../../auth/contexto";
import { esquemaAparato, useGuardarAparato, type Aparato } from "./api";

/** Crear o editar un aparato del catálogo. `inicial` sin id_catalogo = duplicar. */
export function FormAparato({
  inicial,
  global = false,
  usos = 0,
  onListo,
  onCancelar,
}: {
  inicial?: Partial<Aparato>;
  global?: boolean;
  usos?: number;
  onListo: (idCatalogo: number) => void;
  onCancelar: () => void;
}) {
  const usuario = useUsuario();
  const guardar = useGuardarAparato();
  const [v, setV] = useState({
    tipo: inicial?.tipo ?? "",
    marca: inicial?.marca ?? "",
    modelo: inicial?.modelo ?? "",
    potencia: inicial?.potencia_nominal_w != null ? String(inicial.potencia_nominal_w) : "",
    voltaje: String(inicial?.voltaje_nominal_v ?? 220),
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const num = (s: string) => Number(s.replace(",", "."));
  const corriente = num(v.potencia) > 0 && num(v.voltaje) > 0 ? num(v.potencia) / num(v.voltaje) : null;
  const cambia = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const r = esquemaAparato.safeParse({
      tipo: v.tipo,
      marca: v.marca,
      modelo: v.modelo,
      potencia_nominal_w: num(v.potencia),
      voltaje_nominal_v: num(v.voltaje),
    });
    if (!r.success) {
      setErrores(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrores({});
    guardar.mutate(
      { id_catalogo: inicial?.id_catalogo, global, id_usuario: usuario.id, datos: r.data },
      { onSuccess: (id) => onListo(id) },
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Tipo de aparato *" htmlFor="ap-tipo" error={errores.tipo}>
        <Entrada id="ap-tipo" value={v.tipo} onChange={cambia("tipo")} placeholder="Ej. Hervidor" maxLength={60} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Marca" htmlFor="ap-marca" error={errores.marca}>
          <Entrada id="ap-marca" value={v.marca} onChange={cambia("marca")} maxLength={60} />
        </Campo>
        <Campo etiqueta="Modelo" htmlFor="ap-modelo" error={errores.modelo}>
          <Entrada id="ap-modelo" value={v.modelo} onChange={cambia("modelo")} maxLength={60} />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Potencia (W) *" htmlFor="ap-pot" error={errores.potencia_nominal_w} ayuda="Está en la etiqueta del aparato.">
          <Entrada id="ap-pot" inputMode="decimal" value={v.potencia} onChange={cambia("potencia")} />
        </Campo>
        <Campo etiqueta="Voltaje (V)" htmlFor="ap-volt" error={errores.voltaje_nominal_v}>
          <Entrada id="ap-volt" inputMode="decimal" value={v.voltaje} onChange={cambia("voltaje")} />
        </Campo>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Corriente normal: <strong>{corriente != null ? fmtA(corriente) : "—"}</strong>
      </p>
      {usos > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Cambiar la potencia cambia el límite automático de {usos} {usos === 1 ? "medidor tuyo" : "medidores tuyos"}.
        </p>
      )}
      {global && (
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          Aparato general: lo verán todos los usuarios.
        </p>
      )}
      {guardar.isError && <p role="alert" className="text-sm text-red-600">{mensajeError(guardar.error)}</p>}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={onCancelar}>Cancelar</Boton>
        <Boton type="submit" cargando={guardar.isPending}>Guardar</Boton>
      </div>
    </form>
  );
}
