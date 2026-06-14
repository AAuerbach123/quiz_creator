// Minimale Typdeklaration für utif (TIFF-Encoder, liefert keine eigenen Typen).
declare module "utif" {
  export function encodeImage(rgba: ArrayBuffer | Uint8Array, w: number, h: number): ArrayBuffer;
}
