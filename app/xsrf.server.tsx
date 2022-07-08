import { createCookieSessionStorage, json } from "@remix-run/node";
import uid from "uid-safe";

const cookieSecret = process.env.COOKIE_SECRET;
if (!cookieSecret) {
  throw new Error("COOKIE_SECRET must be set");
}

const xsrfTokenName = "__xsrf-token";

const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: xsrfTokenName,
    httpOnly: true,
    maxAge: 3600, // 1 hour
    path: "/login",
    sameSite: "strict",
    secrets: [cookieSecret],
    secure: process.env.NODE_ENV === "production"
  }
});

export { getSession, commitSession, destroySession };

export async function createSession(request: Request) {
  const session = await getSession(request.headers.get("cookie"));
  let xsrfToken = session.get(xsrfTokenName);
  if (!xsrfToken) {
    // first time to page or exising token expired, generate a new one
    xsrfToken = uid.sync(18);
    console.log("creating new xsrfToken=", xsrfToken);
  }
  session.set(xsrfTokenName, xsrfToken);
  return json({ xsrfToken }, { headers: { "Set-Cookie": await commitSession(session) } });
}

export async function getCookieValue(request: Request) {
  return (await getSession(request.headers.get("cookie"))).get(xsrfTokenName);
}
