var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/graphemer/lib/boundaries.js
var require_boundaries = __commonJS({
  "node_modules/graphemer/lib/boundaries.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EXTENDED_PICTOGRAPHIC = exports.CLUSTER_BREAK = void 0;
    var CLUSTER_BREAK;
    (function(CLUSTER_BREAK2) {
      CLUSTER_BREAK2[CLUSTER_BREAK2["CR"] = 0] = "CR";
      CLUSTER_BREAK2[CLUSTER_BREAK2["LF"] = 1] = "LF";
      CLUSTER_BREAK2[CLUSTER_BREAK2["CONTROL"] = 2] = "CONTROL";
      CLUSTER_BREAK2[CLUSTER_BREAK2["EXTEND"] = 3] = "EXTEND";
      CLUSTER_BREAK2[CLUSTER_BREAK2["REGIONAL_INDICATOR"] = 4] = "REGIONAL_INDICATOR";
      CLUSTER_BREAK2[CLUSTER_BREAK2["SPACINGMARK"] = 5] = "SPACINGMARK";
      CLUSTER_BREAK2[CLUSTER_BREAK2["L"] = 6] = "L";
      CLUSTER_BREAK2[CLUSTER_BREAK2["V"] = 7] = "V";
      CLUSTER_BREAK2[CLUSTER_BREAK2["T"] = 8] = "T";
      CLUSTER_BREAK2[CLUSTER_BREAK2["LV"] = 9] = "LV";
      CLUSTER_BREAK2[CLUSTER_BREAK2["LVT"] = 10] = "LVT";
      CLUSTER_BREAK2[CLUSTER_BREAK2["OTHER"] = 11] = "OTHER";
      CLUSTER_BREAK2[CLUSTER_BREAK2["PREPEND"] = 12] = "PREPEND";
      CLUSTER_BREAK2[CLUSTER_BREAK2["E_BASE"] = 13] = "E_BASE";
      CLUSTER_BREAK2[CLUSTER_BREAK2["E_MODIFIER"] = 14] = "E_MODIFIER";
      CLUSTER_BREAK2[CLUSTER_BREAK2["ZWJ"] = 15] = "ZWJ";
      CLUSTER_BREAK2[CLUSTER_BREAK2["GLUE_AFTER_ZWJ"] = 16] = "GLUE_AFTER_ZWJ";
      CLUSTER_BREAK2[CLUSTER_BREAK2["E_BASE_GAZ"] = 17] = "E_BASE_GAZ";
    })(CLUSTER_BREAK = exports.CLUSTER_BREAK || (exports.CLUSTER_BREAK = {}));
    exports.EXTENDED_PICTOGRAPHIC = 101;
  }
});

// node_modules/graphemer/lib/GraphemerHelper.js
var require_GraphemerHelper = __commonJS({
  "node_modules/graphemer/lib/GraphemerHelper.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var boundaries_1 = require_boundaries();
    var NotBreak = 0;
    var BreakStart = 1;
    var Break = 2;
    var BreakLastRegional = 3;
    var BreakPenultimateRegional = 4;
    var GraphemerHelper = class {
      /**
       * Check if the the character at the position {pos} of the string is surrogate
       * @param str {string}
       * @param pos {number}
       * @returns {boolean}
       */
      static isSurrogate(str, pos) {
        return 55296 <= str.charCodeAt(pos) && str.charCodeAt(pos) <= 56319 && 56320 <= str.charCodeAt(pos + 1) && str.charCodeAt(pos + 1) <= 57343;
      }
      /**
       * The String.prototype.codePointAt polyfill
       * Private function, gets a Unicode code point from a JavaScript UTF-16 string
       * handling surrogate pairs appropriately
       * @param str {string}
       * @param idx {number}
       * @returns {number}
       */
      static codePointAt(str, idx) {
        if (idx === void 0) {
          idx = 0;
        }
        const code = str.charCodeAt(idx);
        if (55296 <= code && code <= 56319 && idx < str.length - 1) {
          const hi = code;
          const low = str.charCodeAt(idx + 1);
          if (56320 <= low && low <= 57343) {
            return (hi - 55296) * 1024 + (low - 56320) + 65536;
          }
          return hi;
        }
        if (56320 <= code && code <= 57343 && idx >= 1) {
          const hi = str.charCodeAt(idx - 1);
          const low = code;
          if (55296 <= hi && hi <= 56319) {
            return (hi - 55296) * 1024 + (low - 56320) + 65536;
          }
          return low;
        }
        return code;
      }
      //
      /**
       * Private function, returns whether a break is allowed between the two given grapheme breaking classes
       * Implemented the UAX #29 3.1.1 Grapheme Cluster Boundary Rules on extended grapheme clusters
       * @param start {number}
       * @param mid {Array<number>}
       * @param end {number}
       * @param startEmoji {number}
       * @param midEmoji {Array<number>}
       * @param endEmoji {number}
       * @returns {number}
       */
      static shouldBreak(start, mid, end, startEmoji, midEmoji, endEmoji) {
        const all = [start].concat(mid).concat([end]);
        const allEmoji = [startEmoji].concat(midEmoji).concat([endEmoji]);
        const previous = all[all.length - 2];
        const next = end;
        const nextEmoji = endEmoji;
        const rIIndex = all.lastIndexOf(boundaries_1.CLUSTER_BREAK.REGIONAL_INDICATOR);
        if (rIIndex > 0 && all.slice(1, rIIndex).every(function(c) {
          return c === boundaries_1.CLUSTER_BREAK.REGIONAL_INDICATOR;
        }) && [boundaries_1.CLUSTER_BREAK.PREPEND, boundaries_1.CLUSTER_BREAK.REGIONAL_INDICATOR].indexOf(previous) === -1) {
          if (all.filter(function(c) {
            return c === boundaries_1.CLUSTER_BREAK.REGIONAL_INDICATOR;
          }).length % 2 === 1) {
            return BreakLastRegional;
          } else {
            return BreakPenultimateRegional;
          }
        }
        if (previous === boundaries_1.CLUSTER_BREAK.CR && next === boundaries_1.CLUSTER_BREAK.LF) {
          return NotBreak;
        } else if (previous === boundaries_1.CLUSTER_BREAK.CONTROL || previous === boundaries_1.CLUSTER_BREAK.CR || previous === boundaries_1.CLUSTER_BREAK.LF) {
          return BreakStart;
        } else if (next === boundaries_1.CLUSTER_BREAK.CONTROL || next === boundaries_1.CLUSTER_BREAK.CR || next === boundaries_1.CLUSTER_BREAK.LF) {
          return BreakStart;
        } else if (previous === boundaries_1.CLUSTER_BREAK.L && (next === boundaries_1.CLUSTER_BREAK.L || next === boundaries_1.CLUSTER_BREAK.V || next === boundaries_1.CLUSTER_BREAK.LV || next === boundaries_1.CLUSTER_BREAK.LVT)) {
          return NotBreak;
        } else if ((previous === boundaries_1.CLUSTER_BREAK.LV || previous === boundaries_1.CLUSTER_BREAK.V) && (next === boundaries_1.CLUSTER_BREAK.V || next === boundaries_1.CLUSTER_BREAK.T)) {
          return NotBreak;
        } else if ((previous === boundaries_1.CLUSTER_BREAK.LVT || previous === boundaries_1.CLUSTER_BREAK.T) && next === boundaries_1.CLUSTER_BREAK.T) {
          return NotBreak;
        } else if (next === boundaries_1.CLUSTER_BREAK.EXTEND || next === boundaries_1.CLUSTER_BREAK.ZWJ) {
          return NotBreak;
        } else if (next === boundaries_1.CLUSTER_BREAK.SPACINGMARK) {
          return NotBreak;
        } else if (previous === boundaries_1.CLUSTER_BREAK.PREPEND) {
          return NotBreak;
        }
        const previousNonExtendIndex = allEmoji.slice(0, -1).lastIndexOf(boundaries_1.EXTENDED_PICTOGRAPHIC);
        if (previousNonExtendIndex !== -1 && allEmoji[previousNonExtendIndex] === boundaries_1.EXTENDED_PICTOGRAPHIC && all.slice(previousNonExtendIndex + 1, -2).every(function(c) {
          return c === boundaries_1.CLUSTER_BREAK.EXTEND;
        }) && previous === boundaries_1.CLUSTER_BREAK.ZWJ && nextEmoji === boundaries_1.EXTENDED_PICTOGRAPHIC) {
          return NotBreak;
        }
        if (mid.indexOf(boundaries_1.CLUSTER_BREAK.REGIONAL_INDICATOR) !== -1) {
          return Break;
        }
        if (previous === boundaries_1.CLUSTER_BREAK.REGIONAL_INDICATOR && next === boundaries_1.CLUSTER_BREAK.REGIONAL_INDICATOR) {
          return NotBreak;
        }
        return BreakStart;
      }
    };
    exports.default = GraphemerHelper;
  }
});

// node_modules/graphemer/lib/GraphemerIterator.js
var require_GraphemerIterator = __commonJS({
  "node_modules/graphemer/lib/GraphemerIterator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var GraphemerIterator = class {
      constructor(str, nextBreak) {
        this._index = 0;
        this._str = str;
        this._nextBreak = nextBreak;
      }
      [Symbol.iterator]() {
        return this;
      }
      next() {
        let brk;
        if ((brk = this._nextBreak(this._str, this._index)) < this._str.length) {
          const value = this._str.slice(this._index, brk);
          this._index = brk;
          return { value, done: false };
        }
        if (this._index < this._str.length) {
          const value = this._str.slice(this._index);
          this._index = this._str.length;
          return { value, done: false };
        }
        return { value: void 0, done: true };
      }
    };
    exports.default = GraphemerIterator;
  }
});

// node_modules/graphemer/lib/Graphemer.js
var require_Graphemer = __commonJS({
  "node_modules/graphemer/lib/Graphemer.js"(exports) {
    "use strict";
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var boundaries_1 = require_boundaries();
    var GraphemerHelper_1 = __importDefault(require_GraphemerHelper());
    var GraphemerIterator_1 = __importDefault(require_GraphemerIterator());
    var Graphemer2 = class _Graphemer {
      /**
       * Returns the next grapheme break in the string after the given index
       * @param string {string}
       * @param index {number}
       * @returns {number}
       */
      static nextBreak(string, index) {
        if (index === void 0) {
          index = 0;
        }
        if (index < 0) {
          return 0;
        }
        if (index >= string.length - 1) {
          return string.length;
        }
        const prevCP = GraphemerHelper_1.default.codePointAt(string, index);
        const prev = _Graphemer.getGraphemeBreakProperty(prevCP);
        const prevEmoji = _Graphemer.getEmojiProperty(prevCP);
        const mid = [];
        const midEmoji = [];
        for (let i = index + 1; i < string.length; i++) {
          if (GraphemerHelper_1.default.isSurrogate(string, i - 1)) {
            continue;
          }
          const nextCP = GraphemerHelper_1.default.codePointAt(string, i);
          const next = _Graphemer.getGraphemeBreakProperty(nextCP);
          const nextEmoji = _Graphemer.getEmojiProperty(nextCP);
          if (GraphemerHelper_1.default.shouldBreak(prev, mid, next, prevEmoji, midEmoji, nextEmoji)) {
            return i;
          }
          mid.push(next);
          midEmoji.push(nextEmoji);
        }
        return string.length;
      }
      /**
       * Breaks the given string into an array of grapheme clusters
       * @param str {string}
       * @returns {string[]}
       */
      splitGraphemes(str) {
        const res = [];
        let index = 0;
        let brk;
        while ((brk = _Graphemer.nextBreak(str, index)) < str.length) {
          res.push(str.slice(index, brk));
          index = brk;
        }
        if (index < str.length) {
          res.push(str.slice(index));
        }
        return res;
      }
      /**
       * Returns an iterator of grapheme clusters in the given string
       * @param str {string}
       * @returns {GraphemerIterator}
       */
      iterateGraphemes(str) {
        return new GraphemerIterator_1.default(str, _Graphemer.nextBreak);
      }
      /**
       * Returns the number of grapheme clusters in the given string
       * @param str {string}
       * @returns {number}
       */
      countGraphemes(str) {
        let count = 0;
        let index = 0;
        let brk;
        while ((brk = _Graphemer.nextBreak(str, index)) < str.length) {
          index = brk;
          count++;
        }
        if (index < str.length) {
          count++;
        }
        return count;
      }
      /**
       * Given a Unicode code point, determines this symbol's grapheme break property
       * @param code {number} Unicode code point
       * @returns {number}
       */
      static getGraphemeBreakProperty(code) {
        if (code < 48905) {
          if (code < 44116) {
            if (code < 4141) {
              if (code < 2818) {
                if (code < 2363) {
                  if (code < 1759) {
                    if (code < 1471) {
                      if (code < 127) {
                        if (code < 11) {
                          if (code < 10) {
                            if (0 <= code && code <= 9) {
                              return boundaries_1.CLUSTER_BREAK.CONTROL;
                            }
                          } else {
                            if (10 === code) {
                              return boundaries_1.CLUSTER_BREAK.LF;
                            }
                          }
                        } else {
                          if (code < 13) {
                            if (11 <= code && code <= 12) {
                              return boundaries_1.CLUSTER_BREAK.CONTROL;
                            }
                          } else {
                            if (code < 14) {
                              if (13 === code) {
                                return boundaries_1.CLUSTER_BREAK.CR;
                              }
                            } else {
                              if (14 <= code && code <= 31) {
                                return boundaries_1.CLUSTER_BREAK.CONTROL;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 768) {
                          if (code < 173) {
                            if (127 <= code && code <= 159) {
                              return boundaries_1.CLUSTER_BREAK.CONTROL;
                            }
                          } else {
                            if (173 === code) {
                              return boundaries_1.CLUSTER_BREAK.CONTROL;
                            }
                          }
                        } else {
                          if (code < 1155) {
                            if (768 <= code && code <= 879) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 1425) {
                              if (1155 <= code && code <= 1161) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (1425 <= code && code <= 1469) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 1552) {
                        if (code < 1476) {
                          if (code < 1473) {
                            if (1471 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (1473 <= code && code <= 1474) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 1479) {
                            if (1476 <= code && code <= 1477) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 1536) {
                              if (1479 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (1536 <= code && code <= 1541) {
                                return boundaries_1.CLUSTER_BREAK.PREPEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 1648) {
                          if (code < 1564) {
                            if (1552 <= code && code <= 1562) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 1611) {
                              if (1564 === code) {
                                return boundaries_1.CLUSTER_BREAK.CONTROL;
                              }
                            } else {
                              if (1611 <= code && code <= 1631) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 1750) {
                            if (1648 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 1757) {
                              if (1750 <= code && code <= 1756) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (1757 === code) {
                                return boundaries_1.CLUSTER_BREAK.PREPEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 2075) {
                      if (code < 1840) {
                        if (code < 1770) {
                          if (code < 1767) {
                            if (1759 <= code && code <= 1764) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (1767 <= code && code <= 1768) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 1807) {
                            if (1770 <= code && code <= 1773) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (1807 === code) {
                              return boundaries_1.CLUSTER_BREAK.PREPEND;
                            }
                            if (1809 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      } else {
                        if (code < 2027) {
                          if (code < 1958) {
                            if (1840 <= code && code <= 1866) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (1958 <= code && code <= 1968) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 2045) {
                            if (2027 <= code && code <= 2035) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2070) {
                              if (2045 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (2070 <= code && code <= 2073) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 2200) {
                        if (code < 2089) {
                          if (code < 2085) {
                            if (2075 <= code && code <= 2083) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (2085 <= code && code <= 2087) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 2137) {
                            if (2089 <= code && code <= 2093) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2192) {
                              if (2137 <= code && code <= 2139) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (2192 <= code && code <= 2193) {
                                return boundaries_1.CLUSTER_BREAK.PREPEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 2275) {
                          if (code < 2250) {
                            if (2200 <= code && code <= 2207) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2274) {
                              if (2250 <= code && code <= 2273) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (2274 === code) {
                                return boundaries_1.CLUSTER_BREAK.PREPEND;
                              }
                            }
                          }
                        } else {
                          if (code < 2307) {
                            if (2275 <= code && code <= 2306) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (2307 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                            if (2362 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 2561) {
                    if (code < 2434) {
                      if (code < 2381) {
                        if (code < 2366) {
                          if (2363 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                          if (2364 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 2369) {
                            if (2366 <= code && code <= 2368) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 2377) {
                              if (2369 <= code && code <= 2376) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (2377 <= code && code <= 2380) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 2385) {
                          if (code < 2382) {
                            if (2381 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (2382 <= code && code <= 2383) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 2402) {
                            if (2385 <= code && code <= 2391) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2433) {
                              if (2402 <= code && code <= 2403) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (2433 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 2503) {
                        if (code < 2494) {
                          if (code < 2492) {
                            if (2434 <= code && code <= 2435) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (2492 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 2495) {
                            if (2494 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2497) {
                              if (2495 <= code && code <= 2496) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (2497 <= code && code <= 2500) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 2519) {
                          if (code < 2507) {
                            if (2503 <= code && code <= 2504) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 2509) {
                              if (2507 <= code && code <= 2508) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (2509 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 2530) {
                            if (2519 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2558) {
                              if (2530 <= code && code <= 2531) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (2558 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 2691) {
                      if (code < 2631) {
                        if (code < 2620) {
                          if (code < 2563) {
                            if (2561 <= code && code <= 2562) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (2563 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 2622) {
                            if (2620 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2625) {
                              if (2622 <= code && code <= 2624) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (2625 <= code && code <= 2626) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 2672) {
                          if (code < 2635) {
                            if (2631 <= code && code <= 2632) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2641) {
                              if (2635 <= code && code <= 2637) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (2641 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 2677) {
                            if (2672 <= code && code <= 2673) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2689) {
                              if (2677 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (2689 <= code && code <= 2690) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 2761) {
                        if (code < 2750) {
                          if (2691 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                          if (2748 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 2753) {
                            if (2750 <= code && code <= 2752) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 2759) {
                              if (2753 <= code && code <= 2757) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (2759 <= code && code <= 2760) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 2786) {
                          if (code < 2763) {
                            if (2761 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 2765) {
                              if (2763 <= code && code <= 2764) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (2765 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 2810) {
                            if (2786 <= code && code <= 2787) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2817) {
                              if (2810 <= code && code <= 2815) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (2817 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 3315) {
                  if (code < 3076) {
                    if (code < 2946) {
                      if (code < 2887) {
                        if (code < 2878) {
                          if (code < 2876) {
                            if (2818 <= code && code <= 2819) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (2876 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 2880) {
                            if (2878 <= code && code <= 2879) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2881) {
                              if (2880 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (2881 <= code && code <= 2884) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 2893) {
                          if (code < 2891) {
                            if (2887 <= code && code <= 2888) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (2891 <= code && code <= 2892) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 2901) {
                            if (2893 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 2914) {
                              if (2901 <= code && code <= 2903) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (2914 <= code && code <= 2915) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 3014) {
                        if (code < 3007) {
                          if (2946 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                          if (3006 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 3008) {
                            if (3007 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 3009) {
                              if (3008 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (3009 <= code && code <= 3010) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 3031) {
                          if (code < 3018) {
                            if (3014 <= code && code <= 3016) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 3021) {
                              if (3018 <= code && code <= 3020) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (3021 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 3072) {
                            if (3031 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3073) {
                              if (3072 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (3073 <= code && code <= 3075) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 3262) {
                      if (code < 3146) {
                        if (code < 3134) {
                          if (3076 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                          if (3132 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 3137) {
                            if (3134 <= code && code <= 3136) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3142) {
                              if (3137 <= code && code <= 3140) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (3142 <= code && code <= 3144) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 3201) {
                          if (code < 3157) {
                            if (3146 <= code && code <= 3149) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3170) {
                              if (3157 <= code && code <= 3158) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (3170 <= code && code <= 3171) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 3202) {
                            if (3201 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3260) {
                              if (3202 <= code && code <= 3203) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (3260 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 3270) {
                        if (code < 3264) {
                          if (3262 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                          if (3263 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 3266) {
                            if (3264 <= code && code <= 3265) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 3267) {
                              if (3266 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (3267 <= code && code <= 3268) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 3276) {
                          if (code < 3271) {
                            if (3270 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3274) {
                              if (3271 <= code && code <= 3272) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (3274 <= code && code <= 3275) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        } else {
                          if (code < 3285) {
                            if (3276 <= code && code <= 3277) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3298) {
                              if (3285 <= code && code <= 3286) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (3298 <= code && code <= 3299) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 3551) {
                    if (code < 3406) {
                      if (code < 3391) {
                        if (code < 3330) {
                          if (code < 3328) {
                            if (3315 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (3328 <= code && code <= 3329) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 3387) {
                            if (3330 <= code && code <= 3331) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 3390) {
                              if (3387 <= code && code <= 3388) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (3390 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 3398) {
                          if (code < 3393) {
                            if (3391 <= code && code <= 3392) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (3393 <= code && code <= 3396) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 3402) {
                            if (3398 <= code && code <= 3400) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 3405) {
                              if (3402 <= code && code <= 3404) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (3405 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 3530) {
                        if (code < 3426) {
                          if (3406 === code) {
                            return boundaries_1.CLUSTER_BREAK.PREPEND;
                          }
                          if (3415 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 3457) {
                            if (3426 <= code && code <= 3427) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3458) {
                              if (3457 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (3458 <= code && code <= 3459) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 3538) {
                          if (code < 3535) {
                            if (3530 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3536) {
                              if (3535 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (3536 <= code && code <= 3537) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        } else {
                          if (code < 3542) {
                            if (3538 <= code && code <= 3540) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3544) {
                              if (3542 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (3544 <= code && code <= 3550) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 3893) {
                      if (code < 3655) {
                        if (code < 3633) {
                          if (code < 3570) {
                            if (3551 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (3570 <= code && code <= 3571) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 3635) {
                            if (3633 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3636) {
                              if (3635 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (3636 <= code && code <= 3642) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 3764) {
                          if (code < 3761) {
                            if (3655 <= code && code <= 3662) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (3761 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (3763 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 3784) {
                            if (3764 <= code && code <= 3772) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3864) {
                              if (3784 <= code && code <= 3790) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (3864 <= code && code <= 3865) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 3967) {
                        if (code < 3897) {
                          if (3893 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                          if (3895 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 3902) {
                            if (3897 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 3953) {
                              if (3902 <= code && code <= 3903) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (3953 <= code && code <= 3966) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 3981) {
                          if (code < 3968) {
                            if (3967 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 3974) {
                              if (3968 <= code && code <= 3972) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (3974 <= code && code <= 3975) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 3993) {
                            if (3981 <= code && code <= 3991) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 4038) {
                              if (3993 <= code && code <= 4028) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (4038 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 7204) {
                if (code < 6448) {
                  if (code < 5938) {
                    if (code < 4226) {
                      if (code < 4157) {
                        if (code < 4146) {
                          if (code < 4145) {
                            if (4141 <= code && code <= 4144) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (4145 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 4153) {
                            if (4146 <= code && code <= 4151) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 4155) {
                              if (4153 <= code && code <= 4154) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (4155 <= code && code <= 4156) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 4184) {
                          if (code < 4182) {
                            if (4157 <= code && code <= 4158) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (4182 <= code && code <= 4183) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 4190) {
                            if (4184 <= code && code <= 4185) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 4209) {
                              if (4190 <= code && code <= 4192) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (4209 <= code && code <= 4212) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 4352) {
                        if (code < 4229) {
                          if (4226 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                          if (4228 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          if (code < 4237) {
                            if (4229 <= code && code <= 4230) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (4237 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (4253 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      } else {
                        if (code < 4957) {
                          if (code < 4448) {
                            if (4352 <= code && code <= 4447) {
                              return boundaries_1.CLUSTER_BREAK.L;
                            }
                          } else {
                            if (code < 4520) {
                              if (4448 <= code && code <= 4519) {
                                return boundaries_1.CLUSTER_BREAK.V;
                              }
                            } else {
                              if (4520 <= code && code <= 4607) {
                                return boundaries_1.CLUSTER_BREAK.T;
                              }
                            }
                          }
                        } else {
                          if (code < 5906) {
                            if (4957 <= code && code <= 4959) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 5909) {
                              if (5906 <= code && code <= 5908) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (5909 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 6089) {
                      if (code < 6070) {
                        if (code < 5970) {
                          if (code < 5940) {
                            if (5938 <= code && code <= 5939) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (5940 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 6002) {
                            if (5970 <= code && code <= 5971) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 6068) {
                              if (6002 <= code && code <= 6003) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (6068 <= code && code <= 6069) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 6078) {
                          if (code < 6071) {
                            if (6070 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (6071 <= code && code <= 6077) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 6086) {
                            if (6078 <= code && code <= 6085) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 6087) {
                              if (6086 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (6087 <= code && code <= 6088) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 6277) {
                        if (code < 6155) {
                          if (code < 6109) {
                            if (6089 <= code && code <= 6099) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (6109 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 6158) {
                            if (6155 <= code && code <= 6157) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (6158 === code) {
                              return boundaries_1.CLUSTER_BREAK.CONTROL;
                            }
                            if (6159 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      } else {
                        if (code < 6435) {
                          if (code < 6313) {
                            if (6277 <= code && code <= 6278) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 6432) {
                              if (6313 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (6432 <= code && code <= 6434) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 6439) {
                            if (6435 <= code && code <= 6438) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 6441) {
                              if (6439 <= code && code <= 6440) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (6441 <= code && code <= 6443) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 6971) {
                    if (code < 6744) {
                      if (code < 6681) {
                        if (code < 6451) {
                          if (code < 6450) {
                            if (6448 <= code && code <= 6449) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (6450 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 6457) {
                            if (6451 <= code && code <= 6456) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 6679) {
                              if (6457 <= code && code <= 6459) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (6679 <= code && code <= 6680) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 6741) {
                          if (code < 6683) {
                            if (6681 <= code && code <= 6682) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (6683 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 6742) {
                            if (6741 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (6742 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (6743 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 6771) {
                        if (code < 6754) {
                          if (code < 6752) {
                            if (6744 <= code && code <= 6750) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (6752 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 6757) {
                            if (6754 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 6765) {
                              if (6757 <= code && code <= 6764) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (6765 <= code && code <= 6770) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 6912) {
                          if (code < 6783) {
                            if (6771 <= code && code <= 6780) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 6832) {
                              if (6783 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (6832 <= code && code <= 6862) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 6916) {
                            if (6912 <= code && code <= 6915) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 6964) {
                              if (6916 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (6964 <= code && code <= 6970) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 7080) {
                      if (code < 7019) {
                        if (code < 6973) {
                          if (6971 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                          if (6972 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 6978) {
                            if (6973 <= code && code <= 6977) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 6979) {
                              if (6978 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (6979 <= code && code <= 6980) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 7073) {
                          if (code < 7040) {
                            if (7019 <= code && code <= 7027) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 7042) {
                              if (7040 <= code && code <= 7041) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (7042 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        } else {
                          if (code < 7074) {
                            if (7073 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 7078) {
                              if (7074 <= code && code <= 7077) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (7078 <= code && code <= 7079) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 7144) {
                        if (code < 7083) {
                          if (code < 7082) {
                            if (7080 <= code && code <= 7081) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (7082 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 7142) {
                            if (7083 <= code && code <= 7085) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (7142 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (7143 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        }
                      } else {
                        if (code < 7150) {
                          if (code < 7146) {
                            if (7144 <= code && code <= 7145) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 7149) {
                              if (7146 <= code && code <= 7148) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (7149 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 7151) {
                            if (7150 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 7154) {
                              if (7151 <= code && code <= 7153) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (7154 <= code && code <= 7155) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 43346) {
                  if (code < 11647) {
                    if (code < 7415) {
                      if (code < 7380) {
                        if (code < 7220) {
                          if (code < 7212) {
                            if (7204 <= code && code <= 7211) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (7212 <= code && code <= 7219) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 7222) {
                            if (7220 <= code && code <= 7221) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 7376) {
                              if (7222 <= code && code <= 7223) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (7376 <= code && code <= 7378) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 7394) {
                          if (code < 7393) {
                            if (7380 <= code && code <= 7392) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (7393 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 7405) {
                            if (7394 <= code && code <= 7400) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (7405 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (7412 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 8205) {
                        if (code < 7616) {
                          if (code < 7416) {
                            if (7415 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (7416 <= code && code <= 7417) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 8203) {
                            if (7616 <= code && code <= 7679) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (8203 === code) {
                              return boundaries_1.CLUSTER_BREAK.CONTROL;
                            }
                            if (8204 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      } else {
                        if (code < 8288) {
                          if (code < 8206) {
                            if (8205 === code) {
                              return boundaries_1.CLUSTER_BREAK.ZWJ;
                            }
                          } else {
                            if (code < 8232) {
                              if (8206 <= code && code <= 8207) {
                                return boundaries_1.CLUSTER_BREAK.CONTROL;
                              }
                            } else {
                              if (8232 <= code && code <= 8238) {
                                return boundaries_1.CLUSTER_BREAK.CONTROL;
                              }
                            }
                          }
                        } else {
                          if (code < 8400) {
                            if (8288 <= code && code <= 8303) {
                              return boundaries_1.CLUSTER_BREAK.CONTROL;
                            }
                          } else {
                            if (code < 11503) {
                              if (8400 <= code && code <= 8432) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (11503 <= code && code <= 11505) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 43043) {
                      if (code < 42612) {
                        if (code < 12330) {
                          if (code < 11744) {
                            if (11647 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (11744 <= code && code <= 11775) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 12441) {
                            if (12330 <= code && code <= 12335) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 42607) {
                              if (12441 <= code && code <= 12442) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (42607 <= code && code <= 42610) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 43010) {
                          if (code < 42654) {
                            if (42612 <= code && code <= 42621) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 42736) {
                              if (42654 <= code && code <= 42655) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (42736 <= code && code <= 42737) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 43014) {
                            if (43010 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (43014 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (43019 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 43188) {
                        if (code < 43047) {
                          if (code < 43045) {
                            if (43043 <= code && code <= 43044) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (43045 <= code && code <= 43046) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 43052) {
                            if (43047 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 43136) {
                              if (43052 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (43136 <= code && code <= 43137) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 43263) {
                          if (code < 43204) {
                            if (43188 <= code && code <= 43203) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 43232) {
                              if (43204 <= code && code <= 43205) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (43232 <= code && code <= 43249) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 43302) {
                            if (43263 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 43335) {
                              if (43302 <= code && code <= 43309) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (43335 <= code && code <= 43345) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 43698) {
                    if (code < 43493) {
                      if (code < 43444) {
                        if (code < 43392) {
                          if (code < 43360) {
                            if (43346 <= code && code <= 43347) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (43360 <= code && code <= 43388) {
                              return boundaries_1.CLUSTER_BREAK.L;
                            }
                          }
                        } else {
                          if (code < 43395) {
                            if (43392 <= code && code <= 43394) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (43395 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                            if (43443 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      } else {
                        if (code < 43450) {
                          if (code < 43446) {
                            if (43444 <= code && code <= 43445) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (43446 <= code && code <= 43449) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 43452) {
                            if (43450 <= code && code <= 43451) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 43454) {
                              if (43452 <= code && code <= 43453) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (43454 <= code && code <= 43456) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 43573) {
                        if (code < 43567) {
                          if (code < 43561) {
                            if (43493 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (43561 <= code && code <= 43566) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 43569) {
                            if (43567 <= code && code <= 43568) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 43571) {
                              if (43569 <= code && code <= 43570) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (43571 <= code && code <= 43572) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 43597) {
                          if (code < 43587) {
                            if (43573 <= code && code <= 43574) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (43587 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (43596 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 43644) {
                            if (43597 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (43644 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (43696 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 44006) {
                      if (code < 43756) {
                        if (code < 43710) {
                          if (code < 43703) {
                            if (43698 <= code && code <= 43700) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (43703 <= code && code <= 43704) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 43713) {
                            if (43710 <= code && code <= 43711) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (43713 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (43755 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        }
                      } else {
                        if (code < 43766) {
                          if (code < 43758) {
                            if (43756 <= code && code <= 43757) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 43765) {
                              if (43758 <= code && code <= 43759) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (43765 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        } else {
                          if (code < 44003) {
                            if (43766 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 44005) {
                              if (44003 <= code && code <= 44004) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (44005 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 44032) {
                        if (code < 44009) {
                          if (code < 44008) {
                            if (44006 <= code && code <= 44007) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (44008 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 44012) {
                            if (44009 <= code && code <= 44010) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (44012 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                            if (44013 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      } else {
                        if (code < 44061) {
                          if (code < 44033) {
                            if (44032 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 44060) {
                              if (44033 <= code && code <= 44059) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (44060 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 44088) {
                            if (44061 <= code && code <= 44087) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 44089) {
                              if (44088 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (44089 <= code && code <= 44115) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 46497) {
              if (code < 45293) {
                if (code < 44704) {
                  if (code < 44397) {
                    if (code < 44256) {
                      if (code < 44173) {
                        if (code < 44144) {
                          if (code < 44117) {
                            if (44116 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (44117 <= code && code <= 44143) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 44145) {
                            if (44144 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 44172) {
                              if (44145 <= code && code <= 44171) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (44172 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 44201) {
                          if (code < 44200) {
                            if (44173 <= code && code <= 44199) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (44200 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 44228) {
                            if (44201 <= code && code <= 44227) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 44229) {
                              if (44228 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (44229 <= code && code <= 44255) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 44313) {
                        if (code < 44284) {
                          if (code < 44257) {
                            if (44256 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (44257 <= code && code <= 44283) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 44285) {
                            if (44284 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 44312) {
                              if (44285 <= code && code <= 44311) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (44312 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 44368) {
                          if (code < 44340) {
                            if (44313 <= code && code <= 44339) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 44341) {
                              if (44340 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (44341 <= code && code <= 44367) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 44369) {
                            if (44368 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 44396) {
                              if (44369 <= code && code <= 44395) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (44396 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 44537) {
                      if (code < 44480) {
                        if (code < 44425) {
                          if (code < 44424) {
                            if (44397 <= code && code <= 44423) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (44424 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 44452) {
                            if (44425 <= code && code <= 44451) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 44453) {
                              if (44452 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (44453 <= code && code <= 44479) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 44508) {
                          if (code < 44481) {
                            if (44480 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (44481 <= code && code <= 44507) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 44509) {
                            if (44508 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 44536) {
                              if (44509 <= code && code <= 44535) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (44536 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 44620) {
                        if (code < 44565) {
                          if (code < 44564) {
                            if (44537 <= code && code <= 44563) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (44564 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 44592) {
                            if (44565 <= code && code <= 44591) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 44593) {
                              if (44592 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (44593 <= code && code <= 44619) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 44649) {
                          if (code < 44621) {
                            if (44620 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 44648) {
                              if (44621 <= code && code <= 44647) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (44648 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 44676) {
                            if (44649 <= code && code <= 44675) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 44677) {
                              if (44676 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (44677 <= code && code <= 44703) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 44985) {
                    if (code < 44844) {
                      if (code < 44761) {
                        if (code < 44732) {
                          if (code < 44705) {
                            if (44704 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (44705 <= code && code <= 44731) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 44733) {
                            if (44732 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 44760) {
                              if (44733 <= code && code <= 44759) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (44760 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 44789) {
                          if (code < 44788) {
                            if (44761 <= code && code <= 44787) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (44788 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 44816) {
                            if (44789 <= code && code <= 44815) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 44817) {
                              if (44816 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (44817 <= code && code <= 44843) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 44901) {
                        if (code < 44872) {
                          if (code < 44845) {
                            if (44844 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (44845 <= code && code <= 44871) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 44873) {
                            if (44872 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 44900) {
                              if (44873 <= code && code <= 44899) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (44900 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 44956) {
                          if (code < 44928) {
                            if (44901 <= code && code <= 44927) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 44929) {
                              if (44928 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (44929 <= code && code <= 44955) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 44957) {
                            if (44956 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 44984) {
                              if (44957 <= code && code <= 44983) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (44984 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 45152) {
                      if (code < 45068) {
                        if (code < 45013) {
                          if (code < 45012) {
                            if (44985 <= code && code <= 45011) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (45012 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 45040) {
                            if (45013 <= code && code <= 45039) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 45041) {
                              if (45040 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (45041 <= code && code <= 45067) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 45097) {
                          if (code < 45069) {
                            if (45068 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 45096) {
                              if (45069 <= code && code <= 45095) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (45096 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 45124) {
                            if (45097 <= code && code <= 45123) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 45125) {
                              if (45124 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (45125 <= code && code <= 45151) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 45209) {
                        if (code < 45180) {
                          if (code < 45153) {
                            if (45152 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (45153 <= code && code <= 45179) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 45181) {
                            if (45180 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 45208) {
                              if (45181 <= code && code <= 45207) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (45208 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 45264) {
                          if (code < 45236) {
                            if (45209 <= code && code <= 45235) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 45237) {
                              if (45236 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (45237 <= code && code <= 45263) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 45265) {
                            if (45264 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 45292) {
                              if (45265 <= code && code <= 45291) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (45292 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 45908) {
                  if (code < 45600) {
                    if (code < 45433) {
                      if (code < 45376) {
                        if (code < 45321) {
                          if (code < 45320) {
                            if (45293 <= code && code <= 45319) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (45320 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 45348) {
                            if (45321 <= code && code <= 45347) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 45349) {
                              if (45348 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (45349 <= code && code <= 45375) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 45404) {
                          if (code < 45377) {
                            if (45376 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (45377 <= code && code <= 45403) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 45405) {
                            if (45404 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 45432) {
                              if (45405 <= code && code <= 45431) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (45432 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 45516) {
                        if (code < 45461) {
                          if (code < 45460) {
                            if (45433 <= code && code <= 45459) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (45460 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 45488) {
                            if (45461 <= code && code <= 45487) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 45489) {
                              if (45488 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (45489 <= code && code <= 45515) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 45545) {
                          if (code < 45517) {
                            if (45516 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 45544) {
                              if (45517 <= code && code <= 45543) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (45544 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 45572) {
                            if (45545 <= code && code <= 45571) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 45573) {
                              if (45572 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (45573 <= code && code <= 45599) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 45741) {
                      if (code < 45657) {
                        if (code < 45628) {
                          if (code < 45601) {
                            if (45600 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (45601 <= code && code <= 45627) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 45629) {
                            if (45628 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 45656) {
                              if (45629 <= code && code <= 45655) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (45656 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 45712) {
                          if (code < 45684) {
                            if (45657 <= code && code <= 45683) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 45685) {
                              if (45684 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (45685 <= code && code <= 45711) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 45713) {
                            if (45712 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 45740) {
                              if (45713 <= code && code <= 45739) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (45740 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 45824) {
                        if (code < 45769) {
                          if (code < 45768) {
                            if (45741 <= code && code <= 45767) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (45768 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 45796) {
                            if (45769 <= code && code <= 45795) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 45797) {
                              if (45796 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (45797 <= code && code <= 45823) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 45853) {
                          if (code < 45825) {
                            if (45824 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 45852) {
                              if (45825 <= code && code <= 45851) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (45852 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 45880) {
                            if (45853 <= code && code <= 45879) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 45881) {
                              if (45880 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (45881 <= code && code <= 45907) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 46189) {
                    if (code < 46048) {
                      if (code < 45965) {
                        if (code < 45936) {
                          if (code < 45909) {
                            if (45908 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (45909 <= code && code <= 45935) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 45937) {
                            if (45936 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 45964) {
                              if (45937 <= code && code <= 45963) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (45964 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 45993) {
                          if (code < 45992) {
                            if (45965 <= code && code <= 45991) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (45992 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 46020) {
                            if (45993 <= code && code <= 46019) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 46021) {
                              if (46020 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (46021 <= code && code <= 46047) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 46105) {
                        if (code < 46076) {
                          if (code < 46049) {
                            if (46048 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (46049 <= code && code <= 46075) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 46077) {
                            if (46076 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 46104) {
                              if (46077 <= code && code <= 46103) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (46104 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 46160) {
                          if (code < 46132) {
                            if (46105 <= code && code <= 46131) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 46133) {
                              if (46132 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (46133 <= code && code <= 46159) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 46161) {
                            if (46160 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 46188) {
                              if (46161 <= code && code <= 46187) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (46188 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 46356) {
                      if (code < 46272) {
                        if (code < 46217) {
                          if (code < 46216) {
                            if (46189 <= code && code <= 46215) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (46216 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 46244) {
                            if (46217 <= code && code <= 46243) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 46245) {
                              if (46244 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (46245 <= code && code <= 46271) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 46301) {
                          if (code < 46273) {
                            if (46272 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 46300) {
                              if (46273 <= code && code <= 46299) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (46300 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 46328) {
                            if (46301 <= code && code <= 46327) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 46329) {
                              if (46328 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (46329 <= code && code <= 46355) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 46413) {
                        if (code < 46384) {
                          if (code < 46357) {
                            if (46356 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (46357 <= code && code <= 46383) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 46385) {
                            if (46384 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 46412) {
                              if (46385 <= code && code <= 46411) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (46412 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 46468) {
                          if (code < 46440) {
                            if (46413 <= code && code <= 46439) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 46441) {
                              if (46440 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (46441 <= code && code <= 46467) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 46469) {
                            if (46468 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 46496) {
                              if (46469 <= code && code <= 46495) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (46496 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 47701) {
                if (code < 47112) {
                  if (code < 46804) {
                    if (code < 46637) {
                      if (code < 46580) {
                        if (code < 46525) {
                          if (code < 46524) {
                            if (46497 <= code && code <= 46523) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (46524 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 46552) {
                            if (46525 <= code && code <= 46551) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 46553) {
                              if (46552 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (46553 <= code && code <= 46579) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 46608) {
                          if (code < 46581) {
                            if (46580 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (46581 <= code && code <= 46607) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 46609) {
                            if (46608 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 46636) {
                              if (46609 <= code && code <= 46635) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (46636 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 46720) {
                        if (code < 46665) {
                          if (code < 46664) {
                            if (46637 <= code && code <= 46663) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (46664 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 46692) {
                            if (46665 <= code && code <= 46691) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 46693) {
                              if (46692 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (46693 <= code && code <= 46719) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 46749) {
                          if (code < 46721) {
                            if (46720 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 46748) {
                              if (46721 <= code && code <= 46747) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (46748 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 46776) {
                            if (46749 <= code && code <= 46775) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 46777) {
                              if (46776 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (46777 <= code && code <= 46803) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 46945) {
                      if (code < 46861) {
                        if (code < 46832) {
                          if (code < 46805) {
                            if (46804 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (46805 <= code && code <= 46831) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 46833) {
                            if (46832 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 46860) {
                              if (46833 <= code && code <= 46859) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (46860 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 46916) {
                          if (code < 46888) {
                            if (46861 <= code && code <= 46887) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 46889) {
                              if (46888 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (46889 <= code && code <= 46915) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 46917) {
                            if (46916 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 46944) {
                              if (46917 <= code && code <= 46943) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (46944 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 47028) {
                        if (code < 46973) {
                          if (code < 46972) {
                            if (46945 <= code && code <= 46971) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (46972 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 47e3) {
                            if (46973 <= code && code <= 46999) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 47001) {
                              if (47e3 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (47001 <= code && code <= 47027) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 47057) {
                          if (code < 47029) {
                            if (47028 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 47056) {
                              if (47029 <= code && code <= 47055) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (47056 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 47084) {
                            if (47057 <= code && code <= 47083) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 47085) {
                              if (47084 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (47085 <= code && code <= 47111) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 47393) {
                    if (code < 47252) {
                      if (code < 47169) {
                        if (code < 47140) {
                          if (code < 47113) {
                            if (47112 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (47113 <= code && code <= 47139) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 47141) {
                            if (47140 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 47168) {
                              if (47141 <= code && code <= 47167) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (47168 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 47197) {
                          if (code < 47196) {
                            if (47169 <= code && code <= 47195) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (47196 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 47224) {
                            if (47197 <= code && code <= 47223) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 47225) {
                              if (47224 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (47225 <= code && code <= 47251) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 47309) {
                        if (code < 47280) {
                          if (code < 47253) {
                            if (47252 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (47253 <= code && code <= 47279) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 47281) {
                            if (47280 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 47308) {
                              if (47281 <= code && code <= 47307) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (47308 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 47364) {
                          if (code < 47336) {
                            if (47309 <= code && code <= 47335) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 47337) {
                              if (47336 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (47337 <= code && code <= 47363) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 47365) {
                            if (47364 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 47392) {
                              if (47365 <= code && code <= 47391) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (47392 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 47560) {
                      if (code < 47476) {
                        if (code < 47421) {
                          if (code < 47420) {
                            if (47393 <= code && code <= 47419) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (47420 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 47448) {
                            if (47421 <= code && code <= 47447) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 47449) {
                              if (47448 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (47449 <= code && code <= 47475) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 47505) {
                          if (code < 47477) {
                            if (47476 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 47504) {
                              if (47477 <= code && code <= 47503) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (47504 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 47532) {
                            if (47505 <= code && code <= 47531) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 47533) {
                              if (47532 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (47533 <= code && code <= 47559) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 47617) {
                        if (code < 47588) {
                          if (code < 47561) {
                            if (47560 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (47561 <= code && code <= 47587) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 47589) {
                            if (47588 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 47616) {
                              if (47589 <= code && code <= 47615) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (47616 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 47672) {
                          if (code < 47644) {
                            if (47617 <= code && code <= 47643) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 47645) {
                              if (47644 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (47645 <= code && code <= 47671) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 47673) {
                            if (47672 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 47700) {
                              if (47673 <= code && code <= 47699) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (47700 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 48316) {
                  if (code < 48008) {
                    if (code < 47841) {
                      if (code < 47784) {
                        if (code < 47729) {
                          if (code < 47728) {
                            if (47701 <= code && code <= 47727) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (47728 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 47756) {
                            if (47729 <= code && code <= 47755) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 47757) {
                              if (47756 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (47757 <= code && code <= 47783) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 47812) {
                          if (code < 47785) {
                            if (47784 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (47785 <= code && code <= 47811) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 47813) {
                            if (47812 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 47840) {
                              if (47813 <= code && code <= 47839) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (47840 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 47924) {
                        if (code < 47869) {
                          if (code < 47868) {
                            if (47841 <= code && code <= 47867) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (47868 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 47896) {
                            if (47869 <= code && code <= 47895) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 47897) {
                              if (47896 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (47897 <= code && code <= 47923) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 47953) {
                          if (code < 47925) {
                            if (47924 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 47952) {
                              if (47925 <= code && code <= 47951) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (47952 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 47980) {
                            if (47953 <= code && code <= 47979) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 47981) {
                              if (47980 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (47981 <= code && code <= 48007) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 48149) {
                      if (code < 48065) {
                        if (code < 48036) {
                          if (code < 48009) {
                            if (48008 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (48009 <= code && code <= 48035) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 48037) {
                            if (48036 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 48064) {
                              if (48037 <= code && code <= 48063) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (48064 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 48120) {
                          if (code < 48092) {
                            if (48065 <= code && code <= 48091) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 48093) {
                              if (48092 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (48093 <= code && code <= 48119) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 48121) {
                            if (48120 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 48148) {
                              if (48121 <= code && code <= 48147) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (48148 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 48232) {
                        if (code < 48177) {
                          if (code < 48176) {
                            if (48149 <= code && code <= 48175) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (48176 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 48204) {
                            if (48177 <= code && code <= 48203) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 48205) {
                              if (48204 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (48205 <= code && code <= 48231) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 48261) {
                          if (code < 48233) {
                            if (48232 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 48260) {
                              if (48233 <= code && code <= 48259) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (48260 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 48288) {
                            if (48261 <= code && code <= 48287) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 48289) {
                              if (48288 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (48289 <= code && code <= 48315) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 48597) {
                    if (code < 48456) {
                      if (code < 48373) {
                        if (code < 48344) {
                          if (code < 48317) {
                            if (48316 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (48317 <= code && code <= 48343) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 48345) {
                            if (48344 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 48372) {
                              if (48345 <= code && code <= 48371) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (48372 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 48401) {
                          if (code < 48400) {
                            if (48373 <= code && code <= 48399) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (48400 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 48428) {
                            if (48401 <= code && code <= 48427) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 48429) {
                              if (48428 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (48429 <= code && code <= 48455) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 48513) {
                        if (code < 48484) {
                          if (code < 48457) {
                            if (48456 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (48457 <= code && code <= 48483) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 48485) {
                            if (48484 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 48512) {
                              if (48485 <= code && code <= 48511) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (48512 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 48568) {
                          if (code < 48540) {
                            if (48513 <= code && code <= 48539) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 48541) {
                              if (48540 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (48541 <= code && code <= 48567) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 48569) {
                            if (48568 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 48596) {
                              if (48569 <= code && code <= 48595) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (48596 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 48764) {
                      if (code < 48680) {
                        if (code < 48625) {
                          if (code < 48624) {
                            if (48597 <= code && code <= 48623) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (48624 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 48652) {
                            if (48625 <= code && code <= 48651) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 48653) {
                              if (48652 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (48653 <= code && code <= 48679) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 48709) {
                          if (code < 48681) {
                            if (48680 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 48708) {
                              if (48681 <= code && code <= 48707) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (48708 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 48736) {
                            if (48709 <= code && code <= 48735) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 48737) {
                              if (48736 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (48737 <= code && code <= 48763) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 48821) {
                        if (code < 48792) {
                          if (code < 48765) {
                            if (48764 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (48765 <= code && code <= 48791) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 48793) {
                            if (48792 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 48820) {
                              if (48793 <= code && code <= 48819) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (48820 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 48876) {
                          if (code < 48848) {
                            if (48821 <= code && code <= 48847) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 48849) {
                              if (48848 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (48849 <= code && code <= 48875) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 48877) {
                            if (48876 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 48904) {
                              if (48877 <= code && code <= 48903) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (48904 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          if (code < 53720) {
            if (code < 51312) {
              if (code < 50108) {
                if (code < 49493) {
                  if (code < 49212) {
                    if (code < 49045) {
                      if (code < 48988) {
                        if (code < 48933) {
                          if (code < 48932) {
                            if (48905 <= code && code <= 48931) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (48932 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 48960) {
                            if (48933 <= code && code <= 48959) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 48961) {
                              if (48960 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (48961 <= code && code <= 48987) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 49016) {
                          if (code < 48989) {
                            if (48988 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (48989 <= code && code <= 49015) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 49017) {
                            if (49016 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 49044) {
                              if (49017 <= code && code <= 49043) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (49044 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 49128) {
                        if (code < 49073) {
                          if (code < 49072) {
                            if (49045 <= code && code <= 49071) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (49072 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 49100) {
                            if (49073 <= code && code <= 49099) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 49101) {
                              if (49100 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (49101 <= code && code <= 49127) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 49157) {
                          if (code < 49129) {
                            if (49128 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 49156) {
                              if (49129 <= code && code <= 49155) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (49156 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 49184) {
                            if (49157 <= code && code <= 49183) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 49185) {
                              if (49184 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (49185 <= code && code <= 49211) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 49352) {
                      if (code < 49269) {
                        if (code < 49240) {
                          if (code < 49213) {
                            if (49212 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (49213 <= code && code <= 49239) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 49241) {
                            if (49240 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 49268) {
                              if (49241 <= code && code <= 49267) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (49268 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 49297) {
                          if (code < 49296) {
                            if (49269 <= code && code <= 49295) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (49296 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 49324) {
                            if (49297 <= code && code <= 49323) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 49325) {
                              if (49324 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (49325 <= code && code <= 49351) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 49409) {
                        if (code < 49380) {
                          if (code < 49353) {
                            if (49352 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (49353 <= code && code <= 49379) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 49381) {
                            if (49380 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 49408) {
                              if (49381 <= code && code <= 49407) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (49408 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 49464) {
                          if (code < 49436) {
                            if (49409 <= code && code <= 49435) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 49437) {
                              if (49436 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (49437 <= code && code <= 49463) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 49465) {
                            if (49464 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 49492) {
                              if (49465 <= code && code <= 49491) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (49492 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 49800) {
                    if (code < 49633) {
                      if (code < 49576) {
                        if (code < 49521) {
                          if (code < 49520) {
                            if (49493 <= code && code <= 49519) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (49520 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 49548) {
                            if (49521 <= code && code <= 49547) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 49549) {
                              if (49548 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (49549 <= code && code <= 49575) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 49604) {
                          if (code < 49577) {
                            if (49576 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (49577 <= code && code <= 49603) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 49605) {
                            if (49604 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 49632) {
                              if (49605 <= code && code <= 49631) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (49632 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 49716) {
                        if (code < 49661) {
                          if (code < 49660) {
                            if (49633 <= code && code <= 49659) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (49660 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 49688) {
                            if (49661 <= code && code <= 49687) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 49689) {
                              if (49688 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (49689 <= code && code <= 49715) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 49745) {
                          if (code < 49717) {
                            if (49716 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 49744) {
                              if (49717 <= code && code <= 49743) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (49744 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 49772) {
                            if (49745 <= code && code <= 49771) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 49773) {
                              if (49772 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (49773 <= code && code <= 49799) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 49941) {
                      if (code < 49857) {
                        if (code < 49828) {
                          if (code < 49801) {
                            if (49800 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (49801 <= code && code <= 49827) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 49829) {
                            if (49828 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 49856) {
                              if (49829 <= code && code <= 49855) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (49856 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 49912) {
                          if (code < 49884) {
                            if (49857 <= code && code <= 49883) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 49885) {
                              if (49884 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (49885 <= code && code <= 49911) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 49913) {
                            if (49912 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 49940) {
                              if (49913 <= code && code <= 49939) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (49940 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 50024) {
                        if (code < 49969) {
                          if (code < 49968) {
                            if (49941 <= code && code <= 49967) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (49968 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 49996) {
                            if (49969 <= code && code <= 49995) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 49997) {
                              if (49996 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (49997 <= code && code <= 50023) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 50053) {
                          if (code < 50025) {
                            if (50024 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 50052) {
                              if (50025 <= code && code <= 50051) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (50052 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 50080) {
                            if (50053 <= code && code <= 50079) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 50081) {
                              if (50080 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (50081 <= code && code <= 50107) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 50697) {
                  if (code < 50389) {
                    if (code < 50248) {
                      if (code < 50165) {
                        if (code < 50136) {
                          if (code < 50109) {
                            if (50108 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (50109 <= code && code <= 50135) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 50137) {
                            if (50136 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 50164) {
                              if (50137 <= code && code <= 50163) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (50164 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 50193) {
                          if (code < 50192) {
                            if (50165 <= code && code <= 50191) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (50192 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 50220) {
                            if (50193 <= code && code <= 50219) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 50221) {
                              if (50220 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (50221 <= code && code <= 50247) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 50305) {
                        if (code < 50276) {
                          if (code < 50249) {
                            if (50248 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (50249 <= code && code <= 50275) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 50277) {
                            if (50276 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 50304) {
                              if (50277 <= code && code <= 50303) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (50304 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 50360) {
                          if (code < 50332) {
                            if (50305 <= code && code <= 50331) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 50333) {
                              if (50332 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (50333 <= code && code <= 50359) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 50361) {
                            if (50360 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 50388) {
                              if (50361 <= code && code <= 50387) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (50388 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 50556) {
                      if (code < 50472) {
                        if (code < 50417) {
                          if (code < 50416) {
                            if (50389 <= code && code <= 50415) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (50416 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 50444) {
                            if (50417 <= code && code <= 50443) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 50445) {
                              if (50444 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (50445 <= code && code <= 50471) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 50501) {
                          if (code < 50473) {
                            if (50472 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 50500) {
                              if (50473 <= code && code <= 50499) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (50500 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 50528) {
                            if (50501 <= code && code <= 50527) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 50529) {
                              if (50528 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (50529 <= code && code <= 50555) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 50613) {
                        if (code < 50584) {
                          if (code < 50557) {
                            if (50556 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (50557 <= code && code <= 50583) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 50585) {
                            if (50584 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 50612) {
                              if (50585 <= code && code <= 50611) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (50612 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 50668) {
                          if (code < 50640) {
                            if (50613 <= code && code <= 50639) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 50641) {
                              if (50640 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (50641 <= code && code <= 50667) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 50669) {
                            if (50668 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 50696) {
                              if (50669 <= code && code <= 50695) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (50696 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 51004) {
                    if (code < 50837) {
                      if (code < 50780) {
                        if (code < 50725) {
                          if (code < 50724) {
                            if (50697 <= code && code <= 50723) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (50724 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 50752) {
                            if (50725 <= code && code <= 50751) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 50753) {
                              if (50752 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (50753 <= code && code <= 50779) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 50808) {
                          if (code < 50781) {
                            if (50780 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (50781 <= code && code <= 50807) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 50809) {
                            if (50808 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 50836) {
                              if (50809 <= code && code <= 50835) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (50836 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 50920) {
                        if (code < 50865) {
                          if (code < 50864) {
                            if (50837 <= code && code <= 50863) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (50864 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 50892) {
                            if (50865 <= code && code <= 50891) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 50893) {
                              if (50892 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (50893 <= code && code <= 50919) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 50949) {
                          if (code < 50921) {
                            if (50920 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 50948) {
                              if (50921 <= code && code <= 50947) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (50948 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 50976) {
                            if (50949 <= code && code <= 50975) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 50977) {
                              if (50976 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (50977 <= code && code <= 51003) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 51145) {
                      if (code < 51061) {
                        if (code < 51032) {
                          if (code < 51005) {
                            if (51004 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (51005 <= code && code <= 51031) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 51033) {
                            if (51032 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 51060) {
                              if (51033 <= code && code <= 51059) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (51060 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 51116) {
                          if (code < 51088) {
                            if (51061 <= code && code <= 51087) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 51089) {
                              if (51088 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (51089 <= code && code <= 51115) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 51117) {
                            if (51116 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 51144) {
                              if (51117 <= code && code <= 51143) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (51144 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 51228) {
                        if (code < 51173) {
                          if (code < 51172) {
                            if (51145 <= code && code <= 51171) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (51172 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 51200) {
                            if (51173 <= code && code <= 51199) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 51201) {
                              if (51200 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (51201 <= code && code <= 51227) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 51257) {
                          if (code < 51229) {
                            if (51228 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 51256) {
                              if (51229 <= code && code <= 51255) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (51256 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 51284) {
                            if (51257 <= code && code <= 51283) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 51285) {
                              if (51284 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (51285 <= code && code <= 51311) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 52516) {
                if (code < 51901) {
                  if (code < 51593) {
                    if (code < 51452) {
                      if (code < 51369) {
                        if (code < 51340) {
                          if (code < 51313) {
                            if (51312 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (51313 <= code && code <= 51339) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 51341) {
                            if (51340 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 51368) {
                              if (51341 <= code && code <= 51367) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (51368 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 51397) {
                          if (code < 51396) {
                            if (51369 <= code && code <= 51395) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (51396 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 51424) {
                            if (51397 <= code && code <= 51423) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 51425) {
                              if (51424 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (51425 <= code && code <= 51451) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 51509) {
                        if (code < 51480) {
                          if (code < 51453) {
                            if (51452 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (51453 <= code && code <= 51479) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 51481) {
                            if (51480 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 51508) {
                              if (51481 <= code && code <= 51507) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (51508 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 51564) {
                          if (code < 51536) {
                            if (51509 <= code && code <= 51535) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 51537) {
                              if (51536 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (51537 <= code && code <= 51563) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 51565) {
                            if (51564 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 51592) {
                              if (51565 <= code && code <= 51591) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (51592 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 51760) {
                      if (code < 51676) {
                        if (code < 51621) {
                          if (code < 51620) {
                            if (51593 <= code && code <= 51619) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (51620 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 51648) {
                            if (51621 <= code && code <= 51647) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 51649) {
                              if (51648 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (51649 <= code && code <= 51675) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 51705) {
                          if (code < 51677) {
                            if (51676 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 51704) {
                              if (51677 <= code && code <= 51703) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (51704 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 51732) {
                            if (51705 <= code && code <= 51731) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 51733) {
                              if (51732 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (51733 <= code && code <= 51759) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 51817) {
                        if (code < 51788) {
                          if (code < 51761) {
                            if (51760 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (51761 <= code && code <= 51787) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 51789) {
                            if (51788 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 51816) {
                              if (51789 <= code && code <= 51815) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (51816 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 51872) {
                          if (code < 51844) {
                            if (51817 <= code && code <= 51843) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 51845) {
                              if (51844 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (51845 <= code && code <= 51871) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 51873) {
                            if (51872 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 51900) {
                              if (51873 <= code && code <= 51899) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (51900 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 52208) {
                    if (code < 52041) {
                      if (code < 51984) {
                        if (code < 51929) {
                          if (code < 51928) {
                            if (51901 <= code && code <= 51927) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (51928 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 51956) {
                            if (51929 <= code && code <= 51955) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 51957) {
                              if (51956 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (51957 <= code && code <= 51983) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 52012) {
                          if (code < 51985) {
                            if (51984 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (51985 <= code && code <= 52011) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 52013) {
                            if (52012 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 52040) {
                              if (52013 <= code && code <= 52039) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (52040 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 52124) {
                        if (code < 52069) {
                          if (code < 52068) {
                            if (52041 <= code && code <= 52067) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (52068 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 52096) {
                            if (52069 <= code && code <= 52095) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 52097) {
                              if (52096 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (52097 <= code && code <= 52123) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 52153) {
                          if (code < 52125) {
                            if (52124 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 52152) {
                              if (52125 <= code && code <= 52151) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (52152 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 52180) {
                            if (52153 <= code && code <= 52179) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 52181) {
                              if (52180 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (52181 <= code && code <= 52207) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 52349) {
                      if (code < 52265) {
                        if (code < 52236) {
                          if (code < 52209) {
                            if (52208 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (52209 <= code && code <= 52235) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 52237) {
                            if (52236 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 52264) {
                              if (52237 <= code && code <= 52263) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (52264 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 52320) {
                          if (code < 52292) {
                            if (52265 <= code && code <= 52291) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 52293) {
                              if (52292 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (52293 <= code && code <= 52319) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 52321) {
                            if (52320 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 52348) {
                              if (52321 <= code && code <= 52347) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (52348 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 52432) {
                        if (code < 52377) {
                          if (code < 52376) {
                            if (52349 <= code && code <= 52375) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (52376 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 52404) {
                            if (52377 <= code && code <= 52403) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 52405) {
                              if (52404 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (52405 <= code && code <= 52431) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 52461) {
                          if (code < 52433) {
                            if (52432 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 52460) {
                              if (52433 <= code && code <= 52459) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (52460 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 52488) {
                            if (52461 <= code && code <= 52487) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 52489) {
                              if (52488 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (52489 <= code && code <= 52515) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 53105) {
                  if (code < 52797) {
                    if (code < 52656) {
                      if (code < 52573) {
                        if (code < 52544) {
                          if (code < 52517) {
                            if (52516 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (52517 <= code && code <= 52543) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 52545) {
                            if (52544 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 52572) {
                              if (52545 <= code && code <= 52571) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (52572 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 52601) {
                          if (code < 52600) {
                            if (52573 <= code && code <= 52599) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (52600 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 52628) {
                            if (52601 <= code && code <= 52627) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 52629) {
                              if (52628 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (52629 <= code && code <= 52655) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 52713) {
                        if (code < 52684) {
                          if (code < 52657) {
                            if (52656 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (52657 <= code && code <= 52683) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 52685) {
                            if (52684 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 52712) {
                              if (52685 <= code && code <= 52711) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (52712 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 52768) {
                          if (code < 52740) {
                            if (52713 <= code && code <= 52739) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 52741) {
                              if (52740 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (52741 <= code && code <= 52767) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 52769) {
                            if (52768 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 52796) {
                              if (52769 <= code && code <= 52795) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (52796 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 52964) {
                      if (code < 52880) {
                        if (code < 52825) {
                          if (code < 52824) {
                            if (52797 <= code && code <= 52823) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (52824 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 52852) {
                            if (52825 <= code && code <= 52851) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 52853) {
                              if (52852 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (52853 <= code && code <= 52879) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 52909) {
                          if (code < 52881) {
                            if (52880 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 52908) {
                              if (52881 <= code && code <= 52907) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (52908 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 52936) {
                            if (52909 <= code && code <= 52935) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 52937) {
                              if (52936 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (52937 <= code && code <= 52963) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 53021) {
                        if (code < 52992) {
                          if (code < 52965) {
                            if (52964 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (52965 <= code && code <= 52991) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 52993) {
                            if (52992 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 53020) {
                              if (52993 <= code && code <= 53019) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (53020 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 53076) {
                          if (code < 53048) {
                            if (53021 <= code && code <= 53047) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 53049) {
                              if (53048 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (53049 <= code && code <= 53075) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 53077) {
                            if (53076 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 53104) {
                              if (53077 <= code && code <= 53103) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (53104 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 53412) {
                    if (code < 53245) {
                      if (code < 53188) {
                        if (code < 53133) {
                          if (code < 53132) {
                            if (53105 <= code && code <= 53131) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (53132 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 53160) {
                            if (53133 <= code && code <= 53159) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 53161) {
                              if (53160 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (53161 <= code && code <= 53187) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 53216) {
                          if (code < 53189) {
                            if (53188 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (53189 <= code && code <= 53215) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 53217) {
                            if (53216 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 53244) {
                              if (53217 <= code && code <= 53243) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (53244 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 53328) {
                        if (code < 53273) {
                          if (code < 53272) {
                            if (53245 <= code && code <= 53271) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (53272 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 53300) {
                            if (53273 <= code && code <= 53299) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 53301) {
                              if (53300 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (53301 <= code && code <= 53327) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 53357) {
                          if (code < 53329) {
                            if (53328 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 53356) {
                              if (53329 <= code && code <= 53355) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (53356 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 53384) {
                            if (53357 <= code && code <= 53383) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 53385) {
                              if (53384 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (53385 <= code && code <= 53411) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 53553) {
                      if (code < 53469) {
                        if (code < 53440) {
                          if (code < 53413) {
                            if (53412 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (53413 <= code && code <= 53439) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 53441) {
                            if (53440 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 53468) {
                              if (53441 <= code && code <= 53467) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (53468 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 53524) {
                          if (code < 53496) {
                            if (53469 <= code && code <= 53495) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 53497) {
                              if (53496 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (53497 <= code && code <= 53523) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 53525) {
                            if (53524 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 53552) {
                              if (53525 <= code && code <= 53551) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (53552 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 53636) {
                        if (code < 53581) {
                          if (code < 53580) {
                            if (53553 <= code && code <= 53579) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (53580 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 53608) {
                            if (53581 <= code && code <= 53607) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 53609) {
                              if (53608 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (53609 <= code && code <= 53635) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 53665) {
                          if (code < 53637) {
                            if (53636 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 53664) {
                              if (53637 <= code && code <= 53663) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (53664 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 53692) {
                            if (53665 <= code && code <= 53691) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 53693) {
                              if (53692 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (53693 <= code && code <= 53719) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 70459) {
              if (code < 54897) {
                if (code < 54308) {
                  if (code < 54001) {
                    if (code < 53860) {
                      if (code < 53777) {
                        if (code < 53748) {
                          if (code < 53721) {
                            if (53720 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (53721 <= code && code <= 53747) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 53749) {
                            if (53748 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 53776) {
                              if (53749 <= code && code <= 53775) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (53776 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 53805) {
                          if (code < 53804) {
                            if (53777 <= code && code <= 53803) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (53804 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 53832) {
                            if (53805 <= code && code <= 53831) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 53833) {
                              if (53832 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (53833 <= code && code <= 53859) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 53917) {
                        if (code < 53888) {
                          if (code < 53861) {
                            if (53860 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (53861 <= code && code <= 53887) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 53889) {
                            if (53888 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 53916) {
                              if (53889 <= code && code <= 53915) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (53916 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 53972) {
                          if (code < 53944) {
                            if (53917 <= code && code <= 53943) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 53945) {
                              if (53944 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (53945 <= code && code <= 53971) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 53973) {
                            if (53972 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 54e3) {
                              if (53973 <= code && code <= 53999) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (54e3 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 54141) {
                      if (code < 54084) {
                        if (code < 54029) {
                          if (code < 54028) {
                            if (54001 <= code && code <= 54027) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (54028 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 54056) {
                            if (54029 <= code && code <= 54055) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 54057) {
                              if (54056 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (54057 <= code && code <= 54083) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 54112) {
                          if (code < 54085) {
                            if (54084 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (54085 <= code && code <= 54111) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 54113) {
                            if (54112 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 54140) {
                              if (54113 <= code && code <= 54139) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (54140 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 54224) {
                        if (code < 54169) {
                          if (code < 54168) {
                            if (54141 <= code && code <= 54167) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (54168 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 54196) {
                            if (54169 <= code && code <= 54195) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 54197) {
                              if (54196 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (54197 <= code && code <= 54223) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 54253) {
                          if (code < 54225) {
                            if (54224 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 54252) {
                              if (54225 <= code && code <= 54251) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (54252 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 54280) {
                            if (54253 <= code && code <= 54279) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 54281) {
                              if (54280 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (54281 <= code && code <= 54307) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 54589) {
                    if (code < 54448) {
                      if (code < 54365) {
                        if (code < 54336) {
                          if (code < 54309) {
                            if (54308 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (54309 <= code && code <= 54335) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 54337) {
                            if (54336 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 54364) {
                              if (54337 <= code && code <= 54363) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (54364 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 54393) {
                          if (code < 54392) {
                            if (54365 <= code && code <= 54391) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (54392 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 54420) {
                            if (54393 <= code && code <= 54419) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 54421) {
                              if (54420 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (54421 <= code && code <= 54447) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 54505) {
                        if (code < 54476) {
                          if (code < 54449) {
                            if (54448 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (54449 <= code && code <= 54475) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 54477) {
                            if (54476 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 54504) {
                              if (54477 <= code && code <= 54503) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (54504 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 54560) {
                          if (code < 54532) {
                            if (54505 <= code && code <= 54531) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 54533) {
                              if (54532 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (54533 <= code && code <= 54559) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 54561) {
                            if (54560 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 54588) {
                              if (54561 <= code && code <= 54587) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (54588 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 54756) {
                      if (code < 54672) {
                        if (code < 54617) {
                          if (code < 54616) {
                            if (54589 <= code && code <= 54615) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (54616 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 54644) {
                            if (54617 <= code && code <= 54643) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 54645) {
                              if (54644 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (54645 <= code && code <= 54671) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 54701) {
                          if (code < 54673) {
                            if (54672 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 54700) {
                              if (54673 <= code && code <= 54699) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (54700 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 54728) {
                            if (54701 <= code && code <= 54727) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 54729) {
                              if (54728 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (54729 <= code && code <= 54755) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 54813) {
                        if (code < 54784) {
                          if (code < 54757) {
                            if (54756 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (54757 <= code && code <= 54783) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 54785) {
                            if (54784 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 54812) {
                              if (54785 <= code && code <= 54811) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (54812 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 54868) {
                          if (code < 54840) {
                            if (54813 <= code && code <= 54839) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 54841) {
                              if (54840 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (54841 <= code && code <= 54867) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        } else {
                          if (code < 54869) {
                            if (54868 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 54896) {
                              if (54869 <= code && code <= 54895) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (54896 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 69632) {
                  if (code < 55216) {
                    if (code < 55037) {
                      if (code < 54980) {
                        if (code < 54925) {
                          if (code < 54924) {
                            if (54897 <= code && code <= 54923) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (54924 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 54952) {
                            if (54925 <= code && code <= 54951) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 54953) {
                              if (54952 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (54953 <= code && code <= 54979) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 55008) {
                          if (code < 54981) {
                            if (54980 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (54981 <= code && code <= 55007) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          }
                        } else {
                          if (code < 55009) {
                            if (55008 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 55036) {
                              if (55009 <= code && code <= 55035) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (55036 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 55120) {
                        if (code < 55065) {
                          if (code < 55064) {
                            if (55037 <= code && code <= 55063) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (55064 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          }
                        } else {
                          if (code < 55092) {
                            if (55065 <= code && code <= 55091) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 55093) {
                              if (55092 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (55093 <= code && code <= 55119) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 55149) {
                          if (code < 55121) {
                            if (55120 === code) {
                              return boundaries_1.CLUSTER_BREAK.LV;
                            }
                          } else {
                            if (code < 55148) {
                              if (55121 <= code && code <= 55147) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            } else {
                              if (55148 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            }
                          }
                        } else {
                          if (code < 55176) {
                            if (55149 <= code && code <= 55175) {
                              return boundaries_1.CLUSTER_BREAK.LVT;
                            }
                          } else {
                            if (code < 55177) {
                              if (55176 === code) {
                                return boundaries_1.CLUSTER_BREAK.LV;
                              }
                            } else {
                              if (55177 <= code && code <= 55203) {
                                return boundaries_1.CLUSTER_BREAK.LVT;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 68097) {
                      if (code < 65279) {
                        if (code < 64286) {
                          if (code < 55243) {
                            if (55216 <= code && code <= 55238) {
                              return boundaries_1.CLUSTER_BREAK.V;
                            }
                          } else {
                            if (55243 <= code && code <= 55291) {
                              return boundaries_1.CLUSTER_BREAK.T;
                            }
                          }
                        } else {
                          if (code < 65024) {
                            if (64286 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 65056) {
                              if (65024 <= code && code <= 65039) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (65056 <= code && code <= 65071) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 66045) {
                          if (code < 65438) {
                            if (65279 === code) {
                              return boundaries_1.CLUSTER_BREAK.CONTROL;
                            }
                          } else {
                            if (code < 65520) {
                              if (65438 <= code && code <= 65439) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (65520 <= code && code <= 65531) {
                                return boundaries_1.CLUSTER_BREAK.CONTROL;
                              }
                            }
                          }
                        } else {
                          if (code < 66272) {
                            if (66045 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 66422) {
                              if (66272 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (66422 <= code && code <= 66426) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 68325) {
                        if (code < 68108) {
                          if (code < 68101) {
                            if (68097 <= code && code <= 68099) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (68101 <= code && code <= 68102) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 68152) {
                            if (68108 <= code && code <= 68111) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 68159) {
                              if (68152 <= code && code <= 68154) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (68159 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 69373) {
                          if (code < 68900) {
                            if (68325 <= code && code <= 68326) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 69291) {
                              if (68900 <= code && code <= 68903) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (69291 <= code && code <= 69292) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 69446) {
                            if (69373 <= code && code <= 69375) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 69506) {
                              if (69446 <= code && code <= 69456) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (69506 <= code && code <= 69509) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 70016) {
                    if (code < 69815) {
                      if (code < 69747) {
                        if (code < 69634) {
                          if (69632 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                          if (69633 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 69688) {
                            if (69634 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 69744) {
                              if (69688 <= code && code <= 69702) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (69744 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 69762) {
                          if (code < 69759) {
                            if (69747 <= code && code <= 69748) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (69759 <= code && code <= 69761) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 69808) {
                            if (69762 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 69811) {
                              if (69808 <= code && code <= 69810) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (69811 <= code && code <= 69814) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 69888) {
                        if (code < 69821) {
                          if (code < 69817) {
                            if (69815 <= code && code <= 69816) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (69817 <= code && code <= 69818) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 69826) {
                            if (69821 === code) {
                              return boundaries_1.CLUSTER_BREAK.PREPEND;
                            }
                          } else {
                            if (69826 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (69837 === code) {
                              return boundaries_1.CLUSTER_BREAK.PREPEND;
                            }
                          }
                        }
                      } else {
                        if (code < 69933) {
                          if (code < 69927) {
                            if (69888 <= code && code <= 69890) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 69932) {
                              if (69927 <= code && code <= 69931) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (69932 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        } else {
                          if (code < 69957) {
                            if (69933 <= code && code <= 69940) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 70003) {
                              if (69957 <= code && code <= 69958) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (70003 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 70194) {
                      if (code < 70082) {
                        if (code < 70067) {
                          if (code < 70018) {
                            if (70016 <= code && code <= 70017) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (70018 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 70070) {
                            if (70067 <= code && code <= 70069) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 70079) {
                              if (70070 <= code && code <= 70078) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (70079 <= code && code <= 70080) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 70095) {
                          if (code < 70089) {
                            if (70082 <= code && code <= 70083) {
                              return boundaries_1.CLUSTER_BREAK.PREPEND;
                            }
                          } else {
                            if (code < 70094) {
                              if (70089 <= code && code <= 70092) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (70094 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        } else {
                          if (code < 70188) {
                            if (70095 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 70191) {
                              if (70188 <= code && code <= 70190) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (70191 <= code && code <= 70193) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 70209) {
                        if (code < 70197) {
                          if (code < 70196) {
                            if (70194 <= code && code <= 70195) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (70196 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 70198) {
                            if (70197 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 70206) {
                              if (70198 <= code && code <= 70199) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (70206 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 70371) {
                          if (code < 70367) {
                            if (70209 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 70368) {
                              if (70367 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (70368 <= code && code <= 70370) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        } else {
                          if (code < 70400) {
                            if (70371 <= code && code <= 70378) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 70402) {
                              if (70400 <= code && code <= 70401) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (70402 <= code && code <= 70403) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 72343) {
                if (code < 71339) {
                  if (code < 70841) {
                    if (code < 70512) {
                      if (code < 70471) {
                        if (code < 70463) {
                          if (code < 70462) {
                            if (70459 <= code && code <= 70460) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (70462 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 70464) {
                            if (70463 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 70465) {
                              if (70464 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (70465 <= code && code <= 70468) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 70487) {
                          if (code < 70475) {
                            if (70471 <= code && code <= 70472) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (70475 <= code && code <= 70477) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 70498) {
                            if (70487 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 70502) {
                              if (70498 <= code && code <= 70499) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (70502 <= code && code <= 70508) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 70725) {
                        if (code < 70712) {
                          if (code < 70709) {
                            if (70512 <= code && code <= 70516) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (70709 <= code && code <= 70711) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 70720) {
                            if (70712 <= code && code <= 70719) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 70722) {
                              if (70720 <= code && code <= 70721) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (70722 <= code && code <= 70724) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 70832) {
                          if (code < 70726) {
                            if (70725 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (70726 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (70750 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 70833) {
                            if (70832 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 70835) {
                              if (70833 <= code && code <= 70834) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (70835 <= code && code <= 70840) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 71096) {
                      if (code < 70847) {
                        if (code < 70843) {
                          if (70841 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                          if (70842 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 70845) {
                            if (70843 <= code && code <= 70844) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (70845 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (70846 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        }
                      } else {
                        if (code < 71087) {
                          if (code < 70849) {
                            if (70847 <= code && code <= 70848) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 70850) {
                              if (70849 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (70850 <= code && code <= 70851) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 71088) {
                            if (71087 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 71090) {
                              if (71088 <= code && code <= 71089) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (71090 <= code && code <= 71093) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 71216) {
                        if (code < 71102) {
                          if (code < 71100) {
                            if (71096 <= code && code <= 71099) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (71100 <= code && code <= 71101) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 71103) {
                            if (71102 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 71132) {
                              if (71103 <= code && code <= 71104) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (71132 <= code && code <= 71133) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 71229) {
                          if (code < 71219) {
                            if (71216 <= code && code <= 71218) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 71227) {
                              if (71219 <= code && code <= 71226) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (71227 <= code && code <= 71228) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        } else {
                          if (code < 71230) {
                            if (71229 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 71231) {
                              if (71230 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (71231 <= code && code <= 71232) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 71999) {
                    if (code < 71463) {
                      if (code < 71350) {
                        if (code < 71341) {
                          if (71339 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                          if (71340 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          if (code < 71342) {
                            if (71341 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 71344) {
                              if (71342 <= code && code <= 71343) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (71344 <= code && code <= 71349) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 71453) {
                          if (71350 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                          if (71351 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 71458) {
                            if (71453 <= code && code <= 71455) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 71462) {
                              if (71458 <= code && code <= 71461) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (71462 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 71984) {
                        if (code < 71727) {
                          if (code < 71724) {
                            if (71463 <= code && code <= 71467) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (71724 <= code && code <= 71726) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 71736) {
                            if (71727 <= code && code <= 71735) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 71737) {
                              if (71736 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (71737 <= code && code <= 71738) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 71995) {
                          if (code < 71985) {
                            if (71984 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 71991) {
                              if (71985 <= code && code <= 71989) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (71991 <= code && code <= 71992) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        } else {
                          if (code < 71997) {
                            if (71995 <= code && code <= 71996) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (71997 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                            if (71998 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 72193) {
                      if (code < 72145) {
                        if (code < 72001) {
                          if (71999 === code) {
                            return boundaries_1.CLUSTER_BREAK.PREPEND;
                          }
                          if (72e3 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          if (code < 72002) {
                            if (72001 === code) {
                              return boundaries_1.CLUSTER_BREAK.PREPEND;
                            }
                          } else {
                            if (72002 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                            if (72003 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      } else {
                        if (code < 72156) {
                          if (code < 72148) {
                            if (72145 <= code && code <= 72147) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 72154) {
                              if (72148 <= code && code <= 72151) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (72154 <= code && code <= 72155) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 72160) {
                            if (72156 <= code && code <= 72159) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (72160 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (72164 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 72263) {
                        if (code < 72249) {
                          if (code < 72243) {
                            if (72193 <= code && code <= 72202) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (72243 <= code && code <= 72248) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 72250) {
                            if (72249 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 72251) {
                              if (72250 === code) {
                                return boundaries_1.CLUSTER_BREAK.PREPEND;
                              }
                            } else {
                              if (72251 <= code && code <= 72254) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 72281) {
                          if (code < 72273) {
                            if (72263 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 72279) {
                              if (72273 <= code && code <= 72278) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (72279 <= code && code <= 72280) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        } else {
                          if (code < 72324) {
                            if (72281 <= code && code <= 72283) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 72330) {
                              if (72324 <= code && code <= 72329) {
                                return boundaries_1.CLUSTER_BREAK.PREPEND;
                              }
                            } else {
                              if (72330 <= code && code <= 72342) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 94033) {
                  if (code < 73104) {
                    if (code < 72881) {
                      if (code < 72766) {
                        if (code < 72751) {
                          if (code < 72344) {
                            if (72343 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (72344 <= code && code <= 72345) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 72752) {
                            if (72751 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 72760) {
                              if (72752 <= code && code <= 72758) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (72760 <= code && code <= 72765) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 72850) {
                          if (72766 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                          if (72767 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          if (code < 72873) {
                            if (72850 <= code && code <= 72871) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 72874) {
                              if (72873 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (72874 <= code && code <= 72880) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 73018) {
                        if (code < 72884) {
                          if (code < 72882) {
                            if (72881 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (72882 <= code && code <= 72883) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 72885) {
                            if (72884 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (code < 73009) {
                              if (72885 <= code && code <= 72886) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (73009 <= code && code <= 73014) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 73030) {
                          if (code < 73020) {
                            if (73018 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 73023) {
                              if (73020 <= code && code <= 73021) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (73023 <= code && code <= 73029) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 73031) {
                            if (73030 === code) {
                              return boundaries_1.CLUSTER_BREAK.PREPEND;
                            }
                          } else {
                            if (code < 73098) {
                              if (73031 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (73098 <= code && code <= 73102) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 73526) {
                      if (code < 73459) {
                        if (code < 73109) {
                          if (code < 73107) {
                            if (73104 <= code && code <= 73105) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (73107 <= code && code <= 73108) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 73110) {
                            if (73109 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (73110 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                            if (73111 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      } else {
                        if (code < 73474) {
                          if (code < 73461) {
                            if (73459 <= code && code <= 73460) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 73472) {
                              if (73461 <= code && code <= 73462) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (73472 <= code && code <= 73473) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 73475) {
                            if (73474 === code) {
                              return boundaries_1.CLUSTER_BREAK.PREPEND;
                            }
                          } else {
                            if (code < 73524) {
                              if (73475 === code) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (73524 <= code && code <= 73525) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 78896) {
                        if (code < 73536) {
                          if (code < 73534) {
                            if (73526 <= code && code <= 73530) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (73534 <= code && code <= 73535) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 73537) {
                            if (73536 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (73537 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                            if (73538 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        }
                      } else {
                        if (code < 92912) {
                          if (code < 78912) {
                            if (78896 <= code && code <= 78911) {
                              return boundaries_1.CLUSTER_BREAK.CONTROL;
                            }
                          } else {
                            if (code < 78919) {
                              if (78912 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (78919 <= code && code <= 78933) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 92976) {
                            if (92912 <= code && code <= 92916) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 94031) {
                              if (92976 <= code && code <= 92982) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (94031 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 121476) {
                    if (code < 119143) {
                      if (code < 113824) {
                        if (code < 94180) {
                          if (code < 94095) {
                            if (94033 <= code && code <= 94087) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          } else {
                            if (94095 <= code && code <= 94098) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 94192) {
                            if (94180 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 113821) {
                              if (94192 <= code && code <= 94193) {
                                return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                              }
                            } else {
                              if (113821 <= code && code <= 113822) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 118576) {
                          if (code < 118528) {
                            if (113824 <= code && code <= 113827) {
                              return boundaries_1.CLUSTER_BREAK.CONTROL;
                            }
                          } else {
                            if (118528 <= code && code <= 118573) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 119141) {
                            if (118576 <= code && code <= 118598) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (119141 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                            if (119142 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 119173) {
                        if (code < 119150) {
                          if (code < 119149) {
                            if (119143 <= code && code <= 119145) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (119149 === code) {
                              return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                            }
                          }
                        } else {
                          if (code < 119155) {
                            if (119150 <= code && code <= 119154) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 119163) {
                              if (119155 <= code && code <= 119162) {
                                return boundaries_1.CLUSTER_BREAK.CONTROL;
                              }
                            } else {
                              if (119163 <= code && code <= 119170) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 121344) {
                          if (code < 119210) {
                            if (119173 <= code && code <= 119179) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 119362) {
                              if (119210 <= code && code <= 119213) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (119362 <= code && code <= 119364) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 121403) {
                            if (121344 <= code && code <= 121398) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 121461) {
                              if (121403 <= code && code <= 121452) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (121461 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 123628) {
                      if (code < 122907) {
                        if (code < 121505) {
                          if (code < 121499) {
                            if (121476 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (121499 <= code && code <= 121503) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 122880) {
                            if (121505 <= code && code <= 121519) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 122888) {
                              if (122880 <= code && code <= 122886) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (122888 <= code && code <= 122904) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 123023) {
                          if (code < 122915) {
                            if (122907 <= code && code <= 122913) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 122918) {
                              if (122915 <= code && code <= 122916) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (122918 <= code && code <= 122922) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 123184) {
                            if (123023 === code) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 123566) {
                              if (123184 <= code && code <= 123190) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (123566 === code) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      if (code < 127995) {
                        if (code < 125136) {
                          if (code < 124140) {
                            if (123628 <= code && code <= 123631) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (124140 <= code && code <= 124143) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          }
                        } else {
                          if (code < 125252) {
                            if (125136 <= code && code <= 125142) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 127462) {
                              if (125252 <= code && code <= 125258) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (127462 <= code && code <= 127487) {
                                return boundaries_1.CLUSTER_BREAK.REGIONAL_INDICATOR;
                              }
                            }
                          }
                        }
                      } else {
                        if (code < 917632) {
                          if (code < 917504) {
                            if (127995 <= code && code <= 127999) {
                              return boundaries_1.CLUSTER_BREAK.EXTEND;
                            }
                          } else {
                            if (code < 917536) {
                              if (917504 <= code && code <= 917535) {
                                return boundaries_1.CLUSTER_BREAK.CONTROL;
                              }
                            } else {
                              if (917536 <= code && code <= 917631) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            }
                          }
                        } else {
                          if (code < 917760) {
                            if (917632 <= code && code <= 917759) {
                              return boundaries_1.CLUSTER_BREAK.CONTROL;
                            }
                          } else {
                            if (code < 918e3) {
                              if (917760 <= code && code <= 917999) {
                                return boundaries_1.CLUSTER_BREAK.EXTEND;
                              }
                            } else {
                              if (918e3 <= code && code <= 921599) {
                                return boundaries_1.CLUSTER_BREAK.CONTROL;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return boundaries_1.CLUSTER_BREAK.OTHER;
      }
      /**
       * Given a Unicode code point, returns if symbol is an extended pictographic or some other break
       * @param code {number} Unicode code point
       * @returns {number}
       */
      static getEmojiProperty(code) {
        if (code < 10160) {
          if (code < 9728) {
            if (code < 9e3) {
              if (code < 8482) {
                if (code < 8252) {
                  if (169 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                  if (174 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  if (8252 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                  if (8265 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              } else {
                if (code < 8596) {
                  if (8482 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                  if (8505 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  if (code < 8617) {
                    if (8596 <= code && code <= 8601) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (code < 8986) {
                      if (8617 <= code && code <= 8618) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    } else {
                      if (8986 <= code && code <= 8987) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 9410) {
                if (code < 9167) {
                  if (9e3 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                  if (9096 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  if (code < 9193) {
                    if (9167 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (code < 9208) {
                      if (9193 <= code && code <= 9203) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    } else {
                      if (9208 <= code && code <= 9210) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    }
                  }
                }
              } else {
                if (code < 9654) {
                  if (code < 9642) {
                    if (9410 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (9642 <= code && code <= 9643) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                } else {
                  if (code < 9664) {
                    if (9654 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (code < 9723) {
                      if (9664 === code) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    } else {
                      if (9723 <= code && code <= 9726) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 10035) {
              if (code < 10004) {
                if (code < 9748) {
                  if (code < 9735) {
                    if (9728 <= code && code <= 9733) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (9735 <= code && code <= 9746) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                } else {
                  if (code < 9872) {
                    if (9748 <= code && code <= 9861) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (code < 9992) {
                      if (9872 <= code && code <= 9989) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    } else {
                      if (9992 <= code && code <= 10002) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    }
                  }
                }
              } else {
                if (code < 10013) {
                  if (10004 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                  if (10006 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  if (code < 10017) {
                    if (10013 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (10017 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                    if (10024 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                }
              }
            } else {
              if (code < 10067) {
                if (code < 10055) {
                  if (code < 10052) {
                    if (10035 <= code && code <= 10036) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (10052 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                } else {
                  if (code < 10060) {
                    if (10055 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (10060 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                    if (10062 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                }
              } else {
                if (code < 10083) {
                  if (code < 10071) {
                    if (10067 <= code && code <= 10069) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (10071 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                } else {
                  if (code < 10133) {
                    if (10083 <= code && code <= 10087) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (code < 10145) {
                      if (10133 <= code && code <= 10135) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    } else {
                      if (10145 === code) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          if (code < 127489) {
            if (code < 12951) {
              if (code < 11035) {
                if (code < 10548) {
                  if (10160 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                  if (10175 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  if (code < 11013) {
                    if (10548 <= code && code <= 10549) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (11013 <= code && code <= 11015) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                }
              } else {
                if (code < 11093) {
                  if (code < 11088) {
                    if (11035 <= code && code <= 11036) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (11088 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                } else {
                  if (code < 12336) {
                    if (11093 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (12336 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                    if (12349 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                }
              }
            } else {
              if (code < 127340) {
                if (code < 126976) {
                  if (12951 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                  if (12953 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  if (code < 127245) {
                    if (126976 <= code && code <= 127231) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (code < 127279) {
                      if (127245 <= code && code <= 127247) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    } else {
                      if (127279 === code) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    }
                  }
                }
              } else {
                if (code < 127374) {
                  if (code < 127358) {
                    if (127340 <= code && code <= 127345) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (127358 <= code && code <= 127359) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                } else {
                  if (code < 127377) {
                    if (127374 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (code < 127405) {
                      if (127377 <= code && code <= 127386) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    } else {
                      if (127405 <= code && code <= 127461) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 128981) {
              if (code < 127561) {
                if (code < 127535) {
                  if (code < 127514) {
                    if (127489 <= code && code <= 127503) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (127514 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                } else {
                  if (code < 127538) {
                    if (127535 === code) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (code < 127548) {
                      if (127538 <= code && code <= 127546) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    } else {
                      if (127548 <= code && code <= 127551) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    }
                  }
                }
              } else {
                if (code < 128326) {
                  if (code < 128e3) {
                    if (127561 <= code && code <= 127994) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (128e3 <= code && code <= 128317) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                } else {
                  if (code < 128640) {
                    if (128326 <= code && code <= 128591) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (code < 128884) {
                      if (128640 <= code && code <= 128767) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    } else {
                      if (128884 <= code && code <= 128895) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 129198) {
                if (code < 129096) {
                  if (code < 129036) {
                    if (128981 <= code && code <= 129023) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (129036 <= code && code <= 129039) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                } else {
                  if (code < 129114) {
                    if (129096 <= code && code <= 129103) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (code < 129160) {
                      if (129114 <= code && code <= 129119) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    } else {
                      if (129160 <= code && code <= 129167) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    }
                  }
                }
              } else {
                if (code < 129340) {
                  if (code < 129292) {
                    if (129198 <= code && code <= 129279) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (129292 <= code && code <= 129338) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  }
                } else {
                  if (code < 129351) {
                    if (129340 <= code && code <= 129349) {
                      return boundaries_1.EXTENDED_PICTOGRAPHIC;
                    }
                  } else {
                    if (code < 130048) {
                      if (129351 <= code && code <= 129791) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    } else {
                      if (130048 <= code && code <= 131069) {
                        return boundaries_1.EXTENDED_PICTOGRAPHIC;
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return boundaries_1.CLUSTER_BREAK.OTHER;
      }
    };
    exports.default = Graphemer2;
  }
});

// node_modules/graphemer/lib/index.js
var require_lib = __commonJS({
  "node_modules/graphemer/lib/index.js"(exports) {
    "use strict";
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var Graphemer_1 = __importDefault(require_Graphemer());
    exports.default = Graphemer_1.default;
  }
});

// node_modules/emoji-regex/index.js
var require_emoji_regex = __commonJS({
  "node_modules/emoji-regex/index.js"(exports, module) {
    module.exports = () => {
      return /[#*0-9]\uFE0F?\u20E3|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26AA\u26B0\u26B1\u26BD\u26BE\u26C4\u26C8\u26CF\u26D1\u26D3\u26E9\u26F0-\u26F5\u26F7\u26F8\u26FA\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B55\u3030\u303D\u3297\u3299]\uFE0F?|[\u261D\u270C\u270D](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?|[\u270A\u270B](?:\uD83C[\uDFFB-\uDFFF])?|[\u23E9-\u23EC\u23F0\u23F3\u25FD\u2693\u26A1\u26AB\u26C5\u26CE\u26D4\u26EA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2795-\u2797\u27B0\u27BF\u2B50]|\u26F9(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|\u2764\uFE0F?(?:\u200D(?:\uD83D\uDD25|\uD83E\uDE79))?|\uD83C(?:[\uDC04\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]\uFE0F?|[\uDF85\uDFC2\uDFC7](?:\uD83C[\uDFFB-\uDFFF])?|[\uDFC3\uDFC4\uDFCA](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDFCB\uDFCC](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uDDE6\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF]|\uDDE7\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF]|\uDDE8\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF]|\uDDE9\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF]|\uDDEA\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA]|\uDDEB\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7]|\uDDEC\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE]|\uDDED\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA]|\uDDEE\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9]|\uDDEF\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5]|\uDDF0\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF]|\uDDF1\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE]|\uDDF2\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF]|\uDDF3\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF]|\uDDF4\uD83C\uDDF2|\uDDF5\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE]|\uDDF6\uD83C\uDDE6|\uDDF7\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC]|\uDDF8\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF]|\uDDF9\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF]|\uDDFA\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF]|\uDDFB\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA]|\uDDFC\uD83C[\uDDEB\uDDF8]|\uDDFD\uD83C\uDDF0|\uDDFE\uD83C[\uDDEA\uDDF9]|\uDDFF\uD83C[\uDDE6\uDDF2\uDDFC]|\uDFF3\uFE0F?(?:\u200D(?:\u26A7\uFE0F?|\uD83C\uDF08))?|\uDFF4(?:\u200D\u2620\uFE0F?|\uDB40\uDC67\uDB40\uDC62\uDB40(?:\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDC73\uDB40\uDC63\uDB40\uDC74|\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F)?)|\uD83D(?:[\uDC08\uDC26](?:\u200D\u2B1B)?|[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3]\uFE0F?|[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC](?:\uD83C[\uDFFB-\uDFFF])?|[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD74\uDD90](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?|[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC25\uDC27-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEDC-\uDEDF\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB\uDFF0]|\uDC15(?:\u200D\uD83E\uDDBA)?|\uDC3B(?:\u200D\u2744\uFE0F?)?|\uDC41\uFE0F?(?:\u200D\uD83D\uDDE8\uFE0F?)?|\uDC68(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDC68\uDC69]\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFE])))?))?|\uDC69(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?[\uDC68\uDC69]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?|\uDC69\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?))|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFE])))?))?|\uDC6F(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDD75(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDE2E(?:\u200D\uD83D\uDCA8)?|\uDE35(?:\u200D\uD83D\uDCAB)?|\uDE36(?:\u200D\uD83C\uDF2B\uFE0F?)?)|\uD83E(?:[\uDD0C\uDD0F\uDD18-\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5\uDEC3-\uDEC5\uDEF0\uDEF2-\uDEF8](?:\uD83C[\uDFFB-\uDFFF])?|[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDDDE\uDDDF](?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD0D\uDD0E\uDD10-\uDD17\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCC\uDDD0\uDDE0-\uDDFF\uDE70-\uDE7C\uDE80-\uDE88\uDE90-\uDEBD\uDEBF-\uDEC2\uDECE-\uDEDB\uDEE0-\uDEE8]|\uDD3C(?:\u200D[\u2640\u2642]\uFE0F?|\uD83C[\uDFFB-\uDFFF])?|\uDDD1(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83E\uDDD1))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFC-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFD-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFD\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFE]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF-\uDDB3\uDDBC\uDDBD]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?))?|\uDEF1(?:\uD83C(?:\uDFFB(?:\u200D\uD83E\uDEF2\uD83C[\uDFFC-\uDFFF])?|\uDFFC(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFD-\uDFFF])?|\uDFFD(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])?|\uDFFE(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFD\uDFFF])?|\uDFFF(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFE])?))?)/g;
    };
  }
});

// src/service/main.mjs
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync as mkdirSync2, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join as join2, resolve, sep } from "node:path";
import { tmpdir, userInfo } from "node:os";
import { fileURLToPath } from "node:url";

// node_modules/@openchamber/sdk/dist/scrollbar-style.js
var GUEST_SCROLLING_ATTRIBUTE = "data-oc-scrolling";
var GUEST_SCROLLBAR_CSS = `
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [${GUEST_SCROLLING_ATTRIBUTE}] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [${GUEST_SCROLLING_ATTRIBUTE}]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;
function installGuestScrollbarActivity(doc) {
  const root = doc.documentElement;
  if (root.hasAttribute("data-oc-scrollbar-activity"))
    return;
  root.setAttribute("data-oc-scrollbar-activity", "");
  const timers = /* @__PURE__ */ new WeakMap();
  doc.addEventListener("scroll", (event) => {
    const target = event.target === doc ? root : event.target;
    if (!(target instanceof Element))
      return;
    if (!target.hasAttribute("data-oc-scrolling"))
      target.setAttribute("data-oc-scrolling", "");
    const pending = timers.get(target);
    if (pending !== void 0)
      clearTimeout(pending);
    timers.set(target, setTimeout(() => {
      timers.delete(target);
      target.removeAttribute("data-oc-scrolling");
    }, 1e3));
  }, { capture: true, passive: true });
}
var GUEST_SCROLLBAR_SCRIPT = `(${installGuestScrollbarActivity.toString()})(document);`;

// node_modules/@openchamber/sdk/dist/manifest.js
var GUEST_PROVIDER_LOGO_BYTES_MAX = 1024 * 1024;
var TRACKER_URL_TOKENS = ["{id}", "{segment}", "{segments+}"];
var TRACKER_URL_TOKEN_SET = new Set(TRACKER_URL_TOKENS);

// node_modules/@openchamber/sdk/dist/session-events.js
var GUEST_SESSION_EVENT_TYPES = [
  "turn-finished",
  "turn-failed",
  "permission-asked",
  "question-asked",
  "turn-started",
  "session-created",
  "session-archived",
  "session-deleted"
];
var SESSION_EVENTS_WIRE_VERSION = 1;
var SESSION_EVENTS_IDLE_MS = 10 * 6e4;
var EVENT_TYPES = new Set(GUEST_SESSION_EVENT_TYPES);
var isGuestSessionEventType = (value) => EVENT_TYPES.has(value);
var readSessionEventRequest = (body2) => {
  let wire;
  try {
    const parsed = JSON.parse(body2);
    if (Object(parsed) !== parsed || parsed === null)
      return null;
    wire = parsed;
  } catch {
    return null;
  }
  const { v, requestId, event, content } = wire;
  if (v !== SESSION_EVENTS_WIRE_VERSION)
    return null;
  if (String(requestId) !== requestId || requestId.length === 0)
    return null;
  if (Object(event) !== event || event === void 0)
    return null;
  const { id: id2, type, at, session, project, linked, permission, question } = event;
  if (String(id2) !== id2 || id2.length === 0)
    return null;
  if (String(type) !== type || !isGuestSessionEventType(type))
    return null;
  if (!Number.isFinite(at))
    return null;
  if (Object(session) !== session || session === void 0)
    return null;
  const sessionId = session.id;
  if (String(sessionId) !== sessionId || sessionId.length === 0)
    return null;
  const parentId = session.parentId;
  if (parentId !== null && (String(parentId) !== parentId || parentId.length === 0))
    return null;
  if (Object(project) !== project || project === void 0)
    return null;
  const directory = project.directory;
  if (directory !== null && (String(directory) !== directory || directory.length === 0))
    return null;
  if (!Array.isArray(linked))
    return null;
  const request = {
    v: SESSION_EVENTS_WIRE_VERSION,
    requestId,
    event: { id: id2, type, at: Number(at), session: { id: sessionId, parentId }, project: { directory }, linked }
  };
  if (permission !== void 0) {
    if (Object(permission) !== permission)
      return null;
    const permissionRequestId = permission.requestId;
    if (String(permissionRequestId) !== permissionRequestId || permissionRequestId.length === 0)
      return null;
    request.event.permission = { requestId: permissionRequestId };
  }
  if (question !== void 0) {
    if (Object(question) !== question)
      return null;
    const { kind, id: questionId } = question;
    if (kind !== "form" && kind !== "page")
      return null;
    if (String(questionId) !== questionId || questionId.length === 0)
      return null;
    request.event.question = { kind, id: questionId };
  }
  if (content !== void 0) {
    if (Object(content) !== content || content.type !== type)
      return null;
    request.content = content;
  }
  return request;
};

// node_modules/@openchamber/sdk/dist/service-host.js
var SERVICE_HOST_PATH = "/service/call";
var OPENCHAMBER_HOST_CALLBACK_URL_ENV = "OPENCHAMBER_HOST_CALLBACK_URL";
var SERVICE_HOST_TIMEOUT_MS = 3e4;
var SERVICE_SCHEDULE_IDLE_MS = 10 * 6e4;
var MENTIONS_IDLE_MS = 10 * 6e4;
var ServiceHostError = class extends Error {
  code;
  status;
  constructor(message, code, status) {
    super(message);
    this.name = "ServiceHostError";
    this.code = code;
    this.status = status;
  }
};
var createServiceHost = ({ env }) => {
  const call = async (method, input) => {
    const base = env[OPENCHAMBER_HOST_CALLBACK_URL_ENV];
    const token = env.OPENCHAMBER_SERVICE_TOKEN;
    if (!base || !token)
      throw new ServiceHostError("This service was not started by OpenChamber.", "HOST_UNAVAILABLE", 0);
    let response;
    try {
      response = await fetch(`${base.replace(/\/+$/, "")}${SERVICE_HOST_PATH}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ method, input }),
        signal: AbortSignal.timeout(SERVICE_HOST_TIMEOUT_MS)
      });
    } catch {
      throw new ServiceHostError("OpenChamber did not answer.", "HOST_UNAVAILABLE", 0);
    }
    const body2 = await response.json().catch(() => null);
    if (response.ok && body2?.result !== void 0)
      return body2.result;
    throw new ServiceHostError(body2?.error?.message ?? `OpenChamber answered HTTP ${response.status}.`, body2?.error?.code ?? "HOST_UNAVAILABLE", response.status);
  };
  return {
    sessions: {
      start: (input) => call("sessions.start", input),
      send: (sessionId, prompt) => call("sessions.send", { sessionId, prompt }),
      retry: (sessionId) => call("sessions.retry", { sessionId }),
      status: (sessionId) => call("sessions.status", { sessionId }),
      lastReply: (sessionId) => call("sessions.lastReply", { sessionId }),
      stop: (sessionId) => call("sessions.stop", { sessionId }),
      answerPermission: (sessionId, requestId, answer) => call("sessions.answerPermission", { sessionId, requestId, ...answer }),
      answerForm: (sessionId, formId, values, message) => call("sessions.answerForm", { sessionId, formId, values, ...message === void 0 ? {} : { message } })
    },
    setInstructions: (directory, text) => call("instructions.set", { directory, text }),
    emit: (topic, data) => call("panels.emit", { topic, data }),
    readSettings: () => call("settings.read", {}).then(({ settings }) => settings),
    needsConfiguration: (message) => call("status.set", { needsConfiguration: message }),
    setMark: (target, mark) => call("marks.set", { target, mark })
  };
};

// node_modules/@openchamber/sdk/dist/contract.js
var GUEST_FILE_STAT_KINDS = ["file", "directory", "other", "missing"];
var GUEST_GENERATE_LATE_KEEP_MS = 60 * 6e4;
var HOST_REQUEST_ERROR_CODES = [
  "HOST_UNAVAILABLE",
  "HOST_TIMEOUT",
  "HOST_REJECTED",
  "DISCONNECTED",
  "DISABLED",
  "BAD_PATH",
  "NO_INTEGRATION",
  "NO_SERVICE",
  "SERVICE_FAILED",
  "REQUEST_FAILED",
  "RESPONSE_TOO_LARGE",
  "NO_SESSION",
  "SESSION_BUSY",
  "NOT_GRANTED",
  "NO_DIRECTORY",
  "NOT_FOUND",
  "FILE_TOO_LARGE",
  "DENIED",
  "NO_MODEL",
  "MODEL_FAILED",
  "UNSUPPORTED"
];
var SERVICE_STATUS_VALUES = ["stopped", "starting", "ready", "failed"];
var hostRequestErrorCodeSet = new Set(HOST_REQUEST_ERROR_CODES);
var serviceStatusSet = new Set(SERVICE_STATUS_VALUES);
var fileStatKindSet = new Set(GUEST_FILE_STAT_KINDS);

// node_modules/@openchamber/sdk/dist/service-providers.js
var BROWSER_CONTROL_ACTIONS = [
  "browser.open",
  "browser.snapshot",
  "browser.click",
  "browser.type",
  "browser.select",
  "browser.scroll",
  "browser.back",
  "browser.forward",
  "browser.inspect",
  "browser.capture",
  "browser.resize",
  "browser.close"
];
var BROWSER_PROVIDER_IDLE_MS = 10 * 6e4;
var CONTROL_ACTIONS = new Set(BROWSER_CONTROL_ACTIONS);
var SOURCE_CONTROL_PROVIDER_IDLE_MS = 10 * 6e4;
var NOTIFICATIONS_PROVIDER_IDLE_MS = 10 * 6e4;
var TRACKER_PROVIDER_IDLE_MS = 10 * 6e4;
var QUOTA_PROVIDER_IDLE_MS = 10 * 6e4;

// node_modules/@openchamber/sdk/dist/service-surface.js
var SURFACE_CONTROLLERS = ["none", "agent", "user"];
var CONTROLLERS = new Set(SURFACE_CONTROLLERS);

// src/core/room-store.mjs
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// src/core/cursor.mjs
function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
function decodeCursor(value, label = "cursor") {
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    const error = new Error(`Invalid ${label}.`);
    error.code = "ROOM_INVALID_CURSOR";
    error.details = {};
    error.status = 400;
    throw error;
  }
}
function requireCursor(cursor, expected, label) {
  const parsed = decodeCursor(cursor, label);
  for (const [key, value] of Object.entries(expected)) {
    if (parsed[key] !== value) {
      const error = new Error(`${label} does not belong to this room or filter.`);
      error.code = "ROOM_INVALID_CURSOR";
      error.details = { key, expected: value };
      error.status = 400;
      throw error;
    }
  }
  return parsed;
}

// src/core/display-width.mjs
var import_graphemer = __toESM(require_lib(), 1);
var import_emoji_regex = __toESM(require_emoji_regex(), 1);

// src/core/unicode-15.json
var unicode_15_default = {
  version: "15.0.0",
  wide: [[4352, 4447], [8986, 8987], [9001, 9002], [9193, 9196], [9200, 9200], [9203, 9203], [9725, 9726], [9748, 9749], [9800, 9811], [9855, 9855], [9875, 9875], [9889, 9889], [9898, 9899], [9917, 9918], [9924, 9925], [9934, 9934], [9940, 9940], [9962, 9962], [9970, 9971], [9973, 9973], [9978, 9978], [9981, 9981], [9989, 9989], [9994, 9995], [10024, 10024], [10060, 10060], [10062, 10062], [10067, 10069], [10071, 10071], [10133, 10135], [10160, 10160], [10175, 10175], [11035, 11036], [11088, 11088], [11093, 11093], [11904, 11929], [11931, 12019], [12032, 12245], [12272, 12283], [12288, 12350], [12353, 12438], [12441, 12543], [12549, 12591], [12593, 12686], [12688, 12771], [12784, 12830], [12832, 12871], [12880, 19903], [19968, 42124], [42128, 42182], [43360, 43388], [44032, 55203], [63744, 64109], [64112, 64217], [65040, 65049], [65072, 65106], [65108, 65126], [65128, 65131], [65281, 65376], [65504, 65510], [94176, 94180], [94192, 94193], [94208, 100343], [100352, 101589], [101632, 101640], [110576, 110579], [110581, 110587], [110589, 110590], [110592, 110882], [110898, 110898], [110928, 110930], [110933, 110933], [110948, 110951], [110960, 111355], [126980, 126980], [127183, 127183], [127374, 127374], [127377, 127386], [127488, 127490], [127504, 127547], [127552, 127560], [127568, 127569], [127584, 127589], [127744, 127776], [127789, 127797], [127799, 127868], [127870, 127891], [127904, 127946], [127951, 127955], [127968, 127984], [127988, 127988], [127992, 128062], [128064, 128064], [128066, 128252], [128255, 128317], [128331, 128334], [128336, 128359], [128378, 128378], [128405, 128406], [128420, 128420], [128507, 128591], [128640, 128709], [128716, 128716], [128720, 128722], [128725, 128727], [128732, 128735], [128747, 128748], [128756, 128764], [128992, 129003], [129008, 129008], [129292, 129338], [129340, 129349], [129351, 129535], [129648, 129660], [129664, 129672], [129680, 129725], [129727, 129733], [129742, 129755], [129760, 129768], [129776, 129784], [131072, 173791], [173824, 177977], [177984, 178205], [178208, 183969], [183984, 191456], [194560, 195101], [196608, 201546], [201552, 205743]],
  zeroWidth: [[173, 173], [768, 879], [1155, 1161], [1425, 1469], [1471, 1471], [1473, 1474], [1476, 1477], [1479, 1479], [1536, 1541], [1552, 1562], [1564, 1564], [1611, 1631], [1648, 1648], [1750, 1757], [1759, 1764], [1767, 1768], [1770, 1773], [1807, 1807], [1809, 1809], [1840, 1866], [1958, 1968], [2027, 2035], [2045, 2045], [2070, 2073], [2075, 2083], [2085, 2087], [2089, 2093], [2137, 2139], [2192, 2193], [2200, 2207], [2250, 2307], [2362, 2364], [2366, 2383], [2385, 2391], [2402, 2403], [2433, 2435], [2492, 2492], [2494, 2500], [2503, 2504], [2507, 2509], [2519, 2519], [2530, 2531], [2558, 2558], [2561, 2563], [2620, 2620], [2622, 2626], [2631, 2632], [2635, 2637], [2641, 2641], [2672, 2673], [2677, 2677], [2689, 2691], [2748, 2748], [2750, 2757], [2759, 2761], [2763, 2765], [2786, 2787], [2810, 2815], [2817, 2819], [2876, 2876], [2878, 2884], [2887, 2888], [2891, 2893], [2901, 2903], [2914, 2915], [2946, 2946], [3006, 3010], [3014, 3016], [3018, 3021], [3031, 3031], [3072, 3076], [3132, 3132], [3134, 3140], [3142, 3144], [3146, 3149], [3157, 3158], [3170, 3171], [3201, 3203], [3260, 3260], [3262, 3268], [3270, 3272], [3274, 3277], [3285, 3286], [3298, 3299], [3315, 3315], [3328, 3331], [3387, 3388], [3390, 3396], [3398, 3400], [3402, 3405], [3415, 3415], [3426, 3427], [3457, 3459], [3530, 3530], [3535, 3540], [3542, 3542], [3544, 3551], [3570, 3571], [3633, 3633], [3636, 3642], [3655, 3662], [3761, 3761], [3764, 3772], [3784, 3790], [3864, 3865], [3893, 3893], [3895, 3895], [3897, 3897], [3902, 3903], [3953, 3972], [3974, 3975], [3981, 3991], [3993, 4028], [4038, 4038], [4139, 4158], [4182, 4185], [4190, 4192], [4194, 4196], [4199, 4205], [4209, 4212], [4226, 4237], [4239, 4239], [4250, 4253], [4957, 4959], [5906, 5909], [5938, 5940], [5970, 5971], [6002, 6003], [6068, 6099], [6109, 6109], [6155, 6159], [6277, 6278], [6313, 6313], [6432, 6443], [6448, 6459], [6679, 6683], [6741, 6750], [6752, 6780], [6783, 6783], [6832, 6862], [6912, 6916], [6964, 6980], [7019, 7027], [7040, 7042], [7073, 7085], [7142, 7155], [7204, 7223], [7376, 7378], [7380, 7400], [7405, 7405], [7412, 7412], [7415, 7417], [7616, 7679], [8203, 8207], [8234, 8238], [8288, 8292], [8294, 8303], [8400, 8432], [11503, 11505], [11647, 11647], [11744, 11775], [12330, 12335], [12441, 12442], [42607, 42610], [42612, 42621], [42654, 42655], [42736, 42737], [43010, 43010], [43014, 43014], [43019, 43019], [43043, 43047], [43052, 43052], [43136, 43137], [43188, 43205], [43232, 43249], [43263, 43263], [43302, 43309], [43335, 43347], [43392, 43395], [43443, 43456], [43493, 43493], [43561, 43574], [43587, 43587], [43596, 43597], [43643, 43645], [43696, 43696], [43698, 43700], [43703, 43704], [43710, 43711], [43713, 43713], [43755, 43759], [43765, 43766], [44003, 44010], [44012, 44013], [64286, 64286], [65024, 65039], [65056, 65071], [65279, 65279], [65529, 65531], [66045, 66045], [66272, 66272], [66422, 66426], [68097, 68099], [68101, 68102], [68108, 68111], [68152, 68154], [68159, 68159], [68325, 68326], [68900, 68903], [69291, 69292], [69373, 69375], [69446, 69456], [69506, 69509], [69632, 69634], [69688, 69702], [69744, 69744], [69747, 69748], [69759, 69762], [69808, 69818], [69821, 69821], [69826, 69826], [69837, 69837], [69888, 69890], [69927, 69940], [69957, 69958], [70003, 70003], [70016, 70018], [70067, 70080], [70089, 70092], [70094, 70095], [70188, 70199], [70206, 70206], [70209, 70209], [70367, 70378], [70400, 70403], [70459, 70460], [70462, 70468], [70471, 70472], [70475, 70477], [70487, 70487], [70498, 70499], [70502, 70508], [70512, 70516], [70709, 70726], [70750, 70750], [70832, 70851], [71087, 71093], [71096, 71104], [71132, 71133], [71216, 71232], [71339, 71351], [71453, 71467], [71724, 71738], [71984, 71989], [71991, 71992], [71995, 71998], [72e3, 72e3], [72002, 72003], [72145, 72151], [72154, 72160], [72164, 72164], [72193, 72202], [72243, 72249], [72251, 72254], [72263, 72263], [72273, 72283], [72330, 72345], [72751, 72758], [72760, 72767], [72850, 72871], [72873, 72886], [73009, 73014], [73018, 73018], [73020, 73021], [73023, 73029], [73031, 73031], [73098, 73102], [73104, 73105], [73107, 73111], [73459, 73462], [73472, 73473], [73475, 73475], [73524, 73530], [73534, 73538], [78896, 78912], [78919, 78933], [92912, 92916], [92976, 92982], [94031, 94031], [94033, 94087], [94095, 94098], [94180, 94180], [94192, 94193], [113821, 113822], [113824, 113827], [118528, 118573], [118576, 118598], [119141, 119145], [119149, 119170], [119173, 119179], [119210, 119213], [119362, 119364], [121344, 121398], [121403, 121452], [121461, 121461], [121476, 121476], [121499, 121503], [121505, 121519], [122880, 122886], [122888, 122904], [122907, 122913], [122915, 122916], [122918, 122922], [123023, 123023], [123184, 123190], [123566, 123566], [123628, 123631], [124140, 124143], [125136, 125142], [125252, 125258], [917505, 917505], [917536, 917631], [917760, 917999]]
};

// src/core/errors.mjs
var RoomError = class extends Error {
  constructor(code, message, details = {}, status = 400) {
    super(message);
    this.name = "RoomError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
};
function fail(code, message, details = {}, status = 400) {
  throw new RoomError(code, message, details, status);
}
function asRoomError(error) {
  return error instanceof RoomError ? error : new RoomError("ROOM_INTERNAL_ERROR", error?.message || "Unexpected room error", {}, 500);
}

// src/core/display-width.mjs
var Graphemer = import_graphemer.default;
while (Graphemer?.default) Graphemer = Graphemer.default;
var emojiRegex = import_emoji_regex.default;
while (emojiRegex?.default) emojiRegex = emojiRegex.default;
var splitter = new Graphemer();
var emoji = new RegExp(emojiRegex().source, "u");
var UNICODE_IMPLEMENTATION = "Unicode 15.0.0 + graphemer@1.4.0 + emoji-regex@10.2.0";
var MAX_AGENT_MESSAGE_WIDTH = 100;
function inRanges(codePoint, ranges) {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = low + high >> 1;
    const [start, end] = ranges[middle];
    if (codePoint < start) high = middle - 1;
    else if (codePoint > end) low = middle + 1;
    else return true;
  }
  return false;
}
function displayWidth(input) {
  let width = 0;
  for (const grapheme of splitter.splitGraphemes(String(input))) {
    if (grapheme === "\r\n" || grapheme === "\n" || grapheme === "\r" || grapheme === "	") {
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
      if (!inRanges(codePoint, unicode_15_default.zeroWidth)) {
        glyph = codePoint;
        break;
      }
    }
    if (glyph == null) continue;
    width += inRanges(glyph, unicode_15_default.wide) ? 2 : 1;
  }
  return width;
}
function assertAgentWidth(text, label = "message") {
  const actual = displayWidth(text);
  if (actual > MAX_AGENT_MESSAGE_WIDTH) {
    throw new RoomError("ROOM_MESSAGE_TOO_LONG", `${label} display width ${actual}; max ${MAX_AGENT_MESSAGE_WIDTH}. Shorten and retry.`, { actual, max: MAX_AGENT_MESSAGE_WIDTH }, 422);
  }
  return actual;
}

// src/core/room-store.mjs
var RULES_VERSION = "room-rules-2026-11-26";
var ROLE_LABELS = { generic: "\u901A\u7528", proposer: "\u63D0\u6848\u8005", reviewer: "\u5BA1\u67E5\u8005", moderator: "\u4E3B\u6301\u4EBA" };
var QUESTION_STATUSES = /* @__PURE__ */ new Set(["pending", "answered", "withdrawn"]);
var ROLE_INSTRUCTIONS = {
  generic: "",
  proposer: "\u4FDD\u6301\u70ED\u60C5\u548C\u6D3B\u529B\uFF0C\u6562\u4E8E\u63D0\u51FA\u660E\u663E\u4E0D\u540C\u7684\u8DEF\u7EBF\u548C\u5927\u80C6\u6784\u60F3\uFF0C\u518D\u8BF4\u660E\u5173\u952E\u5047\u8BBE\u548C\u53D6\u820D\u3002\u533A\u5206\u60F3\u8C61\u4E0E\u8BC1\u636E\uFF0C\u9047\u5230\u6709\u6548\u53CD\u4F8B\u5C31\u4FEE\u8BA2\uFF1B\u70ED\u60C5\u4E0D\u7B49\u4E8E\u5FC5\u987B\u591A\u53D1\u5E16\u3002",
  reviewer: "\u517C\u505A\u6838\u9A8C\u3002\u68C0\u67E5\u5173\u952E\u5047\u8BBE\uFF0C\u6309\u9700\u67E5\u8D44\u6599\u3001\u627E\u53CD\u4F8B\u6216\u8DD1\u6D4B\u8BD5\u3002\u8BF4\u6E05\u5DF2\u9A8C\u8BC1\u7684\u7ED3\u8BBA\u3001\u5C1A\u672A\u786E\u8BA4\u7684\u98CE\u9669\uFF0C\u4EE5\u53CA\u4EC0\u4E48\u8BC1\u636E\u80FD\u6539\u53D8\u5224\u65AD\uFF1B\u4E0D\u4E3A\u53CD\u5BF9\u800C\u53CD\u5BF9\u3002",
  moderator: "\u6839\u636E\u8BFB\u5230\u7684\u53D1\u8A00\u5F52\u7EB3\u5171\u8BC6\u3001\u5206\u6B67\u548C\u4E0B\u4E00\u6B65\u3002\u8BA8\u8BBA\u8DD1\u9898\u6216\u91CD\u590D\u65F6\uFF0C\u6307\u51FA\u5DF2\u8BA8\u8BBA\u8FC7\u7684\u5185\u5BB9\u5E76\u62C9\u56DE\u5C1A\u672A\u89E3\u51B3\u7684\u95EE\u9898\u3002\u6210\u5458\u7070\u5FC3\u6216\u8FF7\u832B\u65F6\u80AF\u5B9A\u5DF2\u6709\u8FDB\u5C55\uFF0C\u5FC5\u8981\u65F6\u5EFA\u8BAE\u5BB9\u6613\u5C1D\u8BD5\u7684\u4E0B\u4E00\u6B65\u3002\u4E0D\u4EE3\u66FF\u6210\u5458\u51B3\u5B9A\uFF0C\u4E0D\u628A\u6C89\u9ED8\u5F53\u6210\u540C\u610F\u3002"
};
var COMMON_RULES = `\u6536\u5230\u623F\u95F4\u63D0\u9192\u540E\uFF0C\u5148\u8BFB\u76F8\u5173\u672A\u8BFB\u6D88\u606F\uFF08\u53EF\u7528 room_unread()\uFF09\u3002\u88AB\u5524\u9192\u3001\u88AB @ \u6216\u8BFB\u5B8C\u6D88\u606F\uFF0C\u90FD\u4E0D\u8981\u6C42\u4F60\u53D1\u8A00\u3002\u6709\u65B0\u89C2\u70B9\u3001\u8BC1\u636E\u3001\u53CD\u4F8B\u6216\u503C\u5F97\u56DE\u7B54\u7684\u95EE\u9898\u65F6\u518D\u53D1\u5E16\u3002\u6CA1\u6709\u65B0\u5185\u5BB9\uFF0C\u5C31\u7EE7\u7EED\u539F\u4EFB\u52A1\u6216\u7ED3\u675F\u672C\u8F6E\uFF1B\u4E0D\u8981\u53EA\u56DE\u300C\u6536\u5230\u300D\u6216\u91CD\u590D\u522B\u4EBA\u7684\u7ED3\u8BBA\u3002
\u9700\u8981\u5BF9\u65B9\u5C3D\u5FEB\u6CE8\u610F\u65F6\uFF0C\u4ECE\u4F1A\u8BDD\u6307\u4EE4\u91CC\u7684\u6210\u5458\u540D\u5355\u627E\u5230\u5BF9\u65B9\u7684 ID\uFF0C\u518D\u7528 room_post \u6216 room_ask \u7684 mentionMemberIds \u70B9\u540D\u3002\u9700\u8981\u91CD\u67E5\u540D\u5355\u65F6\u7528 room_members()\u3002\u53EA\u5728\u6B63\u6587\u5199 @\u663E\u793A\u540D \u4E0D\u4F1A\u70B9\u540D\u3002\u666E\u901A\u63A5\u8BDD\u7528 replyToMessageId \u5F15\u7528\u5373\u53EF\uFF1B\u53EA\u6709\u786E\u5B9E\u9700\u8981\u901A\u77E5\u6240\u6709\u4EBA\u624D\u4F20 mentionAll: true\u3002
\u9700\u8981\u771F\u4EBA\u56DE\u7B54\u65F6\u7528 room_ask\uFF0C\u5305\u62EC\u5355\u9009\u95EE\u9898\uFF1B\u53EA\u6709\u771F\u4EBA\u53EF\u4EE5\u6B63\u5F0F\u4F5C\u7B54\u3002\u95EE\u540C\u4F34\u7528 room_post\uFF0C\u9700\u8981\u5C3D\u5FEB\u6CE8\u610F\u65F6\u624D\u70B9\u540D\u3002\u4E0D\u8981\u5728\u72EC\u7ACB\u4F1A\u8BDD\u4E2D\u8C03\u7528 OpenCode \u539F\u751F\u63D0\u95EE\u5DE5\u5177\uFF1B\u53D1\u51FA\u623F\u95F4\u95EE\u9898\u540E\u53EF\u7EE7\u7EED\u5DE5\u4F5C\u6216\u7ED3\u675F\u672C\u8F6E\u3002
\u8BFB\u5B8C\u4F46\u4E0D\u53D1\u5E16\u662F\u6B63\u5E38\u884C\u4E3A\uFF0C\u4E0D\u9700\u8981\u53D1\u300C\u8DF3\u8FC7\u300D\u6D88\u606F\uFF0C\u4E5F\u4E0D\u89E6\u53D1\u5176\u4ED6\u6210\u5458\u3002\u6CA1\u8BFB\u5C31\u7ED3\u675F\u4ECD\u4F1A\u6309\u672A\u8BFB\u89C4\u5219\u63D0\u9192\uFF1B\u6C89\u9ED8\u4E0D\u6539\u53D8\u5DF2\u8BFB\u72B6\u6001\uFF0C\u4E0D\u8868\u793A\u540C\u610F\u3002`;
var SCENARIO_INSTRUCTIONS = {
  debate: "\u5F53\u524D\u662F\u53CC\u6A21\u578B\u8FA9\u8BBA\u3002\u521D\u59CB\u7ACB\u573A\u53EA\u662F\u8D77\u70B9\uFF0C\u53EF\u968F\u8BC1\u636E\u53D8\u5316\u3002\u6BCF\u5E16\u53EA\u5199\u4E00\u4E2A\u4E3B\u5F20\u3001\u53CD\u4F8B\u6216\u4FEE\u8BA2\uFF1B\u4F18\u5148\u5F15\u7528\u5BF9\u65B9\u539F\u5E16\u3002\u6CA1\u6709\u65B0\u5185\u5BB9\u53EF\u4EE5\u6C89\u9ED8\u3002\u6536\u5C3E\u65F6\u5404\u53D1\u4E00\u6761\u603B\u7ED3\uFF0C\u8BF4\u660E\u4FEE\u6539\u4E86\u4EC0\u4E48\u6216\u4ECD\u5206\u6B67\u5728\u54EA\u91CC\u3002"
};
function json(value) {
  return JSON.stringify(value);
}
function parse(value, fallback = null) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function id(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}
function cleanText(value, label, { required = true, maxChars = 2e4 } = {}) {
  if (typeof value !== "string") fail("ROOM_INVALID_INPUT", `${label} must be a string.`);
  const text = value.trim();
  if (required && !text) fail("ROOM_INVALID_INPUT", `${label} must not be empty.`);
  if (text.length > maxChars) fail("ROOM_INVALID_INPUT", `${label} is too long.`, { maxChars });
  return text;
}
function page(value, fallback, max) {
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) fail("ROOM_INVALID_INPUT", `limit must be between 1 and ${max}.`);
  return number;
}
function snippet(text, query, length = 180) {
  if (!query) return text.slice(0, length) + (text.length > length ? "\u2026" : "");
  const at = text.indexOf(query);
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, start + length);
  return `${start > 0 ? "\u2026" : ""}${text.slice(start, end)}${end < text.length ? "\u2026" : ""}`;
}
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var RoomStore = class {
  constructor(filename = ":memory:") {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    this.migrate();
  }
  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY, project_dir TEXT NOT NULL, title TEXT NOT NULL, preset TEXT NOT NULL,
        status TEXT NOT NULL, created_at TEXT NOT NULL, started_at TEXT, ended_at TEXT,
        paused_reason TEXT, human_id TEXT NOT NULL, human_name TEXT NOT NULL,
        budget_period INTEGER NOT NULL DEFAULT 1, budget_limit INTEGER NOT NULL DEFAULT 50,
        budget_remaining INTEGER NOT NULL DEFAULT 50, temp_root TEXT NOT NULL,
        workspace_dir TEXT NOT NULL, config_json TEXT NOT NULL, rules_version TEXT NOT NULL,
        root_session_id TEXT, root_creation_status TEXT NOT NULL DEFAULT 'pending', root_creation_error TEXT,
        root_next_attempt_at TEXT, root_task_attempts INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), kind TEXT NOT NULL,
        display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'generic', model_json TEXT,
        session_id TEXT, creation_status TEXT NOT NULL DEFAULT 'pending', creation_error TEXT,
        instructions_added INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
        last_check_at TEXT, execution_round INTEGER NOT NULL DEFAULT 0,
        idle_epoch INTEGER NOT NULL DEFAULT 0, last_status TEXT,
        last_started_event TEXT, last_terminal_round INTEGER NOT NULL DEFAULT -1,
        next_attempt_at TEXT, task_error TEXT, task_attempts INTEGER NOT NULL DEFAULT 0,
        session_linked INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS members_session ON members(session_id) WHERE session_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), room_seq INTEGER NOT NULL,
        kind TEXT NOT NULL, author_id TEXT NOT NULL, text TEXT NOT NULL, options_json TEXT,
        reply_to_id TEXT, mention_all INTEGER NOT NULL DEFAULT 0, question_id TEXT,
        created_at TEXT NOT NULL, UNIQUE(room_id, room_seq)
      );
      CREATE INDEX IF NOT EXISTS messages_room_seq ON messages(room_id, room_seq);
      CREATE TABLE IF NOT EXISTS message_mentions (
        message_id TEXT NOT NULL REFERENCES messages(id), member_id TEXT NOT NULL REFERENCES members(id),
        PRIMARY KEY(message_id, member_id)
      );
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), message_id TEXT NOT NULL UNIQUE REFERENCES messages(id),
        asker_id TEXT NOT NULL REFERENCES members(id), status TEXT NOT NULL, options_json TEXT,
        answer_message_id TEXT REFERENCES messages(id), withdraw_note TEXT,
        withdraw_reply_id TEXT REFERENCES messages(id), duplicate_of_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS read_receipts (
        message_id TEXT NOT NULL REFERENCES messages(id), member_id TEXT NOT NULL REFERENCES members(id),
        source TEXT NOT NULL, read_at TEXT NOT NULL, PRIMARY KEY(message_id, member_id)
      );
      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), member_id TEXT NOT NULL REFERENCES members(id),
        kind TEXT NOT NULL CHECK(kind IN ('queue','steer')), status TEXT NOT NULL,
        trigger_key TEXT NOT NULL, snapshot_seq INTEGER NOT NULL, execution_round INTEGER NOT NULL,
        idle_epoch INTEGER NOT NULL, budget_period INTEGER NOT NULL, input_id TEXT NOT NULL UNIQUE,
        unread_count INTEGER NOT NULL DEFAULT 0, unread_mention_count INTEGER NOT NULL DEFAULT 0,
        reason TEXT, answer_message_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, lease_until TEXT,
        next_attempt_at TEXT, charged INTEGER NOT NULL DEFAULT 0,
        refunded INTEGER NOT NULL DEFAULT 0, charged_period INTEGER,
        UNIQUE(member_id, trigger_key, kind)
      );
      CREATE INDEX IF NOT EXISTS reminders_dispatch ON reminders(status, created_at);
      CREATE TABLE IF NOT EXISTS budget_periods (
        room_id TEXT NOT NULL, period INTEGER NOT NULL, limit_count INTEGER NOT NULL,
        started_at TEXT NOT NULL, ended_at TEXT, reason TEXT, used_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(room_id, period)
      );
      CREATE TABLE IF NOT EXISTS presentations (
        id TEXT PRIMARY KEY, room_id TEXT NOT NULL, member_id TEXT NOT NULL,
        message_ids_json TEXT NOT NULL, created_at TEXT NOT NULL, observed_at TEXT, confirmed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS diagnostics (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT, member_id TEXT, session_id TEXT,
        kind TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS config_events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, kind TEXT NOT NULL,
        before_json TEXT, after_json TEXT, created_at TEXT NOT NULL
      );
    `);
    const previousSchema = this.db.prepare("SELECT value FROM meta WHERE key='schema'").get()?.value || "0";
    const roomColumns = new Set(this.db.prepare("PRAGMA table_info(rooms)").all().map((row) => row.name));
    for (const [name, definition] of Object.entries({
      root_session_id: "TEXT",
      root_creation_status: "TEXT NOT NULL DEFAULT 'pending'",
      root_creation_error: "TEXT",
      root_next_attempt_at: "TEXT",
      root_task_attempts: "INTEGER NOT NULL DEFAULT 0"
    })) {
      if (!roomColumns.has(name)) this.db.exec(`ALTER TABLE rooms ADD COLUMN ${name} ${definition}`);
    }
    const reminderColumns = new Set(this.db.prepare("PRAGMA table_info(reminders)").all().map((row) => row.name));
    for (const [name, definition] of Object.entries({ lease_until: "TEXT", next_attempt_at: "TEXT", charged: "INTEGER NOT NULL DEFAULT 0", refunded: "INTEGER NOT NULL DEFAULT 0", charged_period: "INTEGER" })) {
      if (!reminderColumns.has(name)) this.db.exec(`ALTER TABLE reminders ADD COLUMN ${name} ${definition}`);
    }
    const memberColumns = new Set(this.db.prepare("PRAGMA table_info(members)").all().map((row) => row.name));
    for (const [name, definition] of Object.entries({ next_attempt_at: "TEXT", task_error: "TEXT", task_attempts: "INTEGER NOT NULL DEFAULT 0", session_linked: "INTEGER NOT NULL DEFAULT 0" })) {
      if (!memberColumns.has(name)) this.db.exec(`ALTER TABLE members ADD COLUMN ${name} ${definition}`);
    }
    const presentationColumns = new Set(this.db.prepare("PRAGMA table_info(presentations)").all().map((row) => row.name));
    if (!presentationColumns.has("observed_at")) this.db.exec("ALTER TABLE presentations ADD COLUMN observed_at TEXT");
    const periodColumns = new Set(this.db.prepare("PRAGMA table_info(budget_periods)").all().map((row) => row.name));
    if (!periodColumns.has("used_count")) this.db.exec("ALTER TABLE budget_periods ADD COLUMN used_count INTEGER NOT NULL DEFAULT 0");
    if (previousSchema !== "3") {
      this.db.exec(`
        UPDATE reminders SET charged=0 WHERE refunded=1;
        UPDATE reminders SET charged=0,refunded=1 WHERE status IN ('failed','covered','cancelled');
        UPDATE reminders SET charged=1,refunded=0,
          charged_period=(SELECT budget_period FROM rooms WHERE rooms.id=reminders.room_id)
          WHERE status IN ('reserved','submitting','unknown','accepted') AND charged=0 AND refunded=0;
        UPDATE budget_periods SET used_count=(SELECT COUNT(*) FROM reminders r
          WHERE r.room_id=budget_periods.room_id AND r.budget_period=budget_periods.period AND r.charged=1 AND r.refunded=0);
        UPDATE rooms SET budget_remaining=MAX(0,budget_limit-(SELECT used_count FROM budget_periods
          WHERE budget_periods.room_id=rooms.id AND budget_periods.period=rooms.budget_period));
      `);
    }
    this.db.prepare("INSERT INTO meta(key,value) VALUES('schema','4') ON CONFLICT(key) DO UPDATE SET value='4'").run();
  }
  close() {
    this.db.close();
  }
  tx(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
  }
  room(id2) {
    const row = this.db.prepare("SELECT * FROM rooms WHERE id=?").get(id2);
    if (!row) fail("ROOM_NOT_FOUND", "Room not found.", { roomId: id2 }, 404);
    return row;
  }
  member(id2) {
    const row = this.db.prepare("SELECT * FROM members WHERE id=?").get(id2);
    if (!row) fail("ROOM_NOT_FOUND", "Member not found.", { memberId: id2 }, 404);
    return row;
  }
  memberBySession(sessionID) {
    const row = this.db.prepare("SELECT * FROM members WHERE session_id=?").get(sessionID);
    if (!row) fail("ROOM_SESSION_NOT_MEMBER", "This OpenCode session is not a member of a discussion room.", {}, 403);
    return row;
  }
  message(messageId) {
    const row = this.db.prepare("SELECT * FROM messages WHERE id=?").get(messageId);
    if (!row) fail("ROOM_MESSAGE_NOT_FOUND", "Message not found.", { messageId }, 404);
    return row;
  }
  agents(roomId) {
    return this.db.prepare("SELECT * FROM members WHERE room_id=? AND kind='agent' ORDER BY created_at").all(roomId);
  }
  listRooms(projectDir = null) {
    const rows = projectDir ? this.db.prepare("SELECT * FROM rooms WHERE project_dir=? ORDER BY created_at DESC").all(projectDir) : this.db.prepare("SELECT * FROM rooms ORDER BY created_at DESC").all();
    return rows.map((row) => this.roomSummary(row));
  }
  roomSummary(room) {
    const members = this.db.prepare("SELECT * FROM members WHERE room_id=? AND kind='agent' ORDER BY created_at").all(room.id);
    const latest = this.db.prepare("SELECT MAX(room_seq) AS seq FROM messages WHERE room_id=?").get(room.id);
    const pending = this.db.prepare("SELECT COUNT(*) AS count FROM questions WHERE room_id=? AND status='pending'").get(room.id);
    return {
      roomId: room.id,
      title: room.title,
      projectDir: room.project_dir,
      preset: room.preset,
      status: room.status,
      pausedReason: room.paused_reason,
      createdAt: room.created_at,
      startedAt: room.started_at,
      endedAt: room.ended_at,
      latestSeq: latest.seq || 0,
      rootSessionId: room.root_session_id,
      rootCreationStatus: room.root_creation_status,
      rootCreationError: room.root_creation_error,
      pendingQuestions: pending.count,
      human: { memberId: room.human_id, displayName: room.human_name, kind: "human" },
      members: members.map((member) => this.memberView(member)),
      budget: { period: room.budget_period, limit: room.budget_limit, remaining: room.budget_remaining, used: room.budget_limit - room.budget_remaining },
      workspaceDir: room.workspace_dir,
      tempRoot: room.temp_root,
      rulesVersion: room.rules_version
    };
  }
  memberView(member) {
    return {
      memberId: member.id,
      displayName: member.display_name,
      kind: member.kind,
      role: member.role,
      roleLabel: ROLE_LABELS[member.role] || member.role,
      model: parse(member.model_json),
      sessionId: member.session_id,
      creationStatus: member.creation_status,
      creationError: member.creation_error,
      taskError: member.task_error,
      sessionLinked: member.session_linked === 1,
      sessionStatus: member.last_status || "unknown"
    };
  }
  createRoom(input, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const projectDir = cleanText(input.projectDir, "projectDir", { maxChars: 4096 });
    const title = cleanText(input.title || "\u65B0\u7684\u8BA8\u8BBA\u5BA4", "title", { maxChars: 120 });
    const preset = ["generic", "debate"].includes(input.preset) ? input.preset : "generic";
    const specs = input.members;
    if (!Array.isArray(specs) || specs.length < 2 || specs.length > 8) fail("ROOM_INVALID_INPUT", "A room needs 2 to 8 agents.");
    if (specs.some((spec) => spec.kind && spec.kind !== "agent")) fail("ROOM_INVALID_INPUT", "New rooms only create agent sessions.");
    const names = /* @__PURE__ */ new Set();
    const members = specs.map((spec, index) => {
      const role = Object.hasOwn(ROLE_LABELS, spec.role) ? spec.role : "generic";
      const base = role === "generic" ? `Agent ${index + 1}` : ROLE_LABELS[role];
      let displayName = base;
      for (let suffix = 2; names.has(displayName.trim().toLowerCase()); suffix += 1) displayName = `${base} ${suffix}`;
      if (spec.displayName != null) displayName = cleanText(spec.displayName, "displayName", { maxChars: 80 });
      const key = displayName.trim().toLowerCase();
      if (names.has(key)) fail("ROOM_DUPLICATE_NAME", "Member display names must be unique.", { displayName });
      names.add(key);
      const model = spec.model;
      if (!model || typeof model.providerID !== "string" || typeof model.id !== "string") fail("ROOM_INVALID_INPUT", "Every agent needs a providerID and model id.");
      return { id: id("m"), role, displayName, model: { providerID: model.providerID, id: model.id, name: model.name || model.id, ...model.variant ? { variant: model.variant } : {} } };
    });
    const roomId = id("r");
    const rootSessionId = `ses_disc_${roomId}_root`;
    const humanName = cleanText(input.humanName || "\u623F\u4E3B", "humanName", { maxChars: 80 });
    if (names.has(humanName.trim().toLowerCase())) fail("ROOM_DUPLICATE_NAME", "The host display name must differ from agent names.", { displayName: humanName });
    const tempRoot = cleanText(input.tempRoot, "tempRoot", { maxChars: 4096 });
    const workspaceDir = join(tempRoot, "Discussions", roomId);
    mkdirSync(workspaceDir, { recursive: true });
    const limit = Number.isInteger(input.budgetLimit) && input.budgetLimit > 0 ? input.budgetLimit : preset === "debate" ? 12 : 50;
    const config = { preset, budgetLimit: limit, roles: RULES_VERSION, members: members.map(({ memberId, ...member }) => member) };
    return this.tx(() => {
      this.db.prepare(`INSERT INTO rooms(id,project_dir,title,preset,status,created_at,human_id,human_name,budget_period,budget_limit,budget_remaining,temp_root,workspace_dir,config_json,rules_version,root_session_id,root_creation_status)
        VALUES(?,?,?,?,'creating',?,?,?,1,?,?,?,?,?,?,?,'pending')`).run(roomId, projectDir, title, preset, now, id("h"), humanName, limit, limit, tempRoot, workspaceDir, json(config), RULES_VERSION, rootSessionId);
      const humanId = this.db.prepare("SELECT human_id FROM rooms WHERE id=?").get(roomId).human_id;
      this.db.prepare(`INSERT INTO members(id,room_id,kind,display_name,role,creation_status,created_at) VALUES(?,?,'human',?,'host','ready',?)`).run(humanId, roomId, humanName, now);
      const insert = this.db.prepare(`INSERT INTO members(id,room_id,kind,display_name,role,model_json,creation_status,created_at) VALUES(?,?,'agent',?,?,?,'pending',?)`);
      for (const member of members) insert.run(member.id, roomId, member.displayName, member.role, json(member.model), now);
      this.db.prepare("INSERT INTO budget_periods(room_id,period,limit_count,started_at) VALUES(?,?,?,?)").run(roomId, 1, limit, now);
      this.configEvent(roomId, "room-created", null, config, now);
      return this.roomSummary(this.room(roomId));
    });
  }
  retryCreation(roomId) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    return this.tx(() => {
      const ready = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent' AND creation_status='ready'").get(roomId).count;
      const total = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent'").get(roomId).count;
      if (ready === total) {
        this.db.prepare("UPDATE rooms SET status='ready',paused_reason=NULL WHERE id=? AND status='creating'").run(roomId);
        return this.roomSummary(this.room(roomId));
      }
      this.db.prepare("UPDATE rooms SET status='creating', paused_reason=NULL WHERE id=?").run(roomId);
      this.db.prepare("UPDATE members SET creation_error=NULL,creation_status='pending',next_attempt_at=NULL,task_error=NULL WHERE room_id=? AND session_id IS NULL").run(roomId);
      this.db.prepare("UPDATE members SET creation_error=NULL,instructions_added=0,next_attempt_at=NULL,task_error=NULL WHERE room_id=? AND session_id IS NOT NULL AND creation_status<>'ready'").run(roomId);
      this.db.prepare("UPDATE rooms SET root_creation_status=CASE WHEN root_creation_status='ready' THEN 'ready' ELSE 'pending' END,root_creation_error=NULL,root_next_attempt_at=NULL WHERE id=?").run(roomId);
      return this.roomSummary(this.room(roomId));
    });
  }
  prepareRoomRoot(roomId) {
    const room = this.room(roomId);
    if (room.root_session_id) return room;
    const rootSessionId = `ses_disc_${roomId}_root`;
    this.db.prepare("UPDATE rooms SET root_session_id=?,root_creation_status=CASE WHEN root_creation_status='ready' THEN 'pending' ELSE root_creation_status END WHERE id=? AND root_session_id IS NULL").run(rootSessionId, roomId);
    return this.room(roomId);
  }
  rootTaskAttempt(roomId, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const retryAt = new Date(Date.parse(now) + 5e3).toISOString();
    this.db.prepare("UPDATE rooms SET root_task_attempts=root_task_attempts+1,root_next_attempt_at=? WHERE id=?").run(retryAt, roomId);
  }
  rootSessionCreated(roomId, sessionID, now = (/* @__PURE__ */ new Date()).toISOString()) {
    this.room(roomId);
    if (typeof sessionID !== "string" || !sessionID) throw new Error("Room root session creation returned no session ID");
    this.db.prepare("UPDATE rooms SET root_session_id=?,root_creation_status='ready',root_creation_error=NULL,root_next_attempt_at=NULL WHERE id=?").run(sessionID, roomId);
  }
  rootSessionFailed(roomId, message, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const room = this.room(roomId);
    const attempts = room.root_task_attempts;
    const delay = Math.min(6e4, 5e3 * Math.max(1, attempts));
    const retryAt = new Date(Date.parse(now) + delay).toISOString();
    this.db.prepare("UPDATE rooms SET root_creation_status='failed',root_creation_error=?,root_next_attempt_at=? WHERE id=?").run(String(message).slice(0, 2e3), retryAt, roomId);
  }
  resetMissingRoot(roomId) {
    const room = this.room(roomId);
    if (room.root_creation_status !== "ready" || !room.root_session_id) return false;
    this.db.prepare("UPDATE rooms SET root_creation_status='pending',root_creation_error='\u6839\u4F1A\u8BDD\u4E0D\u5B58\u5728\uFF0C\u6B63\u5728\u91CD\u5EFA',root_next_attempt_at=NULL WHERE id=?").run(roomId);
    this.db.prepare("UPDATE members SET session_linked=0 WHERE room_id=? AND kind='agent' AND session_id IS NOT NULL").run(roomId);
    return true;
  }
  sessionLinked(roomId, memberId) {
    this.room(roomId);
    this.member(memberId);
    this.db.prepare("UPDATE members SET session_linked=1,next_attempt_at=NULL,task_error=NULL WHERE id=? AND room_id=?").run(memberId, roomId);
  }
  sessionCreated(roomId, memberId, sessionID, now = (/* @__PURE__ */ new Date()).toISOString()) {
    this.room(roomId);
    this.member(memberId);
    this.tx(() => {
      this.db.prepare("UPDATE members SET session_id=?,creation_status='session-created',creation_error=NULL,next_attempt_at=NULL,task_error=NULL,session_linked=1 WHERE id=? AND room_id=? AND session_id IS NULL").run(sessionID, memberId, roomId);
      this.finishCreationIfReady(roomId, now);
    });
  }
  sessionFailed(roomId, memberId, message) {
    this.room(roomId);
    this.member(memberId);
    this.db.prepare("UPDATE members SET creation_status='failed',creation_error=?,next_attempt_at=NULL,task_error=? WHERE id=? AND room_id=? AND session_id IS NULL").run(String(message).slice(0, 2e3), String(message).slice(0, 2e3), memberId, roomId);
  }
  taskAttempt(roomId, memberId, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const retryAt = new Date(Date.parse(now) + 5e3).toISOString();
    this.db.prepare("UPDATE members SET task_attempts=task_attempts+1,next_attempt_at=? WHERE id=? AND room_id=?").run(retryAt, memberId, roomId);
  }
  taskSucceeded(roomId, memberId) {
    this.db.prepare("UPDATE members SET next_attempt_at=NULL,task_error=NULL WHERE id=? AND room_id=?").run(memberId, roomId);
  }
  taskFailed(roomId, memberId, message, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const member = this.member(memberId);
    const attempts = member.task_attempts;
    const delay = Math.min(6e4, 5e3 * Math.max(1, attempts));
    const retryAt = new Date(Date.parse(now) + delay).toISOString();
    const creationError = member.creation_status === "ready" ? member.creation_error : String(message).slice(0, 2e3);
    this.db.prepare("UPDATE members SET next_attempt_at=?,task_error=?,creation_error=? WHERE id=? AND room_id=?").run(retryAt, String(message).slice(0, 2e3), creationError, memberId, roomId);
  }
  instructionsAdded(roomId, memberId) {
    this.member(memberId);
    this.tx(() => {
      this.db.prepare("UPDATE members SET instructions_added=1,creation_status='ready',creation_error=NULL,next_attempt_at=NULL,task_error=NULL WHERE id=? AND room_id=?").run(memberId, roomId);
      this.finishCreationIfReady(roomId);
    });
  }
  instructionsRemoved(roomId, memberId) {
    this.member(memberId);
    this.db.prepare("UPDATE members SET instructions_added=0,next_attempt_at=NULL,task_error=NULL WHERE id=? AND room_id=?").run(memberId, roomId);
  }
  finishCreationIfReady(roomId, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const room = this.room(roomId);
    const count = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent' AND creation_status='ready'").get(roomId).count;
    const total = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent'").get(roomId).count;
    if (count === total && room.status === "creating") this.db.prepare("UPDATE rooms SET status='ready' WHERE id=?").run(roomId);
  }
  instructions(roomId, memberId) {
    const room = this.room(roomId);
    const self = this.member(memberId);
    const members = this.db.prepare("SELECT * FROM members WHERE room_id=? ORDER BY created_at,rowid").all(roomId);
    const agentIndex = members.filter((member) => member.kind === "agent").findIndex((member) => member.id === self.id);
    const debateStance = room.preset === "debate" && agentIndex === 0 ? "\u4F60\u7684\u521D\u59CB\u7ACB\u573A\uFF1A\u53EF\u4EE5\u9ED8\u8BA4\u91CD\u8BD5\u3002" : room.preset === "debate" && agentIndex === 1 ? "\u4F60\u7684\u521D\u59CB\u7ACB\u573A\uFF1A\u9ED8\u8BA4\u4E0D\u8981\u91CD\u8BD5\u3002" : "";
    const roster = [
      `\u4F60\u5728\u672C\u623F\u95F4\u662F${self.display_name}\uFF08Agent\uFF0C\u6210\u5458 ID \`${self.id}\`\uFF09\u3002\u663E\u793A\u540D\u4E0D\u662F\u8EAB\u4EFD\uFF1B\u5DE5\u5177\u8C03\u7528\u59CB\u7EC8\u4F7F\u7528\u8FD9\u4E2A\u7A33\u5B9A ID\u3002`,
      `\u623F\u95F4\u6210\u5458\u540D\u5355\uFF08\u623F\u4E3B\u786E\u8BA4\u540E\u7684\u663E\u793A\u540D\uFF09\uFF1A
${members.map((m) => `- ${m.display_name} \xB7 ${m.kind === "agent" ? "Agent" : "\u4EBA\u7C7B"}${m.kind === "human" ? " \xB7 \u623F\u4E3B\uFF08\u53EA\u6709\u771F\u4EBA\u80FD\u6B63\u5F0F\u56DE\u7B54\u623F\u95F4\u95EE\u9898\uFF09" : ""} \xB7 \u6210\u5458 ID \`${m.id}\``).join("\n")}`,
      `\u672C\u8BA8\u8BBA\u7684\u5171\u4EAB\u4E34\u65F6\u76EE\u5F55\uFF1A\`${room.workspace_dir}\`\u3002\u53EA\u628A\u8BA8\u8BBA\u6587\u6863\u5199\u5728\u8FD9\u91CC\uFF1B\u9879\u76EE\u5DE5\u4F5C\u76EE\u5F55\u53CA\u76F8\u5BF9\u8DEF\u5F84\u4FDD\u6301\u4E0D\u53D8\u3002\u5EFA\u8BAE\u6309\u89D2\u8272\u5EFA\u5B50\u76EE\u5F55\uFF0C\u907F\u514D\u540C\u540D\u8986\u76D6\u3002\u7ED9\u5176\u4ED6\u4EBA\u770B\u6587\u4EF6\u65F6\u8D34\u7EDD\u5BF9\u8DEF\u5F84\u3002`,
      ROLE_INSTRUCTIONS[self.role],
      debateStance,
      SCENARIO_INSTRUCTIONS[room.preset] || "",
      COMMON_RULES
    ].filter(Boolean).join("\n\n");
    return { key: "discussions.room", value: roster };
  }
  renameMember(roomId, memberId, displayName) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    const name = cleanText(displayName, "displayName", { maxChars: 80 });
    this.tx(() => {
      const before = this.member(memberId);
      if (before.room_id !== roomId) fail("ROOM_NOT_FOUND", "Member not found.", {}, 404);
      const duplicate = this.db.prepare("SELECT id FROM members WHERE room_id=? AND lower(trim(display_name))=lower(?) AND id<>?").get(roomId, name, memberId);
      if (duplicate || before.kind !== "human" && name.toLowerCase() === room.human_name.toLowerCase()) fail("ROOM_DUPLICATE_NAME", "Member display names must be unique.", { displayName: name });
      this.db.prepare("UPDATE members SET display_name=? WHERE id=? AND room_id=?").run(name, memberId, roomId);
      if (before.kind === "human") this.db.prepare("UPDATE rooms SET human_name=? WHERE id=?").run(name, roomId);
      this.db.prepare("UPDATE members SET instructions_added=0,session_linked=0 WHERE room_id=? AND kind='agent'").run(roomId);
      this.configEvent(roomId, "member-renamed", { memberId, displayName: before.display_name }, { memberId, displayName: name });
    });
    return this.memberView(this.member(memberId));
  }
  validateMentions(roomId, authorId, input) {
    const ids = input.mentionMemberIds == null ? [] : input.mentionMemberIds;
    if (!Array.isArray(ids) || ids.some((value) => typeof value !== "string")) fail("ROOM_INVALID_INPUT", "mentionMemberIds must be an array of member IDs.");
    if (input.mentionAll != null && typeof input.mentionAll !== "boolean") fail("ROOM_INVALID_INPUT", "mentionAll must be boolean.");
    const unique = [...new Set(ids)];
    for (const memberId of unique) {
      const member = this.db.prepare("SELECT * FROM members WHERE id=? AND room_id=?").get(memberId, roomId);
      if (!member) fail("ROOM_INVALID_MENTION", "A mention target does not belong to this room.", { memberId });
    }
    const members = this.db.prepare("SELECT id FROM members WHERE room_id=? AND kind='agent'").all(roomId).map((row) => row.id);
    const targets = new Set(unique.filter((memberId) => memberId !== authorId));
    if (input.mentionAll === true) {
      for (const memberId of members) if (memberId !== authorId) targets.add(memberId);
    }
    return [...targets];
  }
  validateReply(roomId, replyToMessageId) {
    if (replyToMessageId == null) return null;
    const row = this.db.prepare("SELECT * FROM messages WHERE id=? AND room_id=?").get(replyToMessageId, roomId);
    if (!row) fail("ROOM_MESSAGE_NOT_FOUND", "The quoted message does not belong to this room.", { messageId: replyToMessageId }, 404);
    return row;
  }
  validateQuestionOptions(options) {
    if (options == null) return [];
    if (!Array.isArray(options) || options.length < 2) fail("ROOM_INVALID_INPUT", "A choice question needs at least two options.");
    const values = options.map((value) => cleanText(value, "option", { maxChars: 500 }));
    if (new Set(values).size !== values.length) fail("ROOM_INVALID_INPUT", "Question options must be unique.");
    return values;
  }
  ensureReadyForMessages(roomId) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    const pending = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent' AND creation_status<>'ready'").get(roomId).count;
    if (pending) fail("ROOM_NOT_READY", "All member sessions must be ready before posting.", { pending });
  }
  post(roomId, source, input, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const room = this.room(roomId);
    this.ensureReadyForMessages(roomId);
    const author = source.kind === "human" ? room.human_id === source.memberId ? { id: room.human_id, display_name: room.human_name, kind: "human" } : fail("ROOM_FORBIDDEN", "Only the room host can post as a human.", {}, 403) : this.member(source.memberId);
    if (author.kind !== source.kind || source.kind === "agent" && author.room_id !== roomId) fail("ROOM_FORBIDDEN", "Message source does not match the member.", {}, 403);
    if (source.kind === "agent" && author.creation_status !== "ready") fail("ROOM_NOT_READY", "The room is still creating sessions.");
    const text = cleanText(input.text, "text", { maxChars: source.kind === "human" ? 1e5 : 2e3 });
    if (source.kind === "agent") assertAgentWidth(text);
    const reply = this.validateReply(roomId, input.replyToMessageId);
    const mentions = this.validateMentions(roomId, author.id, input);
    const mentionAll = input.mentionAll === true;
    return this.tx(() => {
      let checkDecision = "not-required";
      if (source.kind === "agent") {
        const check = this.preSendCheck(roomId, author.id, { text, replyToMessageId: reply?.id }, now);
        if (check.status === "review_required") return check;
        checkDecision = check.checkDecision;
      }
      const result = this.insertMessage(roomId, author, { text, kind: "post", replyToMessageId: reply?.id, mentions, mentionAll }, now);
      this.markReadInTx(roomId, author.id, [result.messageId], "author", now);
      const rows = this.db.prepare("SELECT * FROM messages WHERE room_id=? ORDER BY room_seq DESC LIMIT 8").all(roomId).reverse();
      const view = this.renderRows(roomId, rows, author.id);
      const presentation = this.presentation(roomId, author.id, view.fullMessageIds, now);
      return {
        status: "stored",
        messageId: result.messageId,
        roomSeq: result.roomSeq,
        questionId: null,
        timeline: view.rows,
        omittedBefore: view.rows.length ? encodeCursor({ roomId, query: "", authorId: null, mode: "history", direction: "older", anchorSeq: view.rows[0].roomSeq }) : null,
        unread: this.unreadSummary(roomId, author.id, view.fullMessageIds),
        presentation,
        checkDecision,
        mentionHint: source.kind === "agent" ? this.mentionHint(roomId, author.id, text, mentions, mentionAll) : null
      };
    });
  }
  ask(roomId, source, input, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const room = this.room(roomId);
    this.ensureReadyForMessages(roomId);
    const author = this.member(source.memberId);
    if (author.kind !== "agent" || author.room_id !== roomId) fail("ROOM_FORBIDDEN", "Only room agents can ask a room question.", {}, 403);
    if (author.creation_status !== "ready") fail("ROOM_NOT_READY", "The room is still creating sessions.");
    const text = cleanText(input.text, "text", { maxChars: 2e3 });
    const options = this.validateQuestionOptions(input.options);
    assertAgentWidth(options.length ? `${text}
${options.join("\n")}` : text, "question");
    const reply = this.validateReply(roomId, input.replyToMessageId);
    const mentions = this.validateMentions(roomId, author.id, input);
    const mentionAll = input.mentionAll === true;
    return this.tx(() => {
      const check = this.preSendCheck(roomId, author.id, { text: options.length ? `${text}
${options.join("\n")}` : text, replyToMessageId: reply?.id }, now);
      if (check.status === "review_required") return check;
      const checkDecision = check.checkDecision;
      const questionId = id("q");
      const result = this.insertMessage(roomId, author, { text, kind: "question", options, replyToMessageId: reply?.id, mentions, mentionAll, questionId }, now);
      this.db.prepare(`INSERT INTO questions(id,room_id,message_id,asker_id,status,options_json,created_at,updated_at) VALUES(?,?,?,?,'pending',?,?,?)`).run(questionId, roomId, result.messageId, author.id, json(options), now, now);
      this.markReadInTx(roomId, author.id, [result.messageId], "author", now);
      const rows = this.db.prepare("SELECT * FROM messages WHERE room_id=? ORDER BY room_seq DESC LIMIT 8").all(roomId).reverse();
      const view = this.renderRows(roomId, rows, author.id);
      return {
        status: "stored",
        messageId: result.messageId,
        roomSeq: result.roomSeq,
        questionId,
        timeline: view.rows,
        omittedBefore: view.rows.length ? encodeCursor({ roomId, query: "", authorId: null, mode: "history", direction: "older", anchorSeq: view.rows[0].roomSeq }) : null,
        unread: this.unreadSummary(roomId, author.id, view.fullMessageIds),
        presentation: this.presentation(roomId, author.id, view.fullMessageIds, now),
        checkDecision,
        mentionHint: this.mentionHint(roomId, author.id, text, mentions, mentionAll)
      };
    });
  }
  preSendCheck(roomId, authorId, input, now) {
    const author = this.member(authorId);
    const last = author.last_check_at ? Date.parse(author.last_check_at) : -Infinity;
    if (Number.isFinite(last) && now && Date.parse(now) - last < 3e4) return { checkDecision: "skipped" };
    this.db.prepare("UPDATE members SET last_check_at=? WHERE id=?").run(now, author.id);
    const rows = this.db.prepare("SELECT * FROM messages WHERE room_id=? ORDER BY room_seq DESC LIMIT 8").all(roomId).reverse();
    const hasUnread = rows.some((row) => !this.hasRead(author.id, row.id));
    if (!hasUnread) return { checkDecision: "executed" };
    const view = this.renderRows(roomId, rows, author.id);
    return {
      status: "review_required",
      messageId: null,
      roomSeq: null,
      questionId: null,
      checkDecision: "executed",
      timeline: view.rows,
      omittedBefore: view.rows.length ? encodeCursor({ roomId, query: "", authorId: null, mode: "history", direction: "older", anchorSeq: view.rows[0].roomSeq }) : null,
      unread: this.unreadSummary(roomId, author.id, view.fullMessageIds),
      presentation: this.presentation(roomId, author.id, view.fullMessageIds, now),
      mentionHint: null,
      message: "Recent unread messages must be reviewed before posting. The draft was not stored. Read the timeline, then submit again or discard it."
    };
  }
  insertMessage(roomId, author, input, now) {
    const seq = this.db.prepare("SELECT COALESCE(MAX(room_seq),0)+1 AS seq FROM messages WHERE room_id=?").get(roomId).seq;
    const messageId = id("m");
    this.db.prepare(`INSERT INTO messages(id,room_id,room_seq,kind,author_id,text,options_json,reply_to_id,mention_all,question_id,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(messageId, roomId, seq, input.kind, author.id, input.text, json(input.options || []), input.replyToMessageId || null, input.mentionAll ? 1 : 0, input.questionId || null, now);
    const mention = this.db.prepare("INSERT OR IGNORE INTO message_mentions(message_id,member_id) VALUES(?,?)");
    for (const memberId of input.mentions || []) mention.run(messageId, memberId);
    if (this.room(roomId).started_at == null) this.db.prepare("UPDATE rooms SET started_at=? WHERE id=?").run(now, roomId);
    return { messageId, roomSeq: seq };
  }
  answerQuestion(roomId, questionId, input, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    const question = this.db.prepare("SELECT * FROM questions WHERE id=? AND room_id=?").get(questionId, roomId);
    if (!question) fail("ROOM_QUESTION_NOT_FOUND", "Question not found.", { questionId }, 404);
    if (question.status !== "pending") fail("ROOM_QUESTION_CONFLICT", "The question is no longer pending.", { status: question.status }, 409);
    const original = this.db.prepare("SELECT * FROM messages WHERE id=?").get(question.message_id);
    const text = cleanText(input.answer, "answer", { maxChars: 1e5 });
    if (original.options_json) {
      const options = parse(original.options_json, []);
      if (options.length && !options.includes(text)) fail("ROOM_INVALID_ANSWER", "Choose one of the question options.", { options });
    }
    const note = input.note == null ? "" : cleanText(input.note, "note", { required: false, maxChars: 1e5 });
    return this.tx(() => {
      const changed = this.db.prepare("UPDATE questions SET status='answered',answer_message_id=?,updated_at=? WHERE id=? AND status='pending'").run(null, now, questionId);
      if (!changed.changes) fail("ROOM_QUESTION_CONFLICT", "The question is no longer pending.", {}, 409);
      const author = { id: room.human_id, display_name: room.human_name, kind: "human" };
      const result = this.insertMessage(roomId, author, { text: note ? `${text}
${note}` : text, kind: "answer", replyToMessageId: question.message_id, mentions: [], mentionAll: false }, now);
      this.db.prepare("UPDATE questions SET answer_message_id=? WHERE id=?").run(result.messageId, questionId);
      this.markReadInTx(roomId, author.id, [result.messageId], "author", now);
      return { status: "answered", questionId, answerMessageId: result.messageId, messageId: result.messageId, roomSeq: result.roomSeq, askerId: question.asker_id };
    });
  }
  withdrawQuestion(roomId, source, questionId, input, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    const question = this.db.prepare("SELECT * FROM questions WHERE id=? AND room_id=?").get(questionId, roomId);
    if (!question) fail("ROOM_QUESTION_NOT_FOUND", "Question not found.", { questionId }, 404);
    const member = source.kind === "human" ? null : this.member(source.memberId);
    const human = source.kind === "human" && source.memberId === room.human_id;
    if (!human && !(source.kind === "agent" && member.id === question.asker_id && member.room_id === roomId)) fail("ROOM_FORBIDDEN", "Only the asker or the host can withdraw this question.", {}, 403);
    const note = input.note == null ? null : cleanText(input.note, "note", { required: false, maxChars: 1e3 });
    if (note != null && source.kind === "agent") assertAgentWidth(note, "withdrawal note");
    const reply = this.validateReply(roomId, input.replyToMessageId);
    if (input.duplicateOfQuestionId != null) {
      const duplicate = this.db.prepare("SELECT * FROM questions WHERE id=? AND room_id=?").get(input.duplicateOfQuestionId, roomId);
      if (!duplicate || duplicate.id === questionId) fail("ROOM_QUESTION_NOT_FOUND", "The duplicate question does not belong to this room.", {}, 404);
    }
    return this.tx(() => {
      const changed = this.db.prepare(`UPDATE questions SET status='withdrawn',withdraw_note=?,withdraw_reply_id=?,duplicate_of_id=?,updated_at=?
        WHERE id=? AND status='pending'`).run(note, reply?.id || null, input.duplicateOfQuestionId || null, now, questionId);
      if (!changed.changes) fail("ROOM_QUESTION_CONFLICT", "The question is no longer pending.", {}, 409);
      return { status: "withdrawn", questionId };
    });
  }
  question(roomId, questionId) {
    const row = this.db.prepare("SELECT * FROM questions WHERE id=? AND room_id=?").get(questionId, roomId);
    if (!row) fail("ROOM_QUESTION_NOT_FOUND", "Question not found.", { questionId }, 404);
    return row;
  }
  questions(roomId, input = {}) {
    const status = input.status || "pending";
    if (!QUESTION_STATUSES.has(status)) fail("ROOM_INVALID_INPUT", "status must be pending, answered, or withdrawn.");
    const limit = page(input.limit, 20, 50);
    let rows;
    let next = null;
    if (input.cursor) {
      const cursor = requireCursor(input.cursor, { roomId, status, mode: "questions" }, "cursor");
      rows = this.db.prepare(`SELECT q.*,m.room_seq AS message_seq FROM questions q JOIN messages m ON m.id=q.message_id
        WHERE q.room_id=? AND q.status=? AND m.room_seq>? ORDER BY m.room_seq LIMIT ?`).all(roomId, status, Number(cursor.afterSeq), limit + 1);
      if (rows.length > limit) next = encodeCursor({ roomId, status, mode: "questions", afterSeq: rows[limit - 1].message_seq });
    } else {
      rows = this.db.prepare(`SELECT q.*,m.room_seq AS message_seq FROM questions q JOIN messages m ON m.id=q.message_id
        WHERE q.room_id=? AND q.status=? ORDER BY m.room_seq LIMIT ?`).all(roomId, status, limit + 1);
      if (rows.length > limit) next = encodeCursor({ roomId, status, mode: "questions", afterSeq: rows[limit - 1].message_seq });
    }
    rows = rows.slice(0, limit);
    return { status, items: rows.map((row) => this.questionPreview(row)), nextCursor: next };
  }
  questionPreview(row) {
    const message = this.db.prepare("SELECT * FROM messages WHERE id=?").get(row.message_id);
    const author = this.db.prepare("SELECT * FROM members WHERE id=?").get(row.asker_id);
    const item = {
      questionId: row.id,
      messageId: row.message_id,
      roomSeq: message.room_seq,
      asker: { memberId: row.asker_id, displayName: author.display_name, kind: author.kind },
      createdAt: row.created_at,
      status: row.status,
      text: snippet(message.text, "", 300),
      options: parse(row.options_json, []),
      preview: true
    };
    if (row.status === "answered") item.answerMessageId = row.answer_message_id;
    if (row.status === "withdrawn") {
      item.withdrawNote = row.withdraw_note;
      if (row.withdraw_reply_id) item.replyToMessageId = row.withdraw_reply_id;
      if (row.duplicate_of_id) item.duplicateOfQuestionId = row.duplicate_of_id;
    }
    return item;
  }
  history(roomId, input = {}, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const query = input.query == null ? "" : String(input.query).trim();
    const authorId = input.authorMemberId || null;
    if (authorId && authorId !== this.room(roomId).human_id && !this.db.prepare("SELECT id FROM members WHERE id=? AND room_id=?").get(authorId, roomId)) fail("ROOM_INVALID_INPUT", "Author filter does not belong to this room.");
    const limit = page(input.limit, 20, 50);
    const filters = { roomId, query, authorId, mode: "history" };
    let rows;
    let nextCursor = null;
    let previousCursor = null;
    const cursor = input.cursor ? requireCursor(input.cursor, filters, "cursor") : null;
    const base = `FROM messages m WHERE m.room_id=?${query ? " AND (instr(m.text,?)>0 OR EXISTS(SELECT 1 FROM json_each(m.options_json) WHERE instr(value,?)>0))" : ""}${authorId ? " AND m.author_id=?" : ""}`;
    const params = [roomId];
    if (query) params.push(query, query);
    if (authorId) params.push(authorId);
    if (cursor?.direction === "older") {
      rows = this.db.prepare(`SELECT m.* ${base} AND m.room_seq<? ORDER BY m.room_seq DESC LIMIT ?`).all(...params, Number(cursor.anchorSeq), limit + 1).reverse();
    } else if (cursor?.direction === "newer") {
      rows = this.db.prepare(`SELECT m.* ${base} AND m.room_seq>? ORDER BY m.room_seq LIMIT ?`).all(...params, Number(cursor.anchorSeq), limit + 1);
    } else {
      rows = this.db.prepare(`SELECT m.* ${base} ORDER BY m.room_seq DESC LIMIT ?`).all(...params, limit + 1).reverse();
    }
    const hasMore = rows.length > limit;
    rows = cursor?.direction === "newer" ? rows.slice(0, limit) : rows.slice(-limit);
    if (rows.length) {
      if (hasMore && cursor?.direction === "newer") nextCursor = encodeCursor({ ...filters, direction: "newer", anchorSeq: rows.at(-1).room_seq });
      if (hasMore || !cursor || cursor.direction === "newer") previousCursor = encodeCursor({ ...filters, direction: "older", anchorSeq: rows[0].room_seq });
      if (cursor?.direction === "older") nextCursor = encodeCursor({ ...filters, direction: "newer", anchorSeq: rows.at(-1).room_seq });
    }
    const room = this.room(roomId);
    const viewerId = input.viewerMemberId || room.human_id;
    const viewer = viewerId === room.human_id ? { id: room.human_id, room_id: roomId } : this.member(viewerId);
    if (viewer.room_id !== roomId) fail("ROOM_FORBIDDEN", "Viewer does not belong to this room.", {}, 403);
    const rendered = this.renderRows(roomId, rows, viewer.id, { query });
    return {
      items: rendered.rows,
      nextCursor,
      previousCursor,
      query,
      authorMemberId: authorId,
      unread: this.unreadSummary(roomId, viewer.id, query ? [] : rendered.fullMessageIds),
      presentation: !query && input.trackPresentation !== false ? this.presentation(roomId, viewer.id, rendered.fullMessageIds, now) : null
    };
  }
  context(roomId, messageId, input = {}, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const anchor = this.db.prepare("SELECT * FROM messages WHERE id=? AND room_id=?").get(messageId, roomId);
    if (!anchor) fail("ROOM_MESSAGE_NOT_FOUND", "Message not found.", { messageId }, 404);
    const before = input.before == null ? 5 : Number(input.before);
    const after = input.after == null ? 5 : Number(input.after);
    if (!Number.isInteger(before) || before < 0 || before > 50 || !Number.isInteger(after) || after < 0 || after > 50) fail("ROOM_INVALID_INPUT", "before and after must be between 0 and 50.");
    const room = this.room(roomId);
    const viewer = input.viewerMemberId === room.human_id ? { id: room.human_id, room_id: roomId } : this.member(input.viewerMemberId);
    if (viewer.room_id !== roomId) fail("ROOM_FORBIDDEN", "Viewer does not belong to this room.", {}, 403);
    const rows = this.db.prepare("SELECT * FROM messages WHERE room_id=? AND room_seq>=? AND room_seq<=? ORDER BY room_seq").all(roomId, anchor.room_seq - before, anchor.room_seq + after);
    const rendered = this.renderRows(roomId, rows, viewer.id);
    return { anchorMessageId: messageId, items: rendered.rows, unread: this.unreadSummary(roomId, viewer.id, rendered.fullMessageIds), presentation: input.trackPresentation === false ? null : this.presentation(roomId, viewer.id, rendered.fullMessageIds, now) };
  }
  unread(roomId, memberId, input = {}, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const member = this.member(memberId);
    if (member.room_id !== roomId) fail("ROOM_FORBIDDEN", "Member does not belong to this room.", {}, 403);
    const limit = page(input.limit, 8, 20);
    let afterSeq = 0;
    if (input.cursor) {
      const cursor = requireCursor(input.cursor, { roomId, memberId, mode: "unread" }, "cursor");
      afterSeq = Number(cursor.afterSeq);
    }
    const unreadRows = this.db.prepare(`SELECT m.* FROM messages m WHERE m.room_id=? AND m.room_seq>? AND NOT EXISTS
      (SELECT 1 FROM read_receipts r WHERE r.message_id=m.id AND r.member_id=?) ORDER BY m.room_seq LIMIT ?`).all(roomId, afterSeq, memberId, limit);
    const seqs = new Set(unreadRows.map((row) => row.room_seq));
    for (const row of unreadRows) for (let offset = -2; offset <= 2; offset += 1) seqs.add(row.room_seq + offset);
    const rows = seqs.size ? this.db.prepare("SELECT * FROM messages WHERE room_id=? AND room_seq BETWEEN ? AND ? ORDER BY room_seq").all(roomId, Math.min(...seqs), Math.max(...seqs)) : [];
    const keep = /* @__PURE__ */ new Set();
    for (const unreadRow of unreadRows) for (let offset = -2; offset <= 2; offset += 1) keep.add(unreadRow.room_seq + offset);
    const selected = rows.filter((row) => keep.has(row.room_seq));
    const rendered = this.renderRows(roomId, selected, memberId);
    const unreadIds = new Set(unreadRows.map((row) => row.id));
    const items = rendered.rows.map((row) => ({ ...row, unread: unreadIds.has(row.messageId) }));
    const lastSeq = unreadRows.at(-1)?.room_seq;
    return {
      items,
      unreadMessageIds: unreadRows.map((row) => row.id),
      unread: this.unreadSummary(roomId, memberId, rendered.fullMessageIds),
      nextCursor: unreadRows.length === limit && lastSeq ? encodeCursor({ roomId, memberId, mode: "unread", afterSeq: lastSeq }) : null,
      presentation: this.presentation(roomId, memberId, rendered.fullMessageIds, now)
    };
  }
  mentionMetadata(roomId, memberId, input = {}) {
    const member = this.member(memberId);
    if (member.room_id !== roomId) fail("ROOM_FORBIDDEN", "Member does not belong to this room.", {}, 403);
    const limit = page(input.limit, 20, 50);
    let beforeSeq = Number.MAX_SAFE_INTEGER;
    if (input.mentionCursor || input.cursor) {
      const cursor = requireCursor(input.mentionCursor || input.cursor, { roomId, memberId, mode: "mentions" }, "mentionCursor");
      beforeSeq = Number(cursor.beforeSeq);
    }
    const rows = this.db.prepare(`SELECT m.* FROM messages m WHERE m.room_id=? AND m.room_seq<? AND m.author_id<>? AND
      (m.mention_all=1 OR EXISTS(SELECT 1 FROM message_mentions x WHERE x.message_id=m.id AND x.member_id=?)) AND NOT EXISTS
      (SELECT 1 FROM read_receipts r WHERE r.message_id=m.id AND r.member_id=?) ORDER BY m.room_seq DESC LIMIT ?`).all(roomId, beforeSeq, memberId, memberId, memberId, limit + 1);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({ messageId: row.id, roomSeq: row.room_seq, createdAt: row.created_at }));
    return { unread: this.unreadSummary(roomId, memberId, []), items, nextCursor: hasMore ? encodeCursor({ roomId, memberId, mode: "mentions", beforeSeq: items.at(-1).roomSeq }) : null };
  }
  renderRows(roomId, rows, viewerId, { query = "" } = {}) {
    const fullMessageIds = /* @__PURE__ */ new Set();
    const rendered = rows.map((row) => {
      const author = this.author(row.author_id);
      const question = row.question_id ? this.question(roomId, row.question_id) : null;
      const item = {
        messageId: row.id,
        roomSeq: row.room_seq,
        author: { memberId: author.memberId, displayName: author.displayName, kind: author.kind },
        isOwn: author.memberId === viewerId,
        kind: row.kind,
        createdAt: row.created_at,
        mentions: this.mentionedMembers(row.id),
        mentionAll: row.mention_all === 1,
        replyToMessageId: row.reply_to_id,
        questionId: row.question_id,
        questionStatus: question?.status || null,
        answerMessageId: question?.answer_message_id || null,
        label: `[#${row.room_seq} ${author.displayName} \xB7 ${author.kind === "agent" ? "Agent" : "\u4EBA\u7C7B"}${author.memberId === viewerId ? " \xB7 \u4F60" : ""}]`
      };
      if (query) {
        const searchable = `${row.text}
${parse(row.options_json, []).join("\n")}`;
        item.text = snippet(searchable, query);
        item.options = parse(row.options_json, []);
        item.preview = true;
        item.full = false;
        item.truncated = true;
        return item;
      }
      const visibleText = row.kind === "question" && parse(row.options_json, []).length ? `${row.text}
${parse(row.options_json, []).map((option, index) => `${index + 1}. ${option}`).join("\n")}` : row.text;
      if (visibleText.length <= 4e3) {
        item.text = row.text;
        item.options = parse(row.options_json, []);
        item.full = true;
        item.preview = false;
        fullMessageIds.add(row.id);
      } else {
        item.text = visibleText.slice(0, 4e3) + "\n\u2026 [\u9884\u89C8\uFF1B\u5B8C\u6574\u5185\u5BB9\u8BF7\u7528 room_context \u6253\u5F00]";
        item.options = parse(row.options_json, []);
        item.preview = true;
        item.full = false;
        item.truncated = true;
      }
      if (row.reply_to_id) item.replyTo = this.renderQuote(roomId, row.reply_to_id, fullMessageIds);
      return item;
    });
    return { rows: rendered, fullMessageIds: [...fullMessageIds] };
  }
  renderQuote(roomId, messageId, fullMessageIds) {
    const row = this.db.prepare("SELECT * FROM messages WHERE id=? AND room_id=?").get(messageId, roomId);
    if (!row) return { messageId, unavailable: true, text: "\u539F\u5E16\u4E0D\u53EF\u7528\u6216\u5DF2\u5220\u9664\u3002" };
    const author = this.author(row.author_id);
    const quote = {
      messageId: row.id,
      roomSeq: row.room_seq,
      author: { memberId: author.memberId, displayName: author.displayName, kind: author.kind },
      label: `\u5F15\u7528 #${row.room_seq}\uFF08${row.id}\uFF09\uFF1A${author.displayName} \xB7 ${author.kind === "agent" ? "Agent" : "\u4EBA\u7C7B"}`
    };
    if (row.text.length <= 1200) {
      quote.text = row.text;
      quote.options = parse(row.options_json, []);
      quote.full = true;
      fullMessageIds.add(row.id);
    } else {
      quote.text = row.text.slice(0, 1200) + "\u2026 [\u5F15\u7528\u9884\u89C8\uFF1B\u5B8C\u6574\u5185\u5BB9\u8BF7\u7528 room_context \u6253\u5F00]";
      quote.options = parse(row.options_json, []);
      quote.full = false;
      quote.preview = true;
      quote.truncated = true;
    }
    return quote;
  }
  author(authorId) {
    const member = this.db.prepare("SELECT * FROM members WHERE id=?").get(authorId);
    if (member) return { memberId: member.id, displayName: member.display_name, kind: member.kind };
    const room = this.db.prepare("SELECT * FROM rooms WHERE human_id=?").get(authorId);
    if (room) return { memberId: room.human_id, displayName: room.human_name, kind: "human" };
    return { memberId: authorId, displayName: "\u672A\u77E5\u6210\u5458", kind: "agent" };
  }
  mentionedMembers(messageId) {
    return this.db.prepare(`SELECT m.id,m.display_name,m.kind FROM message_mentions x JOIN members m ON m.id=x.member_id WHERE x.message_id=? ORDER BY m.created_at`).all(messageId);
  }
  mentionHint(roomId, authorId, text, targets, mentionAll) {
    if (mentionAll) return null;
    const members = this.db.prepare("SELECT * FROM members WHERE room_id=? AND kind='agent' AND id<>? ORDER BY length(display_name) DESC").all(roomId, authorId);
    const withoutCode = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").split("\n").filter((line) => !/^\s*>/.test(line)).join("\n");
    for (const member of members) {
      if (targets.includes(member.id)) continue;
      const pattern = new RegExp(`@${escapeRegex(member.display_name)}(?=$|[\\s\\p{P}\\p{S}])`, "u");
      if (pattern.test(withoutCode)) return `\u5E16\u5B50\u5DF2\u53D1\u9001\uFF0C\u4F46\u672A\u70B9\u540D @${member.display_name}\uFF1B\u4E0B\u6B21\u53EF\u4F20 mentionMemberIds: [${JSON.stringify(member.id)}]\u3002`;
    }
    return null;
  }
  hasRead(memberId, messageId) {
    return !!this.db.prepare("SELECT 1 FROM read_receipts WHERE message_id=? AND member_id=?").get(messageId, memberId);
  }
  markRead(roomId, memberId, messageIds, source = "tool", now = (/* @__PURE__ */ new Date()).toISOString()) {
    if (!Array.isArray(messageIds)) fail("ROOM_INVALID_INPUT", "messageIds must be an array.");
    const room = this.room(roomId);
    const member = memberId === room.human_id ? { id: room.human_id, room_id: roomId } : this.member(memberId);
    if (member.room_id !== roomId) fail("ROOM_FORBIDDEN", "Member does not belong to this room.", {}, 403);
    return this.tx(() => this.markReadInTx(roomId, memberId, messageIds, source, now));
  }
  markReadInTx(roomId, memberId, messageIds, source, now) {
    const statement = this.db.prepare("INSERT OR IGNORE INTO read_receipts(message_id,member_id,source,read_at) VALUES(?,?,?,?)");
    let count = 0;
    for (const messageId of new Set(messageIds)) {
      const message = this.db.prepare("SELECT id FROM messages WHERE id=? AND room_id=?").get(messageId, roomId);
      if (!message) continue;
      count += statement.run(messageId, memberId, source, now).changes;
    }
    return { marked: count, unread: this.unreadSummary(roomId, memberId, []) };
  }
  roomByHuman(memberId) {
    return this.db.prepare("SELECT * FROM rooms WHERE human_id=?").get(memberId);
  }
  receipts(roomId, messageId) {
    this.room(roomId);
    const message = this.db.prepare("SELECT * FROM messages WHERE id=? AND room_id=?").get(messageId, roomId);
    if (!message) fail("ROOM_MESSAGE_NOT_FOUND", "Message not found.", {}, 404);
    const rows = this.db.prepare(`SELECT r.member_id,r.read_at,r.source,m.display_name,m.kind FROM read_receipts r
      LEFT JOIN members m ON m.id=r.member_id WHERE r.message_id=? ORDER BY m.kind,m.display_name`).all(messageId);
    const human = rows.find((row) => row.member_id === this.room(roomId).human_id);
    const agents = rows.filter((row) => row.member_id !== this.room(roomId).human_id).map((row) => ({ memberId: row.member_id, displayName: row.display_name, kind: row.kind, readAt: row.read_at, source: row.source }));
    return { messageId, human: human ? { memberId: human.member_id, displayName: this.room(roomId).human_name, kind: "human", readAt: human.read_at } : null, agents };
  }
  presentation(roomId, memberId, messageIds, now) {
    if (!messageIds.length) return null;
    const presentationId = id("p");
    this.db.prepare("INSERT INTO presentations(id,room_id,member_id,message_ids_json,created_at) VALUES(?,?,?,?,?)").run(presentationId, roomId, memberId, json([...new Set(messageIds)]), now);
    return { presentationId, messageIds: [...new Set(messageIds)], note: "Read receipts are recorded only after the tool output is observed in the next model request." };
  }
  confirmPresentation(presentationId, sessionID, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const pending = this.db.prepare("SELECT * FROM presentations WHERE id=? AND confirmed_at IS NULL").get(presentationId);
    if (!pending) return { confirmed: false };
    const member = this.db.prepare("SELECT * FROM members WHERE id=? AND session_id=?").get(pending.member_id, sessionID);
    if (!member) fail("ROOM_FORBIDDEN", "Presentation does not belong to this session.", {}, 403);
    return this.tx(() => {
      this.db.prepare("UPDATE presentations SET confirmed_at=? WHERE id=? AND confirmed_at IS NULL").run(now, presentationId);
      const result = this.markReadInTx(pending.room_id, pending.member_id, parse(pending.message_ids_json, []), "model-context", now);
      this.db.prepare("DELETE FROM presentations WHERE id=?").run(presentationId);
      return { ...result, confirmed: true, roomId: pending.room_id };
    });
  }
  observePresentation(presentationId, sessionID, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const pending = this.db.prepare("SELECT * FROM presentations WHERE id=? AND confirmed_at IS NULL").get(presentationId);
    if (!pending) return false;
    const member = this.db.prepare("SELECT id FROM members WHERE id=? AND session_id=?").get(pending.member_id, sessionID);
    if (!member) fail("ROOM_FORBIDDEN", "Presentation does not belong to this session.", {}, 403);
    this.db.prepare("UPDATE presentations SET observed_at=COALESCE(observed_at,?) WHERE id=?").run(now, presentationId);
    return true;
  }
  pendingPresentations(limit = 200) {
    return this.db.prepare(`SELECT p.id AS presentation_id,p.room_id,m.session_id FROM presentations p
      JOIN members m ON m.id=p.member_id WHERE p.confirmed_at IS NULL AND p.observed_at IS NOT NULL AND m.session_id IS NOT NULL
      ORDER BY p.created_at LIMIT ?`).all(limit);
  }
  unreadSummary(roomId, memberId, excludeIds = []) {
    const excluded = [...new Set(excludeIds)];
    const exclusion = excluded.length ? ` AND m.id NOT IN (${excluded.map(() => "?").join(",")})` : "";
    const params = [roomId, memberId, ...excluded];
    const unreadCount = this.db.prepare(`SELECT COUNT(*) AS count FROM messages m WHERE m.room_id=? AND NOT EXISTS
      (SELECT 1 FROM read_receipts r WHERE r.message_id=m.id AND r.member_id=?)${exclusion}`).get(...params).count;
    const mentions = this.db.prepare(`SELECT m.* FROM messages m WHERE m.room_id=? AND m.author_id<>? AND NOT EXISTS
      (SELECT 1 FROM read_receipts r WHERE r.message_id=m.id AND r.member_id=?)
      AND (m.mention_all=1 OR EXISTS(SELECT 1 FROM message_mentions x WHERE x.message_id=m.id AND x.member_id=?))${exclusion}
      ORDER BY m.room_seq DESC`).all(roomId, memberId, memberId, memberId, ...excluded);
    const items = mentions.slice(0, 20).map((row) => ({ messageId: row.id, roomSeq: row.room_seq, createdAt: row.created_at }));
    return {
      unreadCount,
      unreadMentionCount: mentions.length,
      unreadMentions: items,
      hasMoreMentions: mentions.length > 20,
      mentionCursor: mentions.length > 20 ? encodeCursor({ roomId, memberId, mode: "mentions", beforeSeq: items[19].roomSeq }) : null
    };
  }
  ensureReminder(roomId, memberId, input, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const room = this.room(roomId);
    const member = this.member(memberId);
    if (room.status === "ended" || member.kind !== "agent" || member.creation_status !== "ready") return null;
    if ((room.status === "paused" || room.budget_remaining <= 0) && input.kind !== "steer") return null;
    const summary = this.unreadSummary(roomId, memberId, []);
    if (!summary.unreadCount) return null;
    const snapshotSeq = this.db.prepare("SELECT COALESCE(MAX(room_seq),0) AS seq FROM messages WHERE room_id=?").get(roomId).seq;
    const existing = this.db.prepare("SELECT * FROM reminders WHERE member_id=? AND trigger_key=? AND kind=?").get(memberId, input.triggerKey, input.kind);
    if (existing && !["pending", "reserved", "failed"].includes(existing.status)) return existing;
    return this.tx(() => {
      if (existing) {
        const retryAt = existing.status === "failed" ? new Date(Date.parse(now) + 1e3).toISOString() : existing.next_attempt_at;
        this.db.prepare(`UPDATE reminders SET snapshot_seq=?,unread_count=?,unread_mention_count=?,reason=COALESCE(?,reason),answer_message_id=COALESCE(?,answer_message_id),status=?,updated_at=?,last_error=NULL,next_attempt_at=?
          WHERE id=?`).run(Math.max(existing.snapshot_seq, snapshotSeq), summary.unreadCount, summary.unreadMentionCount, input.reason || null, input.answerMessageId || null, existing.status === "reserved" ? "reserved" : "pending", now, retryAt, existing.id);
        return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(existing.id);
      }
      const reminderId = id("rem");
      const inputId = `msg_room_${roomId}_${reminderId}`;
      this.db.prepare(`INSERT INTO reminders(id,room_id,member_id,kind,status,trigger_key,snapshot_seq,execution_round,idle_epoch,budget_period,input_id,unread_count,unread_mention_count,reason,answer_message_id,created_at,updated_at)
        VALUES(?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,?,?)`).run(reminderId, roomId, memberId, input.kind, input.triggerKey, snapshotSeq, member.execution_round, member.idle_epoch, room.budget_period, inputId, summary.unreadCount, summary.unreadMentionCount, input.reason || null, input.answerMessageId || null, now, now);
      return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
    });
  }
  refreshReminder(reminderId, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const reminder = this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
    if (!reminder) return null;
    const summary = this.unreadSummary(reminder.room_id, reminder.member_id, []);
    const snapshotSeq = this.db.prepare("SELECT COALESCE(MAX(room_seq),0) AS seq FROM messages WHERE room_id=?").get(reminder.room_id).seq;
    this.db.prepare("UPDATE reminders SET snapshot_seq=?,unread_count=?,unread_mention_count=?,updated_at=? WHERE id=?").run(snapshotSeq, summary.unreadCount, summary.unreadMentionCount, now, reminderId);
    return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
  }
  refundReminderInTx(reminder, now) {
    if (!reminder.charged || reminder.refunded) return;
    this.db.prepare("UPDATE budget_periods SET used_count=used_count-1 WHERE room_id=? AND period=?").run(reminder.room_id, reminder.charged_period);
    this.db.prepare("UPDATE reminders SET charged=0,refunded=1 WHERE id=?").run(reminder.id);
    const room = this.room(reminder.room_id);
    if (reminder.charged_period === room.budget_period) this.db.prepare("UPDATE rooms SET budget_remaining=budget_remaining+1 WHERE id=?").run(room.id);
    const current = this.room(reminder.room_id);
    if (current.status === "paused" && current.paused_reason === "budget" && current.budget_remaining > 0) {
      this.db.prepare("UPDATE rooms SET status='ready',paused_reason=NULL WHERE id=?").run(room.id);
    }
  }
  reserveReminder(reminderId, now = (/* @__PURE__ */ new Date()).toISOString()) {
    return this.tx(() => {
      const reminder = this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
      if (!reminder) fail("ROOM_REMINDER_NOT_FOUND", "Reminder not found.", {}, 404);
      const room = this.room(reminder.room_id);
      const retryCharged = reminder.charged === 1 && reminder.refunded === 0;
      if (room.status !== "ready" && !(retryCharged && room.status === "paused" && room.paused_reason === "budget")) return null;
      if (!["pending", "unknown"].includes(reminder.status)) return null;
      if (!reminder.unread_count) return null;
      if (!retryCharged) {
        if (room.budget_remaining <= 0) return null;
        this.db.prepare("UPDATE rooms SET budget_remaining=budget_remaining-1 WHERE id=?").run(room.id);
        this.db.prepare("UPDATE budget_periods SET used_count=used_count+1 WHERE room_id=? AND period=?").run(room.id, room.budget_period);
        if (room.budget_remaining === 1) {
          this.db.prepare("UPDATE rooms SET status='paused',paused_reason='budget' WHERE id=?").run(room.id);
          this.configEvent(room.id, "room-paused", { status: "ready", remaining: 1 }, { status: "paused", reason: "budget" }, now);
        }
      }
      const leaseUntil = new Date(Date.parse(now) + 15e3).toISOString();
      const chargedPeriod = retryCharged ? reminder.charged_period : room.budget_period;
      this.db.prepare(`UPDATE reminders SET status='reserved',attempts=attempts+1,budget_period=?,charged=1,refunded=0,charged_period=?,
        updated_at=?,lease_until=?,next_attempt_at=NULL WHERE id=?`).run(room.budget_period, chargedPeriod, now, leaseUntil, reminderId);
      return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
    });
  }
  markSubmitting(reminderId, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const leaseUntil = new Date(Date.parse(now) + 15e3).toISOString();
    this.db.prepare("UPDATE reminders SET status='submitting',updated_at=?,lease_until=? WHERE id=?").run(now, leaseUntil, reminderId);
  }
  recoverExpiredReminders(now = (/* @__PURE__ */ new Date()).toISOString()) {
    this.db.prepare("UPDATE reminders SET status='unknown',last_error='Unfinished reservation recovered; retry with the same input ID' WHERE status='reserved'").run();
    this.db.prepare("UPDATE reminders SET status='unknown',last_error='Submission lease expired; retry with the same input ID' WHERE status='submitting' AND lease_until<?").run(now);
  }
  ackReminder(reminderId, outcome, error = null, now = (/* @__PURE__ */ new Date()).toISOString()) {
    return this.tx(() => {
      const reminder = this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
      if (!reminder) return null;
      const active = ["pending", "reserved", "submitting", "unknown"].includes(reminder.status);
      if (!active) return reminder;
      if (outcome === "accepted") {
        if (!reminder.charged || reminder.refunded) return reminder;
        this.db.prepare("UPDATE reminders SET status='accepted',updated_at=?,last_error=NULL WHERE id=?").run(now, reminderId);
      } else if (outcome === "failed") {
        this.refundReminderInTx(reminder, now);
        this.db.prepare("UPDATE reminders SET status='failed',updated_at=?,last_error=? WHERE id=?").run(now, String(error || "Submission failed").slice(0, 2e3), reminderId);
      } else {
        this.db.prepare("UPDATE reminders SET status='unknown',updated_at=?,last_error=? WHERE id=?").run(now, String(error || "Outcome unknown").slice(0, 2e3), reminderId);
      }
      return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
    });
  }
  deferReminder(reminderId, reason, now = (/* @__PURE__ */ new Date()).toISOString()) {
    return this.tx(() => {
      const reminder = this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
      if (!reminder || !["pending", "reserved", "unknown"].includes(reminder.status)) return reminder;
      if (reminder.status === "reserved") this.refundReminderInTx(reminder, now);
      const retryAt = new Date(Date.parse(now) + 1e3).toISOString();
      const status = reminder.status === "pending" ? "pending" : "unknown";
      this.db.prepare("UPDATE reminders SET status=?,updated_at=?,last_error=?,lease_until=NULL,next_attempt_at=? WHERE id=?").run(status, now, String(reason).slice(0, 2e3), retryAt, reminderId);
      return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
    });
  }
  coverOrdinary(roomId, memberId, urgent, now = (/* @__PURE__ */ new Date()).toISOString()) {
    return this.tx(() => {
      const rows = this.db.prepare("SELECT * FROM reminders WHERE room_id=? AND member_id=? AND kind='queue' AND status IN ('pending','reserved') AND snapshot_seq<=?").all(roomId, memberId, urgent.snapshot_seq);
      for (const row of rows) {
        this.refundReminderInTx(row, now);
        this.db.prepare("UPDATE reminders SET status='covered',updated_at=?,last_error='Covered by accepted urgent reminder' WHERE id=?").run(now, row.id);
      }
      return rows.length;
    });
  }
  cancelReminder(reminderId, reason, now = (/* @__PURE__ */ new Date()).toISOString()) {
    this.tx(() => {
      const reminder = this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
      if (!reminder || !["pending", "reserved", "unknown"].includes(reminder.status)) return;
      if (reminder.status === "reserved") this.refundReminderInTx(reminder, now);
      this.db.prepare("UPDATE reminders SET status='cancelled',updated_at=?,last_error=?,next_attempt_at=NULL WHERE id=?").run(now, String(reason).slice(0, 2e3), reminderId);
    });
  }
  dueReminders(roomId = null, limit = 20, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const where = `(r.status IN ('pending','reserved','unknown') OR (r.status='submitting' AND r.lease_until<?))
      AND (r.next_attempt_at IS NULL OR r.next_attempt_at<=?)
      AND (rm.status='ready' OR (rm.status='paused' AND rm.paused_reason='budget' AND r.charged=1 AND r.refunded=0))`;
    const rows = roomId ? this.db.prepare(`SELECT r.* FROM reminders r JOIN rooms rm ON rm.id=r.room_id WHERE r.room_id=? AND ${where} ORDER BY CASE r.kind WHEN 'steer' THEN 0 ELSE 1 END,r.created_at LIMIT ?`).all(roomId, now, now, limit) : this.db.prepare(`SELECT r.* FROM reminders r JOIN rooms rm ON rm.id=r.room_id WHERE ${where} ORDER BY CASE r.kind WHEN 'steer' THEN 0 ELSE 1 END,r.created_at LIMIT ?`).all(now, now, limit);
    return rows.map((row) => ({ ...row, room: this.room(row.room_id), member: this.member(row.member_id) }));
  }
  reminderView(reminder) {
    return {
      reminderId: reminder.id,
      roomId: reminder.room_id,
      memberId: reminder.member_id,
      kind: reminder.kind,
      status: reminder.status,
      triggerKey: reminder.trigger_key,
      snapshotSeq: reminder.snapshot_seq,
      unreadCount: reminder.unread_count,
      unreadMentionCount: reminder.unread_mention_count,
      inputId: reminder.input_id,
      budgetPeriod: reminder.budget_period,
      reason: reminder.reason,
      answerMessageId: reminder.answer_message_id,
      attempts: reminder.attempts,
      lastError: reminder.last_error,
      createdAt: reminder.created_at,
      updatedAt: reminder.updated_at
    };
  }
  reminders(roomId, limit = 100) {
    this.room(roomId);
    return this.db.prepare("SELECT * FROM reminders WHERE room_id=? ORDER BY created_at DESC LIMIT ?").all(roomId, limit).map((row) => this.reminderView(row));
  }
  executionEvent(sessionID, type, eventID = null, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const member = this.memberBySession(sessionID);
    if (type === "started") {
      if (eventID && member.last_started_event === eventID) return { changed: false, member };
      this.db.prepare("UPDATE members SET execution_round=execution_round+1,last_status='running',last_started_event=?,last_terminal_round=-1 WHERE id=?").run(eventID, member.id);
      return { changed: true, member: this.member(member.id), terminal: false };
    }
    if (["succeeded", "failed", "interrupted"].includes(type)) {
      if (member.last_terminal_round === member.execution_round) return { changed: false, member, terminal: true };
      this.db.prepare("UPDATE members SET last_status='running',last_terminal_round=execution_round WHERE id=?").run(member.id);
      return { changed: true, member: this.member(member.id), terminal: true };
    }
    return { changed: false, member, terminal: false };
  }
  setSessionStatus(sessionID, status, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const member = this.memberBySession(sessionID);
    if (status === "unknown") return { changed: false, member };
    if (status === "idle" && (member.last_status === "running" || member.last_status == null)) {
      this.db.prepare("UPDATE members SET last_status='idle',idle_epoch=idle_epoch+1 WHERE id=?").run(member.id);
      return { changed: true, member: this.member(member.id) };
    }
    this.db.prepare("UPDATE members SET last_status=? WHERE id=?").run(status, member.id);
    return { changed: false, member: this.member(member.id) };
  }
  pauseRoom(roomId, reason = "manual", now = (/* @__PURE__ */ new Date()).toISOString()) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    this.tx(() => {
      this.db.prepare("UPDATE rooms SET status='paused',paused_reason=? WHERE id=?").run(reason, roomId);
      this.configEvent(roomId, "room-paused", { status: room.status, remaining: room.budget_remaining }, { status: "paused", reason });
    });
    return this.roomSummary(this.room(roomId));
  }
  resumeRoom(roomId, budgetLimit = 50, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    if (room.status !== "paused") return this.roomSummary(room);
    if (!Number.isInteger(budgetLimit) || budgetLimit < 1 || budgetLimit > 1e5) fail("ROOM_INVALID_INPUT", "budgetLimit must be between 1 and 100000.");
    const period = room.budget_period + 1;
    const ready = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent' AND creation_status='ready'").get(roomId).count;
    const total = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent'").get(roomId).count;
    return this.tx(() => {
      this.db.prepare("UPDATE budget_periods SET ended_at=?,reason=? WHERE room_id=? AND period=?").run(now, room.paused_reason, roomId, room.budget_period);
      this.db.prepare("UPDATE rooms SET status=?,paused_reason=NULL,budget_period=?,budget_limit=?,budget_remaining=? WHERE id=?").run(ready === total ? "ready" : "creating", period, budgetLimit, budgetLimit, roomId);
      this.db.prepare("INSERT INTO budget_periods(room_id,period,limit_count,started_at) VALUES(?,?,?,?)").run(roomId, period, budgetLimit, now);
      this.configEvent(roomId, "room-resumed", { period: room.budget_period, remaining: room.budget_remaining }, { period, limit: budgetLimit });
      return this.roomSummary(this.room(roomId));
    });
  }
  endRoom(roomId, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const room = this.room(roomId);
    if (room.status === "ended") return this.roomSummary(room);
    return this.tx(() => {
      this.db.prepare("UPDATE rooms SET status='ended',ended_at=?,paused_reason='ended' WHERE id=?").run(now, roomId);
      const active = this.db.prepare("SELECT * FROM reminders WHERE room_id=? AND status IN ('pending','reserved','unknown','submitting')").all(roomId);
      for (const reminder of active) if (reminder.status === "reserved") this.refundReminderInTx(reminder, now);
      this.db.prepare("UPDATE reminders SET status='cancelled',updated_at=?,next_attempt_at=NULL WHERE room_id=? AND status IN ('pending','reserved','unknown','submitting')").run(now, roomId);
      this.configEvent(roomId, "room-ended", { status: room.status }, { status: "ended" });
      return this.roomSummary(this.room(roomId));
    });
  }
  configEvent(roomId, kind, before, after, now = (/* @__PURE__ */ new Date()).toISOString()) {
    this.db.prepare("INSERT INTO config_events(room_id,kind,before_json,after_json,created_at) VALUES(?,?,?,?,?)").run(roomId, kind, before == null ? null : json(before), after == null ? null : json(after), now);
  }
  diagnostic(kind, data = {}, now = (/* @__PURE__ */ new Date()).toISOString()) {
    try {
      this.db.prepare("INSERT INTO diagnostics(room_id,member_id,session_id,kind,data_json,created_at) VALUES(?,?,?,?,?,?)").run(data.roomId || null, data.memberId || null, data.sessionId || null, kind, json(data), now);
    } catch {
    }
  }
  diagnostics(roomId, after = 0, limit = 200) {
    this.room(roomId);
    return this.db.prepare("SELECT * FROM diagnostics WHERE room_id=? AND seq>? ORDER BY seq LIMIT ?").all(roomId, Number(after), Math.min(Number(limit) || 200, 1e3)).map((row) => ({ seq: row.seq, kind: row.kind, createdAt: row.created_at, ...parse(row.data_json, {}) }));
  }
};

// src/core/room-engine.mjs
function summarizeToolResult(result) {
  if (!result || typeof result !== "object") return { kind: "value" };
  const items = result.items || result.timeline || result.members || [];
  return {
    status: result.status || "ok",
    messageId: result.messageId || null,
    questionId: result.questionId || null,
    roomSeq: result.roomSeq ?? null,
    checkDecision: result.checkDecision || null,
    itemCount: Array.isArray(items) ? items.length : null,
    fullMessageIds: result.presentation?.messageIds || [],
    previewCount: Array.isArray(items) ? items.filter((item) => item?.preview || item?.full === false).length : null,
    unread: result.unread || null
  };
}
function reminderText(reminder) {
  const mentions = reminder.unread_mentions || [];
  const lines = [
    `\u4F60\u6709 ${reminder.unread_count} \u6761\u672A\u8BFB\uFF0C\u5176\u4E2D ${reminder.unread_mention_count} \u6761 @ \u4F60\u3002`,
    ...mentions.map((item) => `- #${item.roomSeq}\uFF08${item.createdAt}\uFF09\uFF1A\`${item.messageId}\``),
    '\u7528 room_unread() \u9605\u8BFB\uFF0C\u6216\u7528 room_context({messageId: "..."}) \u5B9A\u4F4D\u3002\u63D0\u9192\u4E0D\u542B\u6B63\u6587\uFF0C\u4E5F\u4E0D\u6539\u53D8\u5DF2\u8BFB\u3002'
  ];
  if (reminder.reason === "question-answered") lines.push(`\u539F\u56E0\uFF1A\u4F60\u7684\u95EE\u9898\u6709\u4E86\u56DE\u7B54\u3002\u7B54\u6848\u6D88\u606F ID\uFF1A\`${reminder.answer_message_id}\`\u3002`);
  return lines.join("\n");
}
var RoomEngine = class {
  constructor(store, options = {}) {
    this.store = store;
    this.now = options.now || (() => (/* @__PURE__ */ new Date()).toISOString());
    this.statusProvider = options.statusProvider || (async () => ({ status: "unknown" }));
    this.rootSessionProvider = options.rootSessionProvider || null;
    this.rootChecks = /* @__PURE__ */ new Map();
    this.onChange = options.onChange || (() => {
    });
    this.waitKinds = options.waitKinds || /* @__PURE__ */ new Map();
    this.pendingChecks = /* @__PURE__ */ new Set();
    this.decisionSignatures = /* @__PURE__ */ new Map();
    this.scanning = false;
    this.timer = null;
    this.store.recoverExpiredReminders(this.now());
  }
  start(interval = 1e3) {
    if (this.timer) return () => {
    };
    this.timer = setInterval(() => void this.scan().catch((error) => this.store.diagnostic("scan-failed", { error: error.message })), interval);
    this.timer.unref?.();
    void this.scan().catch((error) => this.store.diagnostic("scan-failed", { error: error.message }));
    return () => {
      clearInterval(this.timer);
      this.timer = null;
    };
  }
  changed(roomId) {
    try {
      this.onChange({ roomId });
    } catch {
    }
  }
  createRoom(input) {
    const room = this.store.createRoom(input, this.now());
    this.store.diagnostic("room-created", { roomId: room.roomId, projectDir: room.projectDir });
    this.changed(room.roomId);
    return room;
  }
  retryCreation(roomId) {
    const room = this.store.retryCreation(roomId);
    this.changed(roomId);
    return room;
  }
  post(roomId, source, input) {
    const result = this.store.post(roomId, source, input, this.now());
    this.store.diagnostic(result.status === "review_required" ? "pre-send-review" : "room-post", { roomId, memberId: source.memberId, ...summarizeToolResult(result) });
    if (result.status === "stored") this.afterMessage(result.messageId);
    else this.changed(roomId);
    return result;
  }
  ask(roomId, source, input) {
    const result = this.store.ask(roomId, source, input, this.now());
    this.store.diagnostic(result.status === "review_required" ? "pre-send-review" : "room-ask", { roomId, memberId: source.memberId, ...summarizeToolResult(result) });
    if (result.status === "stored") this.afterMessage(result.messageId);
    else this.changed(roomId);
    return result;
  }
  answer(roomId, questionId, input) {
    const result = this.store.answerQuestion(roomId, questionId, input, this.now());
    this.afterMessage(result.messageId, result.askerId);
    this.changed(roomId);
    return result;
  }
  withdraw(roomId, source, questionId, input) {
    const result = this.store.withdrawQuestion(roomId, source, questionId, input, this.now());
    this.store.diagnostic("question-withdrawn", { roomId, memberId: source.memberId, questionId });
    this.changed(roomId);
    return result;
  }
  afterMessage(messageId, answerAskerId = null) {
    const message = this.store.message(messageId);
    const mentions = new Set(this.store.mentionedMembers(messageId).map((member) => member.id));
    for (const member of this.store.agents(message.room_id)) {
      if (member.id === message.author_id) continue;
      if (mentions.has(member.id) || member.id === answerAskerId) {
        this.store.ensureReminder(message.room_id, member.id, {
          kind: "steer",
          triggerKey: answerAskerId === member.id ? `answer:${message.question_id || messageId}` : `message:${messageId}`,
          reason: answerAskerId === member.id ? "question-answered" : "mention",
          answerMessageId: answerAskerId === member.id ? messageId : null
        }, this.now());
      }
      this.checkMemberLater(message.room_id, member.id);
    }
    this.changed(message.room_id);
  }
  checkMemberLater(roomId, memberId) {
    const promise = Promise.resolve().then(() => this.recheckMember(roomId, memberId)).catch((error) => {
      this.store.diagnostic("status-check-failed", { roomId, memberId, error: error.message });
    }).finally(() => this.pendingChecks.delete(promise));
    this.pendingChecks.add(promise);
  }
  async flush() {
    while (this.pendingChecks.size) await Promise.all([...this.pendingChecks]);
  }
  diagnosticOnce(key, kind, data) {
    if (this.decisionSignatures.get(key) === kind) return;
    this.decisionSignatures.set(key, kind);
    this.store.diagnostic(kind, data);
  }
  async queryStatus(member) {
    try {
      const result = await this.statusProvider(member.session_id);
      return result?.status || "unknown";
    } catch (error) {
      this.diagnosticOnce(`status-error:${member.session_id}:${error.message}`, "session-status-error", { roomId: member.room_id, memberId: member.id, sessionId: member.session_id, error: error.message });
      return "unknown";
    }
  }
  async recheckMember(roomId, memberId) {
    const room = this.store.room(roomId);
    const member = this.store.member(memberId);
    if (room.status !== "ready" || member.creation_status !== "ready") return null;
    const before = this.store.unreadSummary(roomId, memberId, []);
    if (!before.unreadCount) return null;
    const status = await this.queryStatus(member);
    const observed = this.store.setSessionStatus(member.session_id, status, this.now());
    let reminder = null;
    if (status === "idle") {
      reminder = this.store.ensureReminder(roomId, memberId, {
        kind: "queue",
        triggerKey: `idle:${observed.member.idle_epoch}`,
        reason: "round-end"
      }, this.now());
    }
    const reason = status === "idle" ? "round-end" : `session-${status}`;
    this.diagnosticOnce(`wake:${memberId}:${status}:${before.unreadCount}:${before.unreadMentionCount}:${reminder?.id || "none"}`, "wake-decision", {
      roomId,
      memberId,
      sessionId: member.session_id,
      status,
      unreadCount: before.unreadCount,
      unreadMentionCount: before.unreadMentionCount,
      reminderId: reminder?.id || null,
      reason
    });
    return { status, reminder };
  }
  async scan() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      this.store.recoverExpiredReminders(this.now());
      for (const room of this.store.listRooms()) {
        if (room.status !== "ready") continue;
        for (const member of this.store.agents(room.roomId)) {
          if (member.creation_status !== "ready") continue;
          if (!this.store.unreadSummary(room.roomId, member.id, []).unreadCount) continue;
          await this.recheckMember(room.roomId, member.id);
        }
      }
    } finally {
      this.scanning = false;
    }
  }
  async memberStatuses(roomId) {
    const members = this.store.agents(roomId);
    const statuses = await Promise.all(members.map((member) => this.queryStatus(member)));
    return Object.fromEntries(members.map((member, index) => [member.id, statuses[index]]));
  }
  async ensureRootSession(roomId) {
    if (!this.rootSessionProvider) return;
    const room = this.store.room(roomId);
    if (room.status === "ended" || room.root_creation_status !== "ready" || !room.root_session_id) return;
    const checkedAt = this.rootChecks.get(roomId) || 0;
    if (Date.now() - checkedAt < 3e4) return;
    try {
      await this.rootSessionProvider(room.root_session_id);
      this.rootChecks.set(roomId, Date.now());
    } catch (error) {
      if (error?.status !== 404) return;
      if (this.store.resetMissingRoot(roomId)) this.changed(roomId);
      this.rootChecks.delete(roomId);
    }
  }
  async roomState(roomId) {
    await this.ensureRootSession(roomId);
    const summary = this.store.roomSummary(this.store.room(roomId));
    const statuses = await this.memberStatuses(roomId);
    summary.members = summary.members.map((member) => member.kind === "agent" ? { ...member, sessionStatus: statuses[member.memberId] || "unknown" } : member);
    summary.reminders = this.store.reminders(roomId, 30);
    return summary;
  }
  listRooms(projectDir) {
    return this.store.listRooms(projectDir);
  }
  timeline(roomId, input = {}) {
    return this.store.history(roomId, { ...input, trackPresentation: false, viewerMemberId: input.viewerMemberId || this.store.room(roomId).human_id }, this.now());
  }
  context(roomId, messageId, input = {}) {
    return this.store.context(roomId, messageId, { ...input, trackPresentation: false, viewerMemberId: this.store.room(roomId).human_id }, this.now());
  }
  questions(roomId, input = {}) {
    return this.store.questions(roomId, input);
  }
  receipts(roomId, messageId) {
    return this.store.receipts(roomId, messageId);
  }
  diagnostics(roomId, after = 0) {
    return this.store.diagnostics(roomId, after);
  }
  markRead(roomId, memberId, messageIds, source = "ui") {
    const result = this.store.markRead(roomId, memberId, messageIds, source, this.now());
    if (result.marked > 0) this.changed(roomId);
    return result;
  }
  confirmPresentation(presentationId, sessionID) {
    const result = this.store.confirmPresentation(presentationId, sessionID, this.now());
    if (result.confirmed) this.changed(result.roomId);
    return result;
  }
  pause(roomId, reason = "manual") {
    const room = this.store.pauseRoom(roomId, reason, this.now());
    this.changed(roomId);
    return room;
  }
  resume(roomId, budgetLimit = 50) {
    const room = this.store.resumeRoom(roomId, budgetLimit, this.now());
    this.changed(roomId);
    void this.scan().catch((error) => this.store.diagnostic("scan-failed", { error: error.message }));
    return room;
  }
  end(roomId) {
    const room = this.store.endRoom(roomId, this.now());
    this.changed(roomId);
    return room;
  }
  rename(roomId, memberId, displayName) {
    const member = this.store.renameMember(roomId, memberId, displayName);
    this.changed(roomId);
    return member;
  }
  executionEvent(sessionID, type, eventID) {
    let member;
    try {
      member = this.store.memberBySession(sessionID);
    } catch {
      return;
    }
    const result = this.store.executionEvent(sessionID, type, eventID, this.now());
    if (result.changed) this.store.diagnostic("execution-event", { roomId: member.room_id, memberId: member.id, sessionId: sessionID, type, eventId: eventID || null, changed: true });
    if (result.terminal) {
      this.checkMemberLater(member.room_id, member.id);
      const retry = setTimeout(() => this.checkMemberLater(member.room_id, member.id), 100);
      retry.unref?.();
    }
    this.changed(member.room_id);
    return result;
  }
  hostEvent(event) {
    const sessionID = event.session?.id;
    if (!sessionID) return;
    let member;
    try {
      member = this.store.memberBySession(sessionID);
    } catch {
      return;
    }
    if (event.type === "permission-asked" || event.type === "question-asked") {
      this.waitKinds.set(sessionID, event.type === "permission-asked" ? "waiting-permission" : "waiting-question");
      this.store.diagnostic("native-wait-started", { roomId: member.room_id, memberId: member.id, sessionId: sessionID, kind: this.waitKinds.get(sessionID) });
      this.changed(member.room_id);
    } else if (event.type === "turn-started") {
      this.waitKinds.delete(sessionID);
    } else if (event.type === "turn-finished" || event.type === "turn-failed") {
      this.waitKinds.delete(sessionID);
      this.executionEvent(sessionID, event.type === "turn-finished" ? "succeeded" : "failed", `host:${event.id}`);
    }
  }
  async tool(sessionID, name, input = {}) {
    const member = this.store.memberBySession(sessionID);
    const roomId = member.room_id;
    try {
      let result;
      switch (name) {
        case "room_unread":
          result = input.mentionCursor != null || input.mentionsOnly === true ? this.store.mentionMetadata(roomId, member.id, input) : this.store.unread(roomId, member.id, input, this.now());
          break;
        case "room_history":
          result = this.store.history(roomId, { ...input, viewerMemberId: member.id }, this.now());
          break;
        case "room_context":
          result = this.store.context(roomId, input.messageId, { ...input, viewerMemberId: member.id }, this.now());
          break;
        case "room_members": {
          const statuses = await this.memberStatuses(roomId);
          result = {
            roomId,
            members: [
              { memberId: this.store.room(roomId).human_id, displayName: this.store.room(roomId).human_name, kind: "human", role: "host" },
              ...this.store.agents(roomId).map((item) => ({ memberId: item.id, displayName: item.display_name, kind: item.kind, role: item.role, sessionStatus: statuses[item.id] || "unknown" }))
            ]
          };
          break;
        }
        case "room_questions":
          result = this.store.questions(roomId, input);
          break;
        case "room_post":
          result = this.post(roomId, { kind: "agent", memberId: member.id }, input);
          break;
        case "room_ask":
          result = this.ask(roomId, { kind: "agent", memberId: member.id }, input);
          break;
        case "room_withdraw_question":
          result = this.withdraw(roomId, { kind: "agent", memberId: member.id }, input.questionId, input);
          break;
        default:
          throw new RoomError("ROOM_UNKNOWN_TOOL", `Unknown room tool: ${name}`, {}, 400);
      }
      this.store.diagnostic(`tool:${name}`, { roomId, memberId: member.id, sessionId: sessionID, ...summarizeToolResult(result) });
      return result;
    } catch (error) {
      this.store.diagnostic(`tool:${name}`, { roomId, memberId: member.id, sessionId: sessionID, status: "error", code: error.code, error: error.message });
      throw error;
    }
  }
  nextJob() {
    const now = this.now();
    const due = (member) => !member.next_attempt_at || Date.parse(member.next_attempt_at) <= Date.parse(now);
    const rootDue = (room) => !room.root_next_attempt_at || Date.parse(room.root_next_attempt_at) <= Date.parse(now);
    for (const room of this.store.listRooms()) {
      if (room.status === "ended") {
        for (const member of this.store.agents(room.roomId)) {
          if (member.session_id && member.instructions_added && due(member)) {
            this.store.taskAttempt(room.roomId, member.id, now);
            return { jobId: `remove:${room.roomId}:${member.id}`, type: "remove-instructions", roomId: room.roomId, memberId: member.id, sessionId: member.session_id, key: "discussions.room" };
          }
        }
      }
    }
    for (const listed of this.store.listRooms()) {
      if (listed.status === "ended") continue;
      const room = this.store.prepareRoomRoot(listed.roomId);
      const roomId = room.id;
      if (room.root_creation_status !== "ready") {
        if (!rootDue(room)) continue;
        this.store.rootTaskAttempt(roomId, now);
        return {
          jobId: `root:${roomId}`,
          type: "create-root-session",
          roomId,
          sessionId: room.root_session_id,
          title: `${room.title} \xB7 \u8BA8\u8BBA\u5BA4`,
          directory: room.project_dir,
          metadata: { discussionRoomId: roomId, discussionRoot: true },
          note: `\u8FD9\u662F\u201C${room.title}\u201D\u7684\u8BA8\u8BBA\u5BA4\u4F1A\u8BDD\u7EC4\u3002\u6210\u5458\u4F1A\u8BDD\u4E0D\u4F1A\u663E\u793A\u5728\u4FA7\u680F\uFF0C\u8BF7\u4ECE\u201C\u591A\u667A\u80FD\u4F53\u8BA8\u8BBA\u5BA4\u201D\u9875\u9762\u4E2D\u7684\u6210\u5458\u201C\u4F1A\u8BDD\u201D\u6309\u94AE\u6253\u5F00\u3002\u623F\u95F4\u81EA\u52A8\u8C03\u5EA6\u4E0D\u4F1A\u5411\u672C\u4F1A\u8BDD\u8C03\u7528\u6A21\u578B\uFF1B\u8BF7\u52FF\u76F4\u63A5\u5411\u672C\u4F1A\u8BDD\u53D1\u9001\u8BAE\u9898\u3002`
        };
      }
      for (const member of this.store.agents(roomId)) {
        if (!due(member)) continue;
        const metadata = {
          discussionRoomId: roomId,
          discussionMemberId: member.id,
          openchamber: { kind: "workflow-agent", parentID: room.root_session_id }
        };
        const title = `${room.title} \xB7 ${member.display_name}`;
        if (member.session_id && !member.session_linked) {
          this.store.taskAttempt(roomId, member.id, now);
          return { jobId: `link:${roomId}:${member.id}`, type: "link-session", roomId, memberId: member.id, sessionId: member.session_id, title, metadata };
        }
        if (room.status === "ended") continue;
        if (!member.session_id && member.creation_status === "pending") {
          this.store.taskAttempt(roomId, member.id, now);
          return {
            jobId: `create:${roomId}:${member.id}`,
            type: "create-session",
            roomId,
            memberId: member.id,
            sessionId: `ses_disc_${roomId}_${member.id}`,
            title,
            directory: room.project_dir,
            model: JSON.parse(member.model_json),
            permissions: [
              { action: "*", resource: "*", effect: "allow" },
              { action: "question", resource: "*", effect: "deny" }
            ],
            metadata
          };
        }
        if (member.session_id && !member.instructions_added) {
          this.store.taskAttempt(roomId, member.id, now);
          return { jobId: `instructions:${roomId}:${member.id}`, type: "put-instructions", roomId, memberId: member.id, sessionId: member.session_id, ...this.store.instructions(roomId, member.id) };
        }
      }
    }
    return null;
  }
  reminderRelevant(reminder) {
    if (reminder.kind === "queue") return true;
    const messageId = reminder.trigger_key.split(":")[1];
    const message = this.store.db.prepare("SELECT * FROM messages WHERE id=? AND room_id=?").get(messageId, reminder.room_id);
    if (!message || this.store.hasRead(reminder.member_id, message.id)) return false;
    if (reminder.trigger_key.startsWith("answer:")) {
      const question = this.store.db.prepare("SELECT * FROM questions WHERE answer_message_id=? AND asker_id=?").get(message.id, reminder.member_id);
      return !!question;
    }
    return message.author_id !== reminder.member_id && (message.mention_all === 1 || !!this.store.db.prepare("SELECT 1 FROM message_mentions WHERE message_id=? AND member_id=?").get(message.id, reminder.member_id));
  }
  async dispatchNext() {
    const creation = this.nextJob();
    if (creation) return creation;
    this.store.recoverExpiredReminders(this.now());
    const deadline = Date.now() + 8e3;
    for (const candidate of this.store.dueReminders(null, 100, this.now())) {
      if (Date.now() >= deadline) break;
      if (candidate.member.creation_status !== "ready") continue;
      const canRetryCharged = candidate.charged === 1 && candidate.room.status === "paused" && candidate.room.paused_reason === "budget";
      if (candidate.room.status !== "ready" && !canRetryCharged) continue;
      let reminder = this.store.refreshReminder(candidate.id, this.now());
      if (!reminder?.unread_count) {
        this.store.cancelReminder(candidate.id, "No unread messages remain");
        continue;
      }
      if (!this.reminderRelevant(reminder)) {
        this.store.cancelReminder(candidate.id, "Mentioned message is no longer unread");
        continue;
      }
      const member = this.store.member(reminder.member_id);
      const status = await this.queryStatus(member);
      if (Date.now() >= deadline) {
        this.store.deferReminder(reminder.id, `Status check exceeded the dispatch time budget`, this.now());
        break;
      }
      const waiting = status === "unknown" || status === "waiting-human" || status === "waiting-question" || status === "waiting-permission";
      if (waiting || reminder.kind === "queue" && status !== "idle") {
        this.store.deferReminder(reminder.id, waiting ? `Session status is ${status}; reminder deferred` : `Session is ${status}; ordinary reminder waits for idle`, this.now());
        continue;
      }
      reminder = this.store.refreshReminder(reminder.id, this.now());
      if (!reminder?.unread_count) {
        this.store.cancelReminder(candidate.id, "Messages were read before dispatch");
        continue;
      }
      const reserved = this.store.reserveReminder(reminder.id, this.now());
      if (!reserved) continue;
      this.store.markSubmitting(reminder.id, this.now());
      const summary = this.store.unreadSummary(reminder.room_id, reminder.member_id, []);
      if (!summary.unreadCount) {
        this.store.ackReminder(reminder.id, "failed", "Messages were read before submission");
        continue;
      }
      const payload = { ...reminder, unread_count: summary.unreadCount, unread_mention_count: summary.unreadMentionCount, unread_mentions: summary.unreadMentions };
      this.store.diagnostic("reminder-submitting", { roomId: reminder.room_id, memberId: reminder.member_id, reminderId: reminder.id, kind: reminder.kind, snapshotSeq: reminder.snapshot_seq, unreadCount: summary.unreadCount, budgetRemaining: this.store.room(reminder.room_id).budget_remaining });
      this.changed(reminder.room_id);
      return {
        jobId: reminder.id,
        type: "submit-reminder",
        roomId: reminder.room_id,
        memberId: reminder.member_id,
        sessionId: member.session_id,
        inputId: reminder.input_id,
        delivery: reminder.kind,
        text: reminderText(payload),
        metadata: { discussionRoomId: reminder.room_id, discussionMemberId: reminder.member_id, reminderId: reminder.id, reminderKind: reminder.kind, snapshotSeq: reminder.snapshot_seq }
      };
    }
    return null;
  }
  async jobResult(job, result) {
    const outcome = result.outcome;
    if (job.type === "create-root-session") {
      if (outcome === "accepted") this.store.rootSessionCreated(job.roomId, result.sessionId, this.now());
      else this.store.rootSessionFailed(job.roomId, result.error || "Room root session creation failed", this.now());
    } else if (job.type === "create-session") {
      if (outcome === "accepted") this.store.sessionCreated(job.roomId, job.memberId, result.sessionId, this.now());
      else this.store.sessionFailed(job.roomId, job.memberId, result.error || "Session creation failed");
    } else if (job.type === "link-session") {
      if (outcome === "accepted") this.store.sessionLinked(job.roomId, job.memberId);
      else this.store.taskFailed(job.roomId, job.memberId, result.error || "Session grouping failed", this.now());
    } else if (job.type === "put-instructions") {
      if (outcome === "accepted") this.store.instructionsAdded(job.roomId, job.memberId);
      else if (!this.store.member(job.memberId).instructions_added) this.store.taskFailed(job.roomId, job.memberId, result.error || "Instruction update failed", this.now());
    } else if (job.type === "remove-instructions") {
      if (outcome === "accepted") this.store.instructionsRemoved(job.roomId, job.memberId);
      else if (this.store.member(job.memberId).instructions_added) this.store.taskFailed(job.roomId, job.memberId, result.error || "Instruction removal failed", this.now());
    } else if (job.type === "submit-reminder") {
      const reminder = this.store.ackReminder(job.jobId, outcome, result.error, this.now());
      if (outcome === "accepted" && reminder?.status === "accepted" && reminder.kind === "steer") this.store.coverOrdinary(reminder.room_id, reminder.member_id, reminder, this.now());
      this.store.diagnostic("reminder-result", { roomId: job.roomId, memberId: job.memberId, reminderId: job.jobId, outcome, inputId: job.inputId, error: result.error || null });
    }
    this.changed(job.roomId);
    return { ok: true };
  }
  mentionCandidates(roomId) {
    const room = this.store.room(roomId);
    return [
      ...this.store.agents(roomId).map((member) => ({ id: member.id, label: member.display_name, kind: "agent" })),
      { id: "@all", label: "\u6240\u6709\u4EBA", kind: "all" }
    ];
  }
};

// src/service/main.mjs
var VERSION = "0.1.0";
var MAX_BODY = 1024 * 1024;
function packageRoot() {
  return resolve(fileURLToPath(new URL("../", import.meta.url)));
}
function resolveTempRoot(env = process.env) {
  const explicit = env.OPENCODE_TMP_DIR || env.OPENCHAMBER_DISCUSSION_TMP_ROOT;
  if (explicit) return resolve(explicit);
  const inherited = env.TMPDIR || env.TEMP || env.TMP || tmpdir();
  return basename(inherited) === "opencode" ? resolve(inherited) : join2(resolve(inherited), "opencode");
}
function rendezvousTempRoot(env = process.env) {
  const inherited = env.TMPDIR || env.TEMP || env.TMP || tmpdir();
  return basename(inherited) === "opencode" ? resolve(inherited) : join2(resolve(inherited), "opencode");
}
function bridgePath(root = packageRoot()) {
  const key = createHash("sha256").update(root).digest("hex").slice(0, 20);
  return join2(rendezvousTempRoot(), "discussions", `service-${key}.json`);
}
function atomicWrite(filename, value) {
  mkdirSync2(resolve(filename, ".."), { recursive: true });
  writeFileSync(filename + ".tmp", value, { mode: 384 });
  renameSync(filename + ".tmp", filename);
}
function json2(res, status, value) {
  const body2 = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body2) });
  res.end(body2);
}
async function body(req) {
  let text = "";
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new RoomError("ROOM_REQUEST_TOO_LARGE", "Request body is too large.", {}, 413);
    text += chunk;
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new RoomError("ROOM_INVALID_JSON", "Request body must be JSON.", {}, 400);
  }
}
function defaultHumanName() {
  try {
    return userInfo().username || "\u623F\u4E3B";
  } catch {
    return "\u623F\u4E3B";
  }
}
function normalizeModels(models) {
  return (Array.isArray(models) ? models : []).map((model) => ({
    providerID: model.providerID,
    id: model.id,
    name: model.name || model.id,
    providerName: model.providerName || model.provider?.name || model.providerID,
    capabilities: model.capabilities || {},
    ...model.variant ? { variant: model.variant } : {}
  }));
}
function createDiscussionService(options = {}) {
  const store = options.store || new RoomStore(options.database || ":memory:");
  const serviceToken = options.serviceToken || randomBytes(32).toString("base64url");
  const pluginToken = options.pluginToken || randomBytes(32).toString("base64url");
  const tempRoot = options.tempRoot || resolveTempRoot();
  const opencodeURL = options.opencodeURL || process.env.OPENCHAMBER_OPENCODE_URL || "";
  const serviceHost = options.serviceHost || null;
  const waitKinds = options.waitKinds || /* @__PURE__ */ new Map();
  const modelCatalogFile = options.modelCatalogFile || (options.database && options.database !== ":memory:" ? `${options.database}.models.json` : null);
  let catalogSnapshot = {};
  if (modelCatalogFile) {
    try {
      catalogSnapshot = JSON.parse(readFileSync(modelCatalogFile, "utf8"));
    } catch {
    }
  }
  let models = options.models || catalogSnapshot.global || [];
  const modelCatalogs = new Map(Object.entries(catalogSnapshot.directories || {}));
  const statusCache = /* @__PURE__ */ new Map();
  const statusErrors = /* @__PURE__ */ new Map();
  let engine;
  async function opencode(path) {
    if (!opencodeURL) throw new Error("OpenCode read access is unavailable");
    const response = await fetch(opencodeURL.replace(/\/$/, "") + path, {
      headers: { authorization: `Bearer ${serviceToken}` },
      signal: AbortSignal.timeout(5e3)
    });
    if (!response.ok) {
      const error = new Error(`OpenCode read returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }
  async function statusProvider(sessionID) {
    const cached = statusCache.get(sessionID);
    if (cached && Date.now() - cached.at < 300) return cached.value;
    let value = { status: "unknown" };
    try {
      const [activeResponse, hostState] = await Promise.all([
        opencode("/api/session/active"),
        serviceHost ? serviceHost.sessions.status(sessionID) : Promise.reject(new Error("Host status unavailable"))
      ]);
      const hostStatus = hostState?.status;
      const active = activeResponse.data || {};
      if (hostStatus === "waiting") value = { status: waitKinds.get(sessionID) || "waiting-human" };
      else if (hostStatus === "busy" || active[sessionID]) value = { status: "running" };
      else if (hostStatus === "idle") value = { status: "idle" };
    } catch (error) {
      if (statusErrors.get(sessionID) !== error.message) {
        statusErrors.set(sessionID, error.message);
        store.diagnostic("status-provider-error", { sessionId: sessionID, error: error.message });
      }
    }
    statusCache.set(sessionID, { at: Date.now(), value });
    return value;
  }
  engine = options.engine || new RoomEngine(store, {
    statusProvider,
    waitKinds,
    rootSessionProvider: (sessionID) => opencode(`/api/session/${encodeURIComponent(sessionID)}`),
    onChange: (event) => {
      statusCache.clear();
      if (serviceHost) void serviceHost.emit("room:changed", event).catch(() => {
      });
    }
  });
  function human(roomId) {
    return { kind: "human", memberId: store.room(roomId).human_id };
  }
  function query(url) {
    return Object.fromEntries(url.searchParams);
  }
  function roomIdFrom(path) {
    const match = path.match(/^\/rooms\/([^/]+)(?:\/(.*))?$/);
    return match ? { roomId: decodeURIComponent(match[1]), rest: match[2] || "" } : null;
  }
  function readWorkspace(roomId, requested) {
    const room = store.room(roomId);
    if (typeof requested !== "string" || !isAbsolute(requested) || requested.includes("\0")) throw new RoomError("ROOM_BAD_PATH", "Use an absolute path inside this room's temporary directory.", {}, 400);
    const base = realpathSync(room.workspace_dir);
    let target;
    try {
      target = realpathSync(requested);
    } catch {
      throw new RoomError("ROOM_FILE_NOT_FOUND", "The discussion file does not exist.", {}, 404);
    }
    if (target !== base && !target.startsWith(base + sep)) throw new RoomError("ROOM_BAD_PATH", "The path leaves this room's temporary directory.", {}, 403);
    const info = statSync(target);
    if (!info.isFile()) throw new RoomError("ROOM_BAD_PATH", "Only regular files can be previewed.", {}, 400);
    if (info.size > 2 * 1024 * 1024) throw new RoomError("ROOM_FILE_TOO_LARGE", "The preview limit is 2 MB.", {}, 413);
    return { path: target, content: readFileSync(target, "utf8") };
  }
  async function route(req, res, url) {
    const auth = req.headers.authorization;
    const isPlugin = auth === `Bearer ${pluginToken}`;
    if (auth !== `Bearer ${serviceToken}` && !isPlugin) return json2(res, 401, { error: { code: "ROOM_UNAUTHORIZED", message: "Unauthorized." } });
    if (url.pathname === "/health") return json2(res, 200, { ready: true, version: VERSION });
    if (isPlugin) {
      if (req.method === "GET" && url.pathname === "/plugin/work") return json2(res, 200, await engine.dispatchNext() || {});
      if (req.method === "POST" && url.pathname === "/plugin/result") {
        const input = await body(req);
        return json2(res, 200, await engine.jobResult(input.job, input.result || {}));
      }
      if (req.method === "POST" && url.pathname === "/plugin/tool") {
        const input = await body(req);
        return json2(res, 200, await engine.tool(input.sessionID, input.name, input.input || {}));
      }
      if (req.method === "POST" && url.pathname === "/plugin/event") {
        const event = await body(req);
        const type = event.type.replace("session.execution.", "");
        engine.executionEvent(event.data?.sessionID, type, event.id || (event.durable?.seq ? `${type}:${event.durable.seq}` : null));
        return json2(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/plugin/observe") {
        const input = await body(req);
        return json2(res, 200, { observed: store.observePresentation(input.presentationId, input.sessionID) });
      }
      if (req.method === "GET" && url.pathname === "/plugin/presentations") return json2(res, 200, { items: store.pendingPresentations() });
      if (req.method === "POST" && url.pathname === "/plugin/present") {
        const input = await body(req);
        return json2(res, 200, engine.confirmPresentation(input.presentationId, input.sessionID));
      }
      if (req.method === "POST" && url.pathname === "/plugin/catalog") {
        const input = await body(req);
        models = normalizeModels(input.models);
        if (input.directory) modelCatalogs.set(input.directory, models);
        if (modelCatalogFile) atomicWrite(modelCatalogFile, JSON.stringify({ global: models, directories: Object.fromEntries(modelCatalogs) }));
        if (serviceHost) void serviceHost.emit("models:changed", { directory: input.directory || null }).catch(() => {
        });
        return json2(res, 200, { ok: true, count: models.length });
      }
      if (req.method === "POST" && url.pathname === "/plugin/rpc/room") {
        const input = await body(req);
        return json2(res, 200, await engine.roomState(input.roomId));
      }
      return json2(res, 404, { error: { code: "ROOM_NOT_FOUND", message: "Plugin route not found." } });
    }
    if (req.method === "POST" && url.pathname === "/session-events") {
      const raw = await reqText(req);
      const request = readSessionEventRequest(raw);
      if (!request) return json2(res, 400, { ok: false, error: "not a session event" });
      engine.hostEvent(request.event);
      return json2(res, 200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/meta") return json2(res, 200, { humanName: defaultHumanName() });
    if (req.method === "GET" && url.pathname === "/models") {
      const directory = query(url).directory;
      const scoped = directory ? modelCatalogs.get(directory) : void 0;
      const catalog = scoped ?? models;
      const source = catalog.length ? scoped ? "project" : "global" : "empty";
      return json2(res, 200, { models: catalog, source, unicode: UNICODE_IMPLEMENTATION, maxAgentWidth: MAX_AGENT_MESSAGE_WIDTH });
    }
    if (req.method === "GET" && url.pathname === "/rooms") return json2(res, 200, { rooms: engine.listRooms(query(url).projectDir || null) });
    if (req.method === "POST" && url.pathname === "/rooms") {
      const input = await body(req);
      const name = input.humanName || defaultHumanName();
      return json2(res, 200, engine.createRoom({ ...input, humanName: name, tempRoot }));
    }
    if (req.method === "POST" && url.pathname === "/workspace/read") {
      const input = await body(req);
      return json2(res, 200, readWorkspace(input.roomId, input.path));
    }
    const target = roomIdFrom(url.pathname);
    if (!target) return json2(res, 404, { error: { code: "ROOM_NOT_FOUND", message: "Route not found." } });
    const { roomId, rest } = target;
    if (req.method === "GET" && !rest) return json2(res, 200, await engine.roomState(roomId));
    if (req.method === "POST" && rest === "retry") return json2(res, 200, engine.retryCreation(roomId));
    if (req.method === "POST" && rest === "messages") {
      const input = await body(req);
      return json2(res, 200, engine.post(roomId, human(roomId), input));
    }
    if (req.method === "GET" && rest === "timeline") return json2(res, 200, engine.timeline(roomId, query(url)));
    if (req.method === "GET" && rest === "questions") return json2(res, 200, engine.questions(roomId, query(url)));
    if (req.method === "GET" && rest === "mentions") return json2(res, 200, { items: engine.mentionCandidates(roomId) });
    if (req.method === "GET" && rest === "diagnostics") return json2(res, 200, { items: engine.diagnostics(roomId, query(url).after || 0) });
    const answerMatch = rest.match(/^questions\/([^/]+)\/answer$/);
    if (req.method === "POST" && answerMatch) {
      const input = await body(req);
      return json2(res, 200, engine.answer(roomId, decodeURIComponent(answerMatch[1]), input));
    }
    const withdrawMatch = rest.match(/^questions\/([^/]+)\/withdraw$/);
    if (req.method === "POST" && withdrawMatch) {
      const input = await body(req);
      return json2(res, 200, engine.withdraw(roomId, human(roomId), decodeURIComponent(withdrawMatch[1]), input));
    }
    const contextMatch = rest.match(/^messages\/([^/]+)\/context$/);
    if (req.method === "GET" && contextMatch) return json2(res, 200, engine.context(roomId, decodeURIComponent(contextMatch[1]), query(url)));
    const receiptMatch = rest.match(/^messages\/([^/]+)\/receipts$/);
    if (req.method === "GET" && receiptMatch) return json2(res, 200, engine.receipts(roomId, decodeURIComponent(receiptMatch[1])));
    if (req.method === "POST" && rest === "read") {
      const input = await body(req);
      return json2(res, 200, engine.markRead(roomId, store.room(roomId).human_id, input.messageIds || [], "ui"));
    }
    if (req.method === "POST" && rest === "pause") return json2(res, 200, engine.pause(roomId, "manual"));
    if (req.method === "POST" && rest === "resume") {
      const input = await body(req);
      return json2(res, 200, engine.resume(roomId, Number(input.budgetLimit) || 50));
    }
    if (req.method === "POST" && rest === "end") return json2(res, 200, engine.end(roomId));
    const renameMatch = rest.match(/^members\/([^/]+)\/rename$/);
    if (req.method === "POST" && renameMatch) {
      const input = await body(req);
      return json2(res, 200, engine.rename(roomId, decodeURIComponent(renameMatch[1]), input.displayName));
    }
    return json2(res, 404, { error: { code: "ROOM_NOT_FOUND", message: "Route not found." } });
  }
  async function reqText(req) {
    let text = "";
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw new RoomError("ROOM_REQUEST_TOO_LARGE", "Request body is too large.", {}, 413);
      text += chunk;
    }
    return text;
  }
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    route(req, res, url).catch((error) => {
      const normalized = asRoomError(error);
      if (!res.headersSent) json2(res, normalized.status, { error: { code: normalized.code, message: normalized.message, details: normalized.details } });
      else res.end();
    });
  });
  return { server, engine, store, serviceToken, pluginToken, tempRoot, getModels: () => models };
}
function writeBridge(info, root = packageRoot()) {
  const filename = bridgePath(root);
  atomicWrite(filename, JSON.stringify({ endpoint: `http://127.0.0.1:${info.server.address().port}`, token: info.pluginToken, version: VERSION }, null, 2));
  return filename;
}
async function main() {
  const port = Number(process.env.OPENCHAMBER_SERVICE_PORT);
  const token = process.env.OPENCHAMBER_SERVICE_TOKEN;
  if (!port || !token) throw new Error("OPENCHAMBER_SERVICE_PORT and OPENCHAMBER_SERVICE_TOKEN are required");
  const dataDir = process.env.OPENCHAMBER_SERVICE_DATA_DIR || join2(packageRoot(), ".runtime");
  mkdirSync2(dataDir, { recursive: true });
  const serviceHost = createServiceHost({ env: process.env });
  const service = createDiscussionService({
    database: join2(dataDir, "rooms.sqlite"),
    serviceToken: token,
    opencodeURL: process.env.OPENCHAMBER_OPENCODE_URL,
    serviceHost
  });
  service.server.listen(port, "127.0.0.1", () => {
    writeBridge(service);
    service.engine.start(1e3);
    console.log(`Multi-agent discussion service ${VERSION} listening on 127.0.0.1:${port}`);
  });
  const stop = () => {
    service.engine.timer && clearInterval(service.engine.timer);
    service.store.close();
    service.server.close(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
if (process.env.OPENCHAMBER_SERVICE_PORT) await main();
export {
  createDiscussionService,
  resolveTempRoot,
  writeBridge
};
