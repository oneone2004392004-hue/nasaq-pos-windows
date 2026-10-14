/**
 * NASAQ POS — Arabic Text Processor for Thermal Printers (Phase 12B)
 *
 * Provides:
 * 1. Contextual Arabic letter reshaping (Isolated, Initial, Medial, Final forms).
 * 2. Visual BiDi reordering for Left-to-Right thermal printer engines.
 * 3. Preservation of English tokens, numbers, and punctuation.
 * 4. Fixed column formatting for 58mm (32 chars) and 80mm (48 chars).
 */

interface ArabicGlyphMap {
  isolated: number;
  final: number;
  initial: number;
  medial: number;
}

// Arabic Unicode block mapping to Arabic Presentation Forms-B
const ARABIC_GLYPHS: Record<number, ArabicGlyphMap> = {
  // Hamza & Alefs
  0x0621: { isolated: 0xFE80, final: 0xFE80, initial: 0xFE80, medial: 0xFE80 }, // ء
  0x0622: { isolated: 0xFE81, final: 0xFE82, initial: 0xFE81, medial: 0xFE82 }, // آ
  0x0623: { isolated: 0xFE83, final: 0xFE84, initial: 0xFE83, medial: 0xFE84 }, // أ
  0x0624: { isolated: 0xFE85, final: 0xFE86, initial: 0xFE85, medial: 0xFE86 }, // ؤ
  0x0625: { isolated: 0xFE87, final: 0xFE88, initial: 0xFE87, medial: 0xFE88 }, // إ
  0x0626: { isolated: 0xFE89, final: 0xFE8A, initial: 0xFE8B, medial: 0xFE8C }, // ئ
  0x0627: { isolated: 0xFE8D, final: 0xFE8E, initial: 0xFE8D, medial: 0xFE8E }, // ا

  // Baa family
  0x0628: { isolated: 0xFE8F, final: 0xFE90, initial: 0xFE91, medial: 0xFE92 }, // ب
  0x0629: { isolated: 0xFE93, final: 0xFE94, initial: 0xFE93, medial: 0xFE94 }, // ة
  0x062A: { isolated: 0xFE95, final: 0xFE96, initial: 0xFE97, medial: 0xFE98 }, // ت
  0x062B: { isolated: 0xFE99, final: 0xFE9A, initial: 0xFE9B, medial: 0xFE9C }, // ث

  // Jeem family
  0x062C: { isolated: 0xFE9D, final: 0xFE9E, initial: 0xFE9F, medial: 0xFEA0 }, // ج
  0x062D: { isolated: 0xFEA1, final: 0xFEA2, initial: 0xFEA3, medial: 0xFEA4 }, // ح
  0x062E: { isolated: 0xFEA5, final: 0xFEA6, initial: 0xFEA7, medial: 0xFEA8 }, // خ

  // Dal family (non-connecting to next)
  0x062F: { isolated: 0xFEA9, final: 0xFEAA, initial: 0xFEA9, medial: 0xFEAA }, // د
  0x0630: { isolated: 0xFEAB, final: 0xFEAC, initial: 0xFEAB, medial: 0xFEAC }, // ذ

  // Raa family (non-connecting to next)
  0x0631: { isolated: 0xFEAD, final: 0xFEAE, initial: 0xFEAD, medial: 0xFEAE }, // ر
  0x0632: { isolated: 0xFEAF, final: 0xFEB0, initial: 0xFEAF, medial: 0xFEB0 }, // ز

  // Seen family
  0x0633: { isolated: 0xFEB1, final: 0xFEB2, initial: 0xFEB3, medial: 0xFEB4 }, // س
  0x0634: { isolated: 0xFEB5, final: 0xFEB6, initial: 0xFEB7, medial: 0xFEB8 }, // ش
  0x0635: { isolated: 0xFEB9, final: 0xFEBA, initial: 0xFEBB, medial: 0xFEBC }, // ص
  0x0636: { isolated: 0xFEBD, final: 0xFEBE, initial: 0xFEBF, medial: 0xFEC0 }, // ض

  // Taa & Dhaa
  0x0637: { isolated: 0xFEC1, final: 0xFEC2, initial: 0xFEC3, medial: 0xFEC4 }, // ط
  0x0638: { isolated: 0xFEC5, final: 0xFEC6, initial: 0xFEC7, medial: 0xFEC8 }, // ظ

  // Ain & Ghain
  0x0639: { isolated: 0xFEC9, final: 0xFECA, initial: 0xFECB, medial: 0xFECC }, // ع
  0x063A: { isolated: 0xFECD, final: 0xFECE, initial: 0xFECF, medial: 0xFED0 }, // غ

  // Faa & Qaaf
  0x0641: { isolated: 0xFED1, final: 0xFED2, initial: 0xFED3, medial: 0xFED4 }, // ف
  0x0642: { isolated: 0xFED5, final: 0xFED6, initial: 0xFED7, medial: 0xFED8 }, // ق

  // Kaaf & Laam
  0x0643: { isolated: 0xFED9, final: 0xFEDA, initial: 0xFEDB, medial: 0xFEDC }, // ك
  0x0644: { isolated: 0xFEDD, final: 0xFEDE, initial: 0xFEDF, medial: 0xFEE0 }, // ل

  // Meem, Noon, Haa
  0x0645: { isolated: 0xFEE1, final: 0xFEE2, initial: 0xFEE3, medial: 0xFEE4 }, // م
  0x0646: { isolated: 0xFEE5, final: 0xFEE6, initial: 0xFEE7, medial: 0xFEE8 }, // ن
  0x0647: { isolated: 0xFEE9, final: 0xFEEA, initial: 0xFEEB, medial: 0xFEEC }, // ه

  // Waaw (non-connecting to next)
  0x0648: { isolated: 0xFEED, final: 0xFEEE, initial: 0xFEED, medial: 0xFEEE }, // و

  // Yaa & Alef Maksura
  0x0649: { isolated: 0xFEEF, final: 0xFEF0, initial: 0xFBE8, medial: 0xFBE9 }, // ى
  0x064A: { isolated: 0xFEF1, final: 0xFEF2, initial: 0xFEF3, medial: 0xFEF4 }, // ي
};

// Characters that do not connect to the following character
const NON_CONNECTING_TO_NEXT = new Set<number>([
  0x0621, // ء
  0x0622, // آ
  0x0623, // أ
  0x0624, // ؤ
  0x0625, // إ
  0x0627, // ا
  0x062F, // د
  0x0630, // ذ
  0x0631, // ر
  0x0632, // ز
  0x0648, // و
  0x0649, // ى (when final)
]);

export class ArabicTextProcessor {
  /**
   * Determines if a character code belongs to the basic Arabic unicode block.
   */
  public static isArabic(charCode: number): boolean {
    return (charCode >= 0x0600 && charCode <= 0x06FF) || (charCode >= 0xFB50 && charCode <= 0xFEFC);
  }

  /**
   * Reshapes Arabic letters into their contextual presentation forms (Initial, Medial, Final, Isolated).
   */
  public static reshape(text: string): string {
    if (!text) return '';

    const codes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      codes.push(text.charCodeAt(i));
    }

    const reshaped: number[] = [];

    for (let i = 0; i < codes.length; i++) {
      const current = codes[i];
      const mapping = ARABIC_GLYPHS[current];

      if (!mapping) {
        reshaped.push(current);
        continue;
      }

      // Check Lam-Alef ligatures
      if (current === 0x0644 && i + 1 < codes.length) {
        const next = codes[i + 1];
        let ligature: { isolated: number; final: number } | null = null;
        if (next === 0x0622) ligature = { isolated: 0xFEF5, final: 0xFEF6 }; // لا آ
        else if (next === 0x0623) ligature = { isolated: 0xFEF7, final: 0xFEF8 }; // لا أ
        else if (next === 0x0625) ligature = { isolated: 0xFEF9, final: 0xFEFA }; // لا إ
        else if (next === 0x0627) ligature = { isolated: 0xFEFB, final: 0xFEFC }; // لا ا

        if (ligature) {
          const prev = i > 0 ? codes[i - 1] : 0;
          const connectsToPrev = ARABIC_GLYPHS[prev] && !NON_CONNECTING_TO_NEXT.has(prev);
          reshaped.push(connectsToPrev ? ligature.final : ligature.isolated);
          i++; // Skip the alef
          continue;
        }
      }

      const prev = i > 0 ? codes[i - 1] : 0;
      const next = i + 1 < codes.length ? codes[i + 1] : 0;

      const connectsToPrev = ARABIC_GLYPHS[prev] && !NON_CONNECTING_TO_NEXT.has(prev);
      const connectsToNext = ARABIC_GLYPHS[next] && !NON_CONNECTING_TO_NEXT.has(current);

      if (connectsToPrev && connectsToNext) {
        reshaped.push(mapping.medial);
      } else if (connectsToPrev) {
        reshaped.push(mapping.final);
      } else if (connectsToNext) {
        reshaped.push(mapping.initial);
      } else {
        reshaped.push(mapping.isolated);
      }
    }

    return String.fromCharCode(...reshaped);
  }

  /**
   * BiDi Reversal:
   * Reverses Arabic characters so that Left-to-Right thermal printers output correct RTL words.
   * Keeps numeric segments and Latin words in logical LTR order.
   */
  public static visualReorder(text: string): string {
    if (!text) return '';

    // Tokenize into segments of: Arabic, Numbers, English/Symbols
    const tokens: { type: 'ARABIC' | 'LTR'; value: string }[] = [];
    let currentType: 'ARABIC' | 'LTR' | null = null;
    let currentVal = '';

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const code = ch.charCodeAt(0);
      const isAr = ArabicTextProcessor.isArabic(code);
      const type = isAr ? 'ARABIC' : 'LTR';

      if (type !== currentType) {
        if (currentVal) {
          tokens.push({ type: currentType!, value: currentVal });
        }
        currentType = type;
        currentVal = ch;
      } else {
        currentVal += ch;
      }
    }

    if (currentVal) {
      tokens.push({ type: currentType!, value: currentVal });
    }

    // Now reverse the entire line order for RTL display, but keep LTR token contents intact
    // Within an Arabic token, reverse the characters
    const processedTokens = tokens.map((tok) => {
      if (tok.type === 'ARABIC') {
        return tok.value.split('').reverse().join('');
      }
      return tok.value;
    });

    // Reverse token sequence so RTL flows from right margin to left
    return processedTokens.reverse().join('');
  }

  /**
   * Complete pipeline for raw ESC/POS text printing: Reshapes then visually reorders.
   */
  public static prepareForPrinter(text: string): string {
    const reshaped = ArabicTextProcessor.reshape(text);
    return ArabicTextProcessor.visualReorder(reshaped);
  }

  /**
   * Formats a two-column row with padding between left and right columns.
   * e.g. "المجموع" on one side and "50.00 ج.م" on the other side.
   */
  public static formatRow(col1: string, col2: string, width: number = 48): string {
    const c1 = col1 || '';
    const c2 = col2 || '';
    const len1 = c1.length;
    const len2 = c2.length;
    const spaces = Math.max(1, width - len1 - len2);
    return c1 + ' '.repeat(spaces) + c2;
  }

  /**
   * Formats a three-column row: Name, Qty, Total.
   */
  public static formatItemRow(name: string, qty: string, total: string, width: number = 48): string {
    const qtyTotal = `${qty}  ${total}`;
    const nameMaxLen = Math.max(10, width - qtyTotal.length - 2);
    const truncatedName = name.length > nameMaxLen ? name.substring(0, nameMaxLen - 1) + '.' : name;
    const spaces = Math.max(1, width - truncatedName.length - qtyTotal.length);
    return truncatedName + ' '.repeat(spaces) + qtyTotal;
  }
}
