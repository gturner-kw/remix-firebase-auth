import type { ActionFunction, LoaderFunction, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import type { AuthError } from "firebase/auth";
import { EmailAuthProvider } from "firebase/auth";
import { fetchSignInMethodsForEmail } from "firebase/auth";
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { createUserSession, getUser } from "~/session.server";
import { createSession as createXsrfSession, getCookieValue } from "~/xsrf.server";
import { clientAuth } from "~/session.client";

export const meta: MetaFunction = () => ({
  title: "Log In",
  // refresh expired xsrf token
  refresh: {
    httpEquiv: "refresh",
    content: "3601"
  }
});

export const loader: LoaderFunction = async ({ request }) => {
  const user = await getUser(request);
  if (user) {
    return redirect("/");
  }
  return createXsrfSession(request);
};

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const idToken = form.get("id-token");
  const xsrfToken = form.get("xsrf-token");
  if (typeof idToken !== "string" || typeof xsrfToken !== "string") {
    // unexpected, throw
    throw new Response("Invalid parameters", {
      status: 400
    });
  }

  const xsrfCookieValue = await getCookieValue(request);
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
  return createUserSession(idToken, { admin: true }, "/");
};

export default function SignIn() {
  const { xsrfToken } = useLoaderData();
  const fetcher = useFetcher();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedEmail = window.localStorage.getItem("emailForSignIn");
    console.log("savedEmail=", savedEmail);
    if (!!savedEmail && isSignInWithEmailLink(clientAuth, window.location.href)) {
      window.localStorage.removeItem("emailForSignIn");
      setLoading(true);
      signInWithEmailLink(clientAuth, savedEmail, window.location.href)
        .then(userCredential => {
          return userCredential.user.getIdToken();
        })
        .then(idToken => {
          fetcher.submit({ "id-token": idToken, "xsrf-token": xsrfToken }, { method: "post" });
        })
        .catch(err => {
          setError((err as AuthError).message);
          setLoading(false);
        });
    }
  }, [fetcher, xsrfToken]);

  const onSubmit = async (e: any) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const methods = await fetchSignInMethodsForEmail(clientAuth, email);
      console.log("methods=", methods);
      if (methods.length > 0 && !methods.includes(EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD)) {
        setError("cannot sign in with that email");
        return;
      }

      if (isSignInWithEmailLink(clientAuth, window.location.href)) {
        const userCredential = await signInWithEmailLink(clientAuth, email, window.location.href);
        const idToken = await userCredential.user.getIdToken();
        fetcher.submit({ "id-token": idToken, "xsrf-token": xsrfToken }, { method: "post" });
      } else {
        await sendSignInLinkToEmail(clientAuth, email, { url: "http://localhost:3000/login", handleCodeInApp: true });
        setSent(true);
        window.localStorage.setItem("emailForSignIn", email);
      }
    } catch (err) {
      setError((err as AuthError).message);
    } finally {
      setLoading(false);
    }
  };

  const renderFormBody = () => {
    if (sent) {
      return <div className="flex items-center justify-center">Check email</div>;
    }
    return (
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
            onChange={e => setEmail(e.target.value)}
            disabled={!!loading}
          />
        </div>
        <button className="btn w-2/3" disabled={!!loading}>
          {loading ? "Logging in ..." : "Login"}
        </button>
        {error && <p>{error}</p>}
      </div>
    );
  };

  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-col text-center w-full mb-12">
          <h1 className="sm:text-3xl text-2xl font-medium text-gray-900">Login</h1>
        </div>
        <fetcher.Form onSubmit={onSubmit}>{renderFormBody()}</fetcher.Form>
      </div>
    </section>
  );
}
