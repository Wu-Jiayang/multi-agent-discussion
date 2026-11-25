// Probe helper. The harness supplies Unicode East Asian W/F ranges.
const clusters = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const visible = /[^\p{Mark}\p{Format}]/u;
const emoji = /(?:\p{Emoji_Presentation}|\ufe0f|\u20e3)/u;

export function displayWidth(text, ranges) {
  let width = 0;
  for (const { segment } of clusters.segment(text)) {
    if (segment === "\r\n" || /^[\r\n\t]$/.test(segment)) {
      width++;
      continue;
    }
    const glyph = segment.match(visible)?.[0];
    if (!glyph) continue;
    const cp = glyph.codePointAt(0);
    width += emoji.test(segment) || ranges.some(([start, end]) => cp >= start && cp <= end) ? 2 : 1;
  }
  return width;
}
