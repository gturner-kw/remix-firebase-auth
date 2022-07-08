import { getAuth } from "~/user-admin.server";
import { createCookieSessionStorage, redirect } from "@remix-run/node";

const cookieSecret = process.env.COOKIE_SECRET;
if (!cookieSecret) {
  throw new Error("COOKIE_SECRET must be set");
}

const sessionTokenName = "__session";

const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: sessionTokenName,
    httpOnly: true,
    maxAge: 3600 - 60, // 1 hour minus 1 minute
    path: "/",
    sameSite: "lax", // allow our links from other sites to send us this cookie
    secrets: [cookieSecret],
    secure: process.env.NODE_ENV === "production"
  }
});

export { getSession, commitSession, destroySession };

function getUserSession(request: Request) {
  return getSession(request.headers.get("Cookie"));
}

export type Context = {
  uid: string;
  email: string;
  emailVerified: boolean;
  admin: boolean;
};

export async function createUserSession(idToken: string, context: Context, redirectTo: string) {
  // check revoked user on this call
  const decodedIdToken = await getAuth().verifyIdToken(idToken, true);
  if (decodedIdToken) {
    const session = await getSession();
    const { uid, email, email_verified: emailVerified } = decodedIdToken;
    session.set(sessionTokenName, { ...context, uid, email, emailVerified });
    return redirect(redirectTo, { headers: { "Set-Cookie": await commitSession(session) } });
  } else {
    throw new Response("Unauthorized access", {
      status: 401
    });
  }
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session)
    }
  });
}

export async function getUser(request: Request): Promise<Context | null> {
  const session = await getUserSession(request);
  return session.get(sessionTokenName) || null;
}

export async function verifyUser(request: Request): Promise<Context | null> {
  const user = await getUser(request);
  if (!user) {
    throw redirect("/login");
  }
  return user;
}
