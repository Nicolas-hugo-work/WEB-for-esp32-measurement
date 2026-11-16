import { createContext, useContext } from "react";

export type TipoAviso = "ok" | "error";
export const CtxAviso = createContext<(texto: string, tipo?: TipoAviso) => void>(() => {});
export const useAviso = () => useContext(CtxAviso);
