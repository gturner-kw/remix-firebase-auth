export const HOST_URL = process.env.HOST_URL || "";
if (!HOST_URL) {
  throw new Error("HOST_URL must be set");
}

export const COOKIE_SECRET = process.env.COOKIE_SECRET || "";
if (!COOKIE_SECRET) {
  throw new Error("COOKIE_SECRET must be set");
}
