import type { ActionFunction, LoaderFunction, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useCallback } from "react";
import type { AuthError } from "firebase/auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { EmailAuthProvider } from "firebase/auth";
import { fetchSignInMethodsForEmail } from "firebase/auth";
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import type { UserSessionProperties } from "~/utils/session/session.server";
import { createUserSession, getSessionContext } from "~/utils/session/session.server";
import { createSession as createXsrfSession, getXsrfToken } from "~/xsrf.server";
import { clientAuth } from "~/utils/session/session.client";
import type { SessionContext } from "~/utils/session/types";
import { getUserByEmail } from "~/utils/user-admin.server";
import { useImmer } from "use-immer";

export const meta: MetaFunction = () => ({
  title: "Log In",
  // refresh expired xsrf token
  refresh: {
    httpEquiv: "refresh",
    content: "3600"
  }
});

export const loader: LoaderFunction = async ({ request }) => {
  const session: SessionContext | null = await getSessionContext(request);
  if (session) {
    return redirect("/");
  }
  return createXsrfSession(request);
};

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const method = form.get("_method");
  if (method === "check-email") {
    const email = form.get("email");
    const xsrfToken = form.get("xsrf-token");
    if (typeof email !== "string" || typeof xsrfToken !== "string") {
      // unexpected, throw
      throw new Response("Invalid parameters", {
        status: 400
      });
    }
    const user = await getUserByEmail(email);
    return { email, valid: !!user && !user.disabled };
  }

  if (method === "login") {
    const idToken = form.get("id-token");
    const xsrfToken = form.get("xsrf-token");
    if (typeof idToken !== "string" || typeof xsrfToken !== "string") {
      // unexpected, throw
      throw new Response("Invalid parameters", {
        status: 400
      });
    }

    const xsrfCookieValue = await getXsrfToken(request);
    if (!xsrfCookieValue) {
      console.log("xsrf cookie expired - reloading page...");
      return redirect("/login");
    }
    if (xsrfCookieValue !== xsrfToken) {
      // unexpected, throw
      throw new Response("Unauthorized access", {
        status: 401
      });
    }
    // TODO: lookup user in db
    const props: UserSessionProperties = { admin: true };
    return createUserSession(idToken, props, "/");
  }
};

export default function SignIn() {
  const [state, setState] = useImmer<{ email: string; password: string; error?: string; loading?: boolean; sent?: boolean; type?: string }>({
    email: "",
    password: ""
  });
  const { xsrfToken } = useLoaderData();
  const loginFetcher = useFetcher();
  const { submit: loginSubmit } = loginFetcher;
  const checkUserFetcher = useFetcher();
  const { data: checkUserData } = checkUserFetcher;

  // respond to email link url
  useEffect(() => {
    const savedEmail = window.localStorage.getItem("emailForSignIn");
    if (savedEmail) {
      window.localStorage.removeItem("emailForSignIn");
      setState(draft => {
        draft.email = savedEmail;
      });
      if (isSignInWithEmailLink(clientAuth, window.location.href)) {
        setState(draft => {
          draft.loading = true;
        });
        signInWithEmailLink(clientAuth, savedEmail, window.location.href)
          .then(userCredential => {
            return userCredential.user.getIdToken();
          })
          .then(idToken => {
            loginSubmit({ _method: "login", "id-token": idToken, "xsrf-token": xsrfToken }, { method: "post" });
          })
          .catch(err => {
            setState(draft => {
              draft.error = (err as AuthError).message;
              draft.loading = false;
            });
          });
      }
    }
  }, [loginSubmit, xsrfToken, setState]);

  const sendEmailLink = useCallback(
    email => {
      sendSignInLinkToEmail(clientAuth, email, { url: `${self.origin}/login`, handleCodeInApp: true })
        .then(() => {
          setState(draft => {
            draft.sent = true;
            draft.loading = false;
          });
          window.localStorage.setItem("emailForSignIn", email);
        })
        .catch(err => {
          setState(draft => {
            draft.error = (err as AuthError).message;
            draft.loading = false;
          });
        });
    },
    [setState]
  );

  // respond to fetcher check user
  useEffect(() => {
    if (!checkUserData) return;

    const { email, valid } = checkUserData;
    if (!valid) {
      setState(draft => {
        draft.error = "invalid email";
        draft.loading = false;
      });
      return;
    }

    console.log("sending email to ", email);

    sendEmailLink(email);
  }, [checkUserData, setState, sendEmailLink]);

  const onSubmit = async (e: any) => {
    e.preventDefault();

    const { email, password, type } = state;
    if (!email) {
      setState(draft => {
        draft.error = "email required";
        draft.loading = false;
      });
      return;
    }

    try {
      setState(draft => {
        draft.error = "";
        draft.loading = true;
      });

      const methods = await fetchSignInMethodsForEmail(clientAuth, email);
      if (methods.includes(EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD)) {
        if (type !== "password") {
          setState(draft => {
            draft.type = "password";
            draft.loading = false;
          });
          return;
        }
        if (!password) {
          setState(draft => {
            draft.error = "password required";
            draft.loading = false;
          });
          return;
        }

        const userCredential = await signInWithEmailAndPassword(clientAuth, email, password);
        const idToken = await userCredential.user.getIdToken();
        loginSubmit({ _method: "login", "id-token": idToken, "xsrf-token": xsrfToken }, { method: "post" });
      } else if (isSignInWithEmailLink(clientAuth, window.location.href)) {
        const userCredential = await signInWithEmailLink(clientAuth, email, window.location.href);
        const idToken = await userCredential.user.getIdToken();
        loginSubmit({ _method: "login", "id-token": idToken, "xsrf-token": xsrfToken }, { method: "post" });
      } else if (methods.includes(EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD)) {
        sendEmailLink(email);
      } else {
        // unknown user --let's validate
        checkUserFetcher.submit({ _method: "check-email", email, "xsrf-token": xsrfToken }, { method: "post" });
      }
    } catch (err) {
      setState(draft => {
        draft.error = (err as AuthError).message;
        draft.loading = false;
      });
    }
  };

  const renderFormBody = () => {
    const { email, password, type, sent, loading, error } = state;

    if (sent) {
      return <div className="flex items-center justify-center">Check email</div>;
    }
    return (
      <form onSubmit={onSubmit}>
        <div className="flex sm:w-96 w-5/6 flex-col mx-auto px-8 space-y-4 items-center">
          <div className="relative flex-grow w-full">
            <label htmlFor="email" className="leading-7 text-sm text-gray-600">
              Email
            </label>
            <input
              type="text"
              id="email"
              name="email"
              className="w-full bg-gray-100 bg-opacity-50 rounded border border-gray-300 focus:border-indigo-500 focus:bg-transparent focus:ring-2 focus:ring-indigo-200 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
              value={email}
              onChange={e =>
                setState(draft => {
                  draft.email = e.target.value;
                })
              }
              disabled={!!loading}
            />
          </div>
          {type === "password" && (
            <div className="relative flex-grow w-full">
              <label htmlFor="password" className="leading-7 text-sm text-gray-600">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="w-full bg-gray-100 bg-opacity-50 rounded border border-gray-300 focus:border-indigo-500 focus:bg-transparent focus:ring-2 focus:ring-indigo-200 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                value={password}
                onChange={e =>
                  setState(draft => {
                    draft.password = e.target.value;
                  })
                }
                disabled={!!loading}
              />
            </div>
          )}
          <button className="btn w-2/3" disabled={!!loading}>
            {loading ? "Logging in ..." : "Login"}
          </button>
          {error && <p>{error}</p>}
        </div>
      </form>
    );
  };

  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-col text-center w-full mb-12">
          <h1 className="sm:text-3xl text-2xl font-medium text-gray-900">Login</h1>
        </div>
        {renderFormBody()}
      </div>
    </section>
  );
}
