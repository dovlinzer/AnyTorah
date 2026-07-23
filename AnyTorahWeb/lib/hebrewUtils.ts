// Ported from AnyTorah/AnyTorah/Models/HebrewUtils.swift (`String.strippingNikud`).

/** Strips Hebrew cantillation marks and vowel points (U+0591–U+05C7), matching native's
 *  `strippingNikud`. Used for saHebrewMode display names, which are stored with full nikud. */
export function stripNikud(s: string): string {
  return Array.from(s)
    .filter((ch) => {
      const code = ch.codePointAt(0)!;
      return code < 0x0591 || code > 0x05c7;
    })
    .join("");
}
