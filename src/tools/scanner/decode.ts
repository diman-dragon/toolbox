export type ScanMode = 'all' | 'qr' | 'bar';

export interface Decoded {
  text: string;
  format: string;
}

export interface Decoder {
  readonly kind: 'native' | 'zxing';
  decode(canvas: HTMLCanvasElement): Promise<Decoded | null>;
}

const QR = ['qr_code'];
const BAR = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar'];
const MATRIX = ['data_matrix', 'pdf417', 'aztec'];

const formatsFor = (m: ScanMode) => (m === 'qr' ? QR : m === 'bar' ? BAR : [...QR, ...BAR, ...MATRIX]);

/* eslint-disable @typescript-eslint/no-explicit-any */

async function nativeDecoder(mode: ScanMode): Promise<Decoder | null> {
  const BD = (window as any).BarcodeDetector;
  if (!BD) return null;
  try {
    const supported: string[] = await BD.getSupportedFormats();
    const formats = formatsFor(mode).filter((f) => supported.includes(f));
    if (!formats.length) return null;
    const det = new BD({ formats });
    return {
      kind: 'native',
      async decode(canvas) {
        const r: Array<{ rawValue: string; format: string }> = await det.detect(canvas);
        return r.length && r[0].rawValue ? { text: r[0].rawValue, format: r[0].format } : null;
      },
    };
  } catch {
    return null;
  }
}

/** ZXing (чистый JS, работает офлайн везде, в том числе в Android WebView). Тип модуля намеренно свободный. */
async function zxingDecoder(mode: ScanMode): Promise<Decoder> {
  const Z: any = await import('@zxing/library');
  const names: Record<string, string> = {
    qr_code: 'QR_CODE',
    ean_13: 'EAN_13',
    ean_8: 'EAN_8',
    upc_a: 'UPC_A',
    upc_e: 'UPC_E',
    code_128: 'CODE_128',
    code_39: 'CODE_39',
    code_93: 'CODE_93',
    itf: 'ITF',
    codabar: 'CODABAR',
    data_matrix: 'DATA_MATRIX',
    pdf417: 'PDF_417',
    aztec: 'AZTEC',
  };
  const hints = new Map<any, any>();
  hints.set(
    Z.DecodeHintType.POSSIBLE_FORMATS,
    formatsFor(mode).map((f) => Z.BarcodeFormat[names[f]]),
  );
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  return {
    kind: 'zxing',
    async decode(canvas) {
      const c = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
      const { width, height } = canvas;
      const px = c.getImageData(0, 0, width, height).data;
      const gray = new Uint8ClampedArray(width * height);
      for (let i = 0, j = 0; i < gray.length; i++, j += 4)
        gray[i] = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8;
      const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(gray, width, height)));
      try {
        const r = reader.decodeWithState(bitmap);
        const fmt: string = Z.BarcodeFormat[r.getBarcodeFormat()] ?? '';
        return { text: r.getText(), format: fmt };
      } catch {
        return null; // NotFoundException и прочее: на кадре кода нет
      }
    },
  };
}

/** Родной BarcodeDetector, если он есть (быстрее), иначе ZXing. */
export async function createDecoder(mode: ScanMode): Promise<Decoder> {
  return (await nativeDecoder(mode)) ?? zxingDecoder(mode);
}
