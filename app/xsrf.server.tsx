import { createCookieSessionStorage, json } from "@remix-run/node";
import uid from "uid-safe";
import { COOKIE_SECRET } from "./utils/constants.server";
import { XSRF_TIMEOUT_SECS } from "./utils/session/contants";

const CONTEXT = "context";

const xsrfTokenName = "__xsrf-token";

const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: xsrfTokenName,
    httpOnly: true,
    maxAge: XSRF_TIMEOUT_SECS,
    path: "/login",
    sameSite: "strict",
    secrets: [COOKIE_SECRET],
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
  session.set(CONTEXT, xsrfToken);
  return json({ xsrfToken }, { headers: { "Set-Cookie": await commitSession(session) } });
}

export async function getXsrfToken(request: Request) {
  return (await getSession(request.headers.get("cookie"))).get(CONTEXT);
}
