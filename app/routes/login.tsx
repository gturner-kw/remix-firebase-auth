import type { ActionFunction, LoaderFunction, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData, useSubmit } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import type { AuthError } from "firebase/auth";
import { sendSignInLinkToEmail } from "firebase/auth";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { getAuth } from "firebase/auth";
import { initializeApp } from "firebase/app";
import type { Context } from "~/session.server";
import { createUserSession, getUser } from "~/session.server";
import { createSession, getCookieValue } from "~/xsrf.server";

// Initialize Firebase
const firebaseConfig = require("../../firebaseConfig.json");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

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
  return createSession(request);
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
  return createUserSession(idToken, { admin: true } as Context, "/");
};

export default function SignIn() {
  const { xsrfToken } = useLoaderData();
  const submit = useSubmit();
  const idTokenRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedEmail = window.localStorage.getItem("emailForSignIn");
    console.log("savedEmail=", savedEmail);
    if (!!savedEmail && isSignInWithEmailLink(auth, window.location.href)) {
      window.localStorage.removeItem("emailForSignIn");
      setLoading(true);
      signInWithEmailLink(auth, savedEmail, window.location.href)
        .then(userCredential => {
          return userCredential.user.getIdToken();
        })
        .then(idToken => {
          if (!idTokenRef.current) {
            throw Error("invalid ref");
          }
          idTokenRef.current.value = idToken;
          submit(formRef.current);
        })
        .catch(err => {
          setError((err as AuthError).message);
          setLoading(false);
        });
    }
  }, [idTokenRef, submit]);

  const onSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!idTokenRef.current) {
        throw Error("invalid ref");
      }
      if (isSignInWithEmailLink(auth, window.location.href)) {
        const userCredential = await signInWithEmailLink(auth, email, window.location.href);
        idTokenRef.current.value = await userCredential.user.getIdToken();
        submit(e.target);
      } else {
        await sendSignInLinkToEmail(auth, email, { url: "http://localhost:3000/login", handleCodeInApp: true });
        setSent(true);
        window.localStorage.setItem("emailForSignIn", email);
      }
    } catch (err) {
      setError((err as AuthError).message);
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
          />
        </div>
        <button className="btn w-2/3" type="submit" disabled={!!loading}>
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
        <Form method="post" onSubmit={onSubmit} ref={formRef}>
          <input type="hidden" name="id-token" ref={idTokenRef} />
          <input type="hidden" name="xsrf-token" value={xsrfToken} />
          {renderFormBody()}
        </Form>
      </div>
    </section>
  );
}
