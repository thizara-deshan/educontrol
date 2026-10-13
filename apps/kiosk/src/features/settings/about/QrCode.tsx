import { useMemo } from "react";
import { QR_QUIET_MODULES, qrPath } from "./about.view";

/** S3e QR: dark modules (`bg`) on a light square (`text-1`) so phone cameras read it on the dark UI. */
export function QrCode({ url }: { url: string }) {
  const qr = useMemo(() => qrPath(url), [url]);
  const side = qr.size + 2 * QR_QUIET_MODULES;
  return (
    <svg
      role="img"
      aria-label={`QR code for ${url}`}
      viewBox={`0 0 ${side} ${side}`}
      shapeRendering="crispEdges"
      className="size-48 rounded-btn bg-text-1 lg:size-56"
    >
      <path d={qr.d} className="fill-bg" />
    </svg>
  );
}
