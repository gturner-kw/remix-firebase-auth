import { getAuth } from "~/user-admin.server";
import type { Session } from "@remix-run/node";
import { createCookieSessionStorage, Headers, json, redirect } from "@remix-run/node";
import type { SessionContext, User } from "./shared/session/types";
import { SESSION_TIMEOUT_SECS, REFRESH_TIMEOUT_SEC } from "./shared/session/contants";
import uidSafe from "uid-safe";
import type { DecodedIdToken } from "firebase-admin/lib/auth/token-verifier";

const CONTEXT = "context";

const cookieSecret = process.env.COOKIE_SECRET;
if (!cookieSecret) {
  throw new Error("COOKIE_SECRET must be set");
}

/**
 * Session Storage
 */

const SESSION_NAME = "__session";

type SessionStore = {
  user: User;
  state: SessionStateStore;
};

type SessionStateStore = {
  issued: number;
  expires: number;
};

const {
  getSession: getSessionStore,
  commitSession: commitSessionStore,
  destroySession: destroySessionStore
} = createCookieSessionStorage({
  cookie: {
    name: SESSION_NAME,
    httpOnly: true,
    path: "/",
    sameSite: "lax", // allow our links from other sites to send us this cookie
    secrets: [cookieSecret],
    secure: process.env.NODE_ENV === "production"
  }
});

function getSessionStoreFromCookie(request: Request) {
  return getSessionStore(request.headers.get("Cookie"));
}

/**
 * Refresh Storage
 */

const REFRESH_NAME = "__refresh";

type RefreshStore = {
  loggedIn: number;
  refreshToken: string;
  refreshExpires: number;
};

const {
  getSession: getRefreshStore,
  commitSession: commitRefreshStore,
  destroySession: destroyRefreshStore
} = createCookieSessionStorage({
  cookie: {
    name: REFRESH_NAME,
    httpOnly: true,
    path: "/",
    sameSite: "lax", // allow our links from other sites to send us this cookie
    secrets: [cookieSecret],
    secure: process.env.NODE_ENV === "production"
  }
});

function getRefreshStoreFromCookie(request: Request) {
  return getRefreshStore(request.headers.get("Cookie"));
}

export type UserSessionProperties = {
  admin: boolean;
};

/**
 * Storage methods
 */

function throwUnauthorizedAccess() {
  throw new Response("Unauthorized access", { status: 401 });
}

function generateCookieHeaders(values: string[]) {
  const headers = new Headers();
  (values || []).forEach(value => headers.append("Set-Cookie", value));
  return headers;
}

async function generateSessionHeaders({
  decodedIdToken,
  props,
  sessionStore,
  refreshStore
}: {
  decodedIdToken: DecodedIdToken;
  props: UserSessionProperties | null;
  sessionStore?: Session;
  refreshStore?: Session;
}): Promise<Headers> {
  if (!sessionStore) {
    sessionStore = await getSessionStore();
  }
  const { uid, email, email_verified: emailVerified } = decodedIdToken;
  const user: User = { uid, email, emailVerified, ...(props || {}) };
  const issued = Math.trunc(Date.now() / 1000);
  const expires = issued + SESSION_TIMEOUT_SECS;
  const state: SessionStateStore = { issued, expires };
  const sessionContext: SessionStore = { user, state };
  sessionStore.set(CONTEXT, sessionContext);

  if (!refreshStore) {
    refreshStore = await getRefreshStore();
  }
  const { auth_time } = decodedIdToken;
  const refreshExpires = issued + REFRESH_TIMEOUT_SEC;
  const refreshContext: RefreshStore = { loggedIn: auth_time, refreshToken: uidSafe.sync(18), refreshExpires };
  refreshStore.set(CONTEXT, refreshContext);

  return generateCookieHeaders([
    await commitSessionStore(sessionStore, { expires: new Date(expires * 1000) }),
    await commitRefreshStore(refreshStore, { expires: new Date(refreshExpires * 1000) })
  ]);
}

export async function createUserSession(idToken: string, props: UserSessionProperties | null, redirectTo: string) {
  // check if user was revoked on this call
  const decodedIdToken = await getAuth().verifyIdToken(idToken, true);
  if (!decodedIdToken) {
    throwUnauthorizedAccess();
  }

  const headers = await generateSessionHeaders({ decodedIdToken, props });
  return redirect(redirectTo, { headers });
}

export async function refreshUserSession(request: Request, refreshToken: string, idToken: string, props: UserSessionProperties | null) {
  // check if user was revoked on this call
  const decodedIdToken = await getAuth().verifyIdToken(idToken, true);
  if (!decodedIdToken) {
    throwUnauthorizedAccess();
  }

  const refreshStore = await getRefreshStoreFromCookie(request);
  const refreshContext = refreshStore.get(CONTEXT) as RefreshStore;
  if (!refreshContext?.refreshToken) {
    console.log("session expired - redirecting to login...");
    return redirect("/login");
  }
  if (refreshContext?.refreshToken !== refreshToken) {
    throwUnauthorizedAccess();
  }

  const headers = await generateSessionHeaders({ decodedIdToken, props, refreshStore });
  return json(null, { headers });
}

export async function logout(request: Request) {
  const sessionStore = await getSessionStoreFromCookie(request);
  const refreshStore = await getRefreshStoreFromCookie(request);
  const headers = generateCookieHeaders([await destroySessionStore(sessionStore), await destroyRefreshStore(refreshStore)]);
  return redirect("/login", { headers });
}

export async function getSessionContext(request: Request): Promise<SessionContext | null> {
  const sessionContext = (await getSessionStoreFromCookie(request)).get(CONTEXT) as SessionStore;
  const refreshContext = (await getRefreshStoreFromCookie(request)).get(CONTEXT) as RefreshStore;
  if (sessionContext || refreshContext) {
    const { user, state: sessionState } = sessionContext || {};
    return { user, state: { ...(sessionState || {}), ...(refreshContext || {}) } };
  }
  return null;
}

export async function verifySessionContext(request: Request): Promise<SessionContext | null> {
  const session = await getSessionContext(request);
  if (!session) {
    throw redirect("/login");
  }
  return session;
}
