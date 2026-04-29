import { KovaTTSProtocolError } from "./errors.js";

export function decodeBase64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function decodePcm16LeBase64(value: string): Int16Array {
  return pcmBytesToInt16(decodeBase64ToBytes(value));
}

export function pcmBytesToInt16(bytes: Uint8Array): Int16Array {
  if (bytes.byteLength % 2 !== 0) {
    throw new KovaTTSProtocolError("PCM16 data must have an even byte length");
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Int16Array(copy.buffer);
}
