import QRCode from "qrcode";

// S3e: uptime text and the QR code for the room URL (milestone: `qrcode`, SVG output).

/** "under a minute", "12 min", "5 h 12 min", "3 d 4 h". */
export function formatUptime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "under a minute";
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes} min`;
  const days = Math.floor(hours / 24);
  if (days < 1) return `${hours} h ${minutes % 60} min`;
  return `${days} d ${hours % 24} h`;
}

/** Quiet zone around the code, in modules (ISO/IEC 18004 asks for 4). */
export const QR_QUIET_MODULES = 4;

export interface QrPath {
  /** Modules per side, without the quiet zone. */
  size: number;
  /** One `M x y h1 v1 h-1 z` square per dark module, already offset by the quiet zone. */
  d: string;
}

/** The QR matrix as one SVG path (error correction M), so the page draws it with token colours. */
export function qrPath(text: string): QrPath {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const squares: string[] = [];
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col) === 1) squares.push(`M${col + QR_QUIET_MODULES} ${row + QR_QUIET_MODULES}h1v1h-1z`);
    }
  }
  return { size: modules.size, d: squares.join("") };
}
