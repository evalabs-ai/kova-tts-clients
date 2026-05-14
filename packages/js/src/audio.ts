import { KovaTTSProtocolError } from "./errors.js";

export type Pcm16WavOptions = {
  sampleRate: number;
  channels?: number;
};

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

export function pcm16ToWavBytes(pcm: Uint8Array, options: Pcm16WavOptions): Uint8Array {
  const channels = options.channels ?? 1;
  if (!Number.isInteger(options.sampleRate) || options.sampleRate <= 0) {
    throw new KovaTTSProtocolError("WAV sampleRate must be a positive integer");
  }
  if (!Number.isInteger(channels) || channels <= 0) {
    throw new KovaTTSProtocolError("WAV channels must be a positive integer");
  }
  if (pcm.byteLength % 2 !== 0) {
    throw new KovaTTSProtocolError("PCM16 data must have an even byte length");
  }

  const headerSize = 44;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = options.sampleRate * blockAlign;
  const wav = new Uint8Array(headerSize + pcm.byteLength);
  const view = new DataView(wav.buffer);

  writeAscii(wav, 0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(wav, 8, "WAVE");
  writeAscii(wav, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, options.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(wav, 36, "data");
  view.setUint32(40, pcm.byteLength, true);
  wav.set(pcm, headerSize);
  return wav;
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}
