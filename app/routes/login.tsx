import type { ActionFunction, LoaderFunction, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import type { MouseEvent } from "react";
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

  const onGoogle = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setState(draft => {
      draft.error = "This doesn't work yet - try email";
    });
  };

  const renderFormBody = () => {
    const { email, password, type, sent, loading, error } = state;

    if (sent) {
      return <div className="flex items-center justify-center">Check email</div>;
    }
    return (
      <form onSubmit={onSubmit}>
        <div className="flex sm:w-96 w-5/6 flex-col mx-auto px-8 space-y-6 items-center">
          <button
            className="w-full border border-gray-400 py-2 px-8 focus:outline-none hover:bg-gray-50 hover:border-gray-600 rounded text-lg disabled:opacity-50 disabled:cursor-not-allowed bg-[10px_center] bg-no-repeat bg-[length:24px] bg-[url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiICB4PSIwIiB5PSIwIiB2aWV3Qm94PSIwIDAgNjQgNjQiIHhtbDpzcGFjZT0icHJlc2VydmUiPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI%2BLnN0MHtjbGlwLXBhdGg6dXJsKCNTVkdJRF8yXyk7ZmlsbDojRkJCQzA1O30uc3Qxe2NsaXAtcGF0aDp1cmwoI1NWR0lEXzRfKTtmaWxsOiNFQTQzMzU7fS5zdDJ7Y2xpcC1wYXRoOnVybCgjU1ZHSURfNl8pO2ZpbGw6IzM0QTg1Mzt9LnN0M3tjbGlwLXBhdGg6dXJsKCNTVkdJRF84Xyk7ZmlsbDojNDI4NUY0O308L3N0eWxlPjxkZWZzPjxwYXRoIGlkPSJTVkdJRF8xXyIgZD0iTTU5LjMgMjYuN0g1NiA0NS4xIDMyVjM4aDE1LjdjLTEuNSA3LjItNy42IDExLjMtMTUuNyAxMS4zIC05LjYgMC0xNy4zLTcuNy0xNy4zLTE3LjNTMjIuNCAxNC43IDMyIDE0LjdjNC4xIDAgNy45IDEuNSAxMC44IDMuOWw4LjUtOC41QzQ2LjEgNS41IDM5LjUgMi43IDMyIDIuNyAxNS43IDIuNyAyLjcgMTUuNyAyLjcgMzJTMTUuNyA2MS4zIDMyIDYxLjNjMTQuNyAwIDI4LTEwLjcgMjgtMjkuM0M2MCAzMC4zIDU5LjcgMjguNCA1OS4zIDI2Ljd6Ii8%2BPC9kZWZzPjxjbGlwUGF0aCBpZD0iU1ZHSURfMl8iPjx1c2UgeGxpbms6aHJlZj0iI1NWR0lEXzFfIi8%2BPC9jbGlwUGF0aD48cG9seWdvbiBjbGFzcz0ic3QwIiBwb2ludHM9IjAgNDkuMyAwIDE0LjcgMjIuNyAzMiAiLz48ZGVmcz48cGF0aCBpZD0iU1ZHSURfM18iIGQ9Ik01OS4zIDI2LjdINTYgNDUuMSAzMlYzOGgxNS43Yy0xLjUgNy4yLTcuNiAxMS4zLTE1LjcgMTEuMyAtOS42IDAtMTcuMy03LjctMTcuMy0xNy4zUzIyLjQgMTQuNyAzMiAxNC43YzQuMSAwIDcuOSAxLjUgMTAuOCAzLjlsOC41LTguNUM0Ni4xIDUuNSAzOS41IDIuNyAzMiAyLjcgMTUuNyAyLjcgMi43IDE1LjcgMi43IDMyUzE1LjcgNjEuMyAzMiA2MS4zYzE0LjcgMCAyOC0xMC43IDI4LTI5LjNDNjAgMzAuMyA1OS43IDI4LjQgNTkuMyAyNi43eiIvPjwvZGVmcz48Y2xpcFBhdGggaWQ9IlNWR0lEXzRfIj48dXNlIHhsaW5rOmhyZWY9IiNTVkdJRF8zXyIvPjwvY2xpcFBhdGg%2BPHBvbHlnb24gY2xhc3M9InN0MSIgcG9pbnRzPSIwIDE0LjcgMjIuNyAzMiAzMiAyMy45IDY0IDE4LjcgNjQgMCAwIDAgIi8%2BPGRlZnM%2BPHBhdGggaWQ9IlNWR0lEXzVfIiBkPSJNNTkuMyAyNi43SDU2IDQ1LjEgMzJWMzhoMTUuN2MtMS41IDcuMi03LjYgMTEuMy0xNS43IDExLjMgLTkuNiAwLTE3LjMtNy43LTE3LjMtMTcuM1MyMi40IDE0LjcgMzIgMTQuN2M0LjEgMCA3LjkgMS41IDEwLjggMy45bDguNS04LjVDNDYuMSA1LjUgMzkuNSAyLjcgMzIgMi43IDE1LjcgMi43IDIuNyAxNS43IDIuNyAzMlMxNS43IDYxLjMgMzIgNjEuM2MxNC43IDAgMjgtMTAuNyAyOC0yOS4zQzYwIDMwLjMgNTkuNyAyOC40IDU5LjMgMjYuN3oiLz48L2RlZnM%2BPGNsaXBQYXRoIGlkPSJTVkdJRF82XyI%2BPHVzZSB4bGluazpocmVmPSIjU1ZHSURfNV8iLz48L2NsaXBQYXRoPjxwb2x5Z29uIGNsYXNzPSJzdDIiIHBvaW50cz0iMCA0OS4zIDQwIDE4LjcgNTAuNSAyMCA2NCAwIDY0IDY0IDAgNjQgIi8%2BPGRlZnM%2BPHBhdGggaWQ9IlNWR0lEXzdfIiBkPSJNNTkuMyAyNi43SDU2IDQ1LjEgMzJWMzhoMTUuN2MtMS41IDcuMi03LjYgMTEuMy0xNS43IDExLjMgLTkuNiAwLTE3LjMtNy43LTE3LjMtMTcuM1MyMi40IDE0LjcgMzIgMTQuN2M0LjEgMCA3LjkgMS41IDEwLjggMy45bDguNS04LjVDNDYuMSA1LjUgMzkuNSAyLjcgMzIgMi43IDE1LjcgMi43IDIuNyAxNS43IDIuNyAzMlMxNS43IDYxLjMgMzIgNjEuM2MxNC43IDAgMjgtMTAuNyAyOC0yOS4zQzYwIDMwLjMgNTkuNyAyOC40IDU5LjMgMjYuN3oiLz48L2RlZnM%2BPGNsaXBQYXRoIGlkPSJTVkdJRF84XyI%2BPHVzZSB4bGluazpocmVmPSIjU1ZHSURfN18iLz48L2NsaXBQYXRoPjxwb2x5Z29uIGNsYXNzPSJzdDMiIHBvaW50cz0iNjQgNjQgMjIuNyAzMiAxNy4zIDI4IDY0IDE0LjcgIi8%2BPC9zdmc%2BCg%3D%3D)]"
            disabled={loading}
            onClick={onGoogle}>
            Log In using Google
          </button>
          <div className="">Or login with email</div>
          <input
            type="text"
            id="email"
            name="email"
            placeholder="Your Email"
            className="w-full bg-gray-100 bg-opacity-50 rounded border border-gray-300 focus:border-indigo-500 focus:bg-transparent focus:ring-2 focus:ring-indigo-200 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
            value={email}
            onChange={e =>
              setState(draft => {
                draft.email = e.target.value;
              })
            }
            disabled={loading}
          />
          {type === "password" && (
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Password"
              className="w-full bg-gray-100 bg-opacity-50 rounded border border-gray-300 focus:border-indigo-500 focus:bg-transparent focus:ring-2 focus:ring-indigo-200 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
              value={password}
              onChange={e =>
                setState(draft => {
                  draft.password = e.target.value;
                })
              }
              disabled={loading}
            />
          )}
          <div className="w-full !mt-3">
            <input type="checkbox" id="remember-device" name="rememberDevice" />
            <label className="ml-2" htmlFor="remember-device">
              Remember this device
            </label>
          </div>
          <button className="btn w-full !mt-12" disabled={loading}>
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
          <h1 className="sm:text-3xl text-2xl font-medium text-gray-900">Log In</h1>
        </div>
        {renderFormBody()}
      </div>
    </section>
  );
}
