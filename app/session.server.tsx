import { getAuth } from "~/user-admin.server";
import { createCookieSessionStorage, json, redirect } from "@remix-run/node";
import type { SessionContext, User } from "./session-types";

const cookieSecret = process.env.COOKIE_SECRET;
if (!cookieSecret) {
  throw new Error("COOKIE_SECRET must be set");
}

const sessionTokenName = "__session";

const {
  getSession: get,
  commitSession: commit,
  destroySession: destroy
} = createCookieSessionStorage({
  cookie: {
    name: sessionTokenName,
    httpOnly: true,
    maxAge: 3600, // 1 hour
    path: "/",
    sameSite: "lax", // allow our links from other sites to send us this cookie
    secrets: [cookieSecret],
    secure: process.env.NODE_ENV === "production"
  }
});

function getSession(request: Request) {
  return get(request.headers.get("Cookie"));
}

export type UserSessionProperties = {
  admin: boolean;
};

export async function createUserSession(idToken: string, props: UserSessionProperties | null, redirectTo?: string) {
  // check if user was revoked on this call
  const decodedIdToken = await getAuth().verifyIdToken(idToken, true);
  if (decodedIdToken) {
    const session = await get();
    const { uid, email, email_verified: emailVerified, auth_time, iat, exp } = decodedIdToken;
    const context = { loggedIn: auth_time, issued: iat, expires: exp, user: { uid, email, emailVerified, admin: props?.admin } };
    session.set("context", context);
    const init = { headers: { "Set-Cookie": await commit(session, { expires: new Date(exp * 1000) }) } };
    return redirectTo ? redirect(redirectTo, init) : json(null, init);
  } else {
    throw new Response("Unauthorized access", {
      status: 401
    });
  }
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroy(session)
    }
  });
}

export async function getSessionContext(request: Request): Promise<SessionContext | null> {
  const session = await getSession(request);
  const sessionContext = session.get("context") as SessionContext;
  return sessionContext || null;
}

export async function getUser(request: Request): Promise<User | null> {
  const sessionContext = await getSessionContext(request);
  return sessionContext?.user || null;
}

export async function verifyUser(request: Request): Promise<User | null> {
  const user = await getUser(request);
  if (!user) {
    throw redirect("/login");
  }
  return user;
}
