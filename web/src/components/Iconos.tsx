import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P): P => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  ...p,
});

export const IcoInicio = (p: P) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
);
export const IcoCampana = (p: P) => (
  <svg {...base(p)}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
);
export const IcoMas = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IcoMenu = (p: P) => (
  <svg {...base(p)}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
);
export const IcoRayo = (p: P) => (
  <svg {...base(p)}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
);
export const IcoAtras = (p: P) => (
  <svg {...base(p)}><path d="m15 18-6-6 6-6" /></svg>
);
export const IcoAviso = (p: P) => (
  <svg {...base(p)}><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3" /><path d="M12 9v4M12 17h.01" /></svg>
);
export const IcoWifiOff = (p: P) => (
  <svg {...base(p)}><path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.3-3.7M12 20h.01" /></svg>
);
export const IcoCopiar = (p: P) => (
  <svg {...base(p)}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);
export const IcoCheck = (p: P) => (
  <svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>
);
export const IcoFlecha = (p: P) => (
  <svg {...base(p)}><path d="m9 18 6-6-6-6" /></svg>
);
