import GraphemerModule from "graphemer";
import emojiRegexModule from "emoji-regex";
import unicode from "./unicode-15.json" with { type: "json" };
import { RoomError } from "./errors.mjs";
import { MAX_AGENT_MESSAGE_WIDTH } from "./message-limits.mjs";

export { MAX_AGENT_MESSAGE_WIDTH };

let Graphemer = GraphemerModule;
while (Graphemer?.default) Graphemer = Graphemer.default;
let emojiRegex = emojiRegexModule;
while (emojiRegex?.default) emojiRegex = emojiRegex.default;

// Pin every Unicode-dependent input to Unicode 15.0.0. The host ICU version
// never participates in segmentation, width lookup, or emoji classification.
const splitter = new Graphemer();
const emoji = new RegExp(emojiRegex().source, "u");

export const UNICODE_IMPLEMENTATION = "Unicode 15.0.0 + graphemer@1.4.0 + emoji-regex@10.2.0";

function inRanges(codePoint, ranges) {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const [start, end] = ranges[middle];
    if (codePoint < start) high = middle - 1;
    else if (codePoint > end) low = middle + 1;
    else return true;
  }
  return false;
}

export function displayWidth(input) {
  let width = 0;
  for (const grapheme of splitter.splitGraphemes(String(input))) {
    if (grapheme === "\r\n" || grapheme === "\n" || grapheme === "\r" || grapheme === "\t") {
      width += 1;
      continue;
    }
    if (emoji.test(grapheme)) {
      width += 2;
      continue;
    }
    let glyph = null;
    for (const char of grapheme) {
      const codePoint = char.codePointAt(0);
      if (!inRanges(codePoint, unicode.zeroWidth)) { glyph = codePoint; break; }
    }
    if (glyph == null) continue;
    width += inRanges(glyph, unicode.wide) ? 2 : 1;
  }
  return width;
}

export function assertAgentWidth(text, label = "message") {
  const actual = displayWidth(text);
  if (actual > MAX_AGENT_MESSAGE_WIDTH) {
    throw new RoomError("ROOM_MESSAGE_TOO_LONG", `${label} is ${actual} display columns; the limit is ${MAX_AGENT_MESSAGE_WIDTH}. Most Chinese characters use two columns. Shorten and retry.`, { actual, max: MAX_AGENT_MESSAGE_WIDTH }, 422);
  }
  return actual;
}
