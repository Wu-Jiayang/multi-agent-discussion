export class RoomError extends Error {
  constructor(code, message, details = {}, status = 400) {
    super(message);
    this.name = "RoomError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export function fail(code, message, details = {}, status = 400) {
  throw new RoomError(code, message, details, status);
}

export function asRoomError(error) {
  return error instanceof RoomError
    ? error
    : new RoomError("ROOM_INTERNAL_ERROR", error?.message || "Unexpected room error", {}, 500);
}
