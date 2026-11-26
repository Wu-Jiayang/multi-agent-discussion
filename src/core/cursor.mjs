export function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor(value, label = "cursor") {
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

export function requireCursor(cursor, expected, label) {
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
