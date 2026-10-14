/**
 * NASAQ POS — ESC/POS Command Stream Builder (Phase 12B)
 *
 * Generates raw ESC/POS byte sequences for thermal printers.
 * Supports standard POS commands, cash drawer pulses, cuts, and raster bit-images.
 */

import { ArabicTextProcessor } from './ArabicTextProcessor';

export type EscPosCodePage = 'CP864' | 'WPC1256';

import { CP864_PRESENTATION, WPC1256 } from './EscPosCodePages';
export { CP864_PRESENTATION } from './EscPosCodePages';

export class EscPosBuilder {
  private buffer: number[] = [];
  private readonly codePage: EscPosCodePage;
  private readonly codePageId: number;
  private codePageSent = false;
  private warnedCharacters = new Set<string>();

  constructor(codePage: EscPosCodePage = 'CP864', codePageId?: number) {
    this.codePage = codePage;
    this.codePageId = Number.isInteger(codePageId) && codePageId! >= 0 && codePageId! <= 255
      ? codePageId!
      : codePage === 'CP864' ? 17 : 33;
    this.init();
  }

  /**
   * Initializes printer to default settings: ESC @ (0x1B 0x40)
   */
  public init(): this {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  /**
   * Sets text alignment: ESC a n (0: Left, 1: Center, 2: Right)
   */
  public align(alignment: 'left' | 'center' | 'right'): this {
    const code = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, code);
    return this;
  }

  /**
   * Toggles bold mode: ESC E n (0: Off, 1: On)
   */
  public bold(enable: boolean): this {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0);
    return this;
  }

  /**
   * Sets text magnification: GS ! n
   * width: 1 to 4, height: 1 to 4
   */
  public textSize(width: number = 1, height: number = 1): this {
    const w = Math.max(1, Math.min(width, 4)) - 1;
    const h = Math.max(1, Math.min(height, 4)) - 1;
    const n = (w << 4) | h;
    this.buffer.push(0x1d, 0x21, n);
    return this;
  }

  /**
   * Feeds n lines: ESC d n
   */
  public feed(lines: number = 1): this {
    this.buffer.push(0x1b, 0x64, Math.max(1, lines));
    return this;
  }

  /**
   * Adds raw line feed: LF (0x0A)
   */
  public newLine(): this {
    this.buffer.push(0x0a);
    return this;
  }

  /**
   * Appends text string. If contains Arabic, applies shaping and BiDi reordering.
   */
  public text(str: string): this {
    if (!str) return this;

    // Thermal code pages do not carry Arabic harakat/tatweel. Remove them
    // before shaping so they never become the unsupported-character dash.
    const normalized = str.replace(/[\u064B-\u0652\u0670\u0640]/g, '');

    // Check if contains Arabic characters
    let hasArabic = false;
    for (let i = 0; i < normalized.length; i++) {
      if (ArabicTextProcessor.isArabic(normalized.charCodeAt(i))) {
        hasArabic = true;
        break;
      }
    }

    const shaped = hasArabic
      ? this.codePage === 'CP864'
        ? ArabicTextProcessor.prepareForPrinter(normalized)
        : ArabicTextProcessor.visualReorder(normalized)
      : normalized;
    // CP864 has no hamza-below glyph. Preserve readable base letters for alef and lam-alef.
    const processed = this.codePage === 'CP864'
      ? shaped.replace(/[\uFE87\uFE88]/g, (char) => char === '\uFE87' ? '\uFE8D' : '\uFE8E')
        .replace(/[\uFEF9\uFEFA]/g, (char) => char === '\uFEF9' ? '\uFEFB' : '\uFEFC')
      : shaped;
    if (!this.codePageSent) {
      this.buffer.push(0x1b, 0x74, this.codePageId);
      this.codePageSent = true;
    }
    for (const char of processed) {
      if (this.codePage === 'WPC1256') {
        this.buffer.push(this.encodeCharacter(char, WPC1256));
      } else {
        this.buffer.push(this.encodeCharacter(char, CP864_PRESENTATION));
      }
    }

    return this;
  }


  private encodeCharacter(char: string, table: Record<string, number>): number {
    if (table[char] !== undefined) return table[char];
    if (char.charCodeAt(0) < 0x80) return char.charCodeAt(0);
    if (!this.warnedCharacters.has(char)) {
      this.warnedCharacters.add(char);
      console.warn(`ESC/POS code page ${this.codePage} لا يدعم الحرف ${char}; تم استبداله بشرطة.`);
    }
    return 0x2d;
  }

  /**
   * Appends text followed by a new line.
   */
  public line(str: string = ''): this {
    if (str) this.text(str);
    this.newLine();
    return this;
  }

  /**
   * Horizontal separator line.
   */
  public rule(char: string = '-', width: number = 48): this {
    return this.line(char.repeat(width));
  }

  /**
   * Double horizontal line.
   */
  public doubleRule(width: number = 48): this {
    return this.line('='.repeat(width));
  }

  /**
   * Two-column row formatted with justified spaces.
   */
  public twoColumnRow(left: string, right: string, width: number = 48): this {
    const formatted = ArabicTextProcessor.formatRow(left, right, width);
    return this.line(formatted);
  }

  /**
   * Three-column item row: Name, Qty, Total
   */
  public itemRow(name: string, qty: string, total: string, width: number = 48): this {
    const formatted = ArabicTextProcessor.formatItemRow(name, qty, total, width);
    return this.line(formatted);
  }

  /**
   * Cash Drawer Kick Pulse: ESC p m t1 t2
   * m: 0 (pin 2) or 1 (pin 5)
   * t1: pulse on time (units of 2ms, e.g. 25 = 50ms)
   * t2: pulse off time (units of 2ms, e.g. 250 = 500ms)
   */
  public pulseDrawer(pin: number = 0, onUnits: number = 25, offUnits: number = 250): this {
    this.buffer.push(0x1b, 0x70, pin, onUnits, offUnits);
    return this;
  }

  /**
   * Paper Cut: GS V m (0x1D 0x56)
   * 0x00: Full cut
   * 0x01: Partial cut
   * 0x42 0x00: Feed and cut
   */
  public cut(partial: boolean = false): this {
    this.feed(3);
    this.buffer.push(0x1d, 0x56, partial ? 0x01 : 0x00);
    return this;
  }

  /**
   * Standard GS v 0 raster bit image:
   * GS v 0 m xL xH yL yH d1...dk
   * m = 0 (normal)
   * width in bytes = Math.ceil(widthDots / 8)
   */
  public rasterBitImage(widthDots: number, heightDots: number, bitmapData: Uint8Array): this {
    const bytesWidth = Math.ceil(widthDots / 8);
    const xL = bytesWidth & 0xff;
    const xH = (bytesWidth >> 8) & 0xff;
    const yL = heightDots & 0xff;
    const yH = (heightDots >> 8) & 0xff;

    this.buffer.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);
    for (let i = 0; i < bitmapData.length; i++) {
      this.buffer.push(bitmapData[i]);
    }
    this.newLine();
    return this;
  }

  /**
   * Returns the final ESC/POS byte sequence.
   */
  public build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
