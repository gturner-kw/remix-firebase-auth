import type { ActionFunction, LinksFunction, LoaderFunction, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Link, Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useCatch, useFetcher, useLoaderData } from "@remix-run/react";
import { createUserSession, getSessionContext, logout } from "~/session.server";
import { AuthProvider, useAuth } from "./shared/components/auth";
import styles from "./tailwind.css";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Home Page",
  viewport: "width=device-width,initial-scale=1"
});

export const loader: LoaderFunction = async ({ request }) => {
  return await getSessionContext(request);
};

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const method = form.get("_method");
  if (method === "login") {
    return redirect("/login");
  }
  if (method === "logout") {
    return logout(request);
  }
  if (method === "refresh") {
    const sessionContext = await getSessionContext(request);
    if (!sessionContext) {
      console.log("session expired - redirecting to login...");
      return redirect("/login");
    }
    const idToken = form.get("id-token");
    if (typeof idToken !== "string") {
      // unexpected, throw
      throw new Response("Invalid parameters", {
        status: 400
      });
    }
    console.log("refresh idToken=", idToken);
    return createUserSession(idToken, { admin: true });
  }
  throw new Response(`The _method ${method} is not supported`, { status: 400 });
};

function Header({ boundary }: { boundary?: boolean }) {
  return (
    <header className="text-gray-600 body-font">
      <div className="container mx-auto flex flex-wrap p-5 flex-row items-center">
        <span className="flex space-x-3 font-medium items-center text-gray-900">
          <Link to="/">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="w-10 h-10 text-white p-2 bg-indigo-500 rounded-full"
              viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
          </Link>
          <span className="text-xl">Remix Firebase Auth POC</span>
        </span>
        {!boundary && <HeaderAction />}
      </div>
    </header>
  );
}

function HeaderAction() {
  const { sessionContext } = useAuth();
  const { user, expires } = sessionContext || {};
  const fetcher = useFetcher();

  const handleSubmit = (e: any) => {
    fetcher.submit({ _method: user ? "logout" : "login" }, { method: "post" });
  };

  return (
    <span className="ml-auto flex space-x-3">
      {user && expires && (
        <span className="hidden md:inline-flex items-center text-xs">{[user.email, new Date(expires * 1000).toISOString()].join(" | ")}</span>
      )}
      <button
        onClick={handleSubmit}
        className="inline-flex items-center bg-gray-100 border-0 py-1 px-3 focus:outline-none hover:bg-gray-200 rounded text-base mt-0">
        {user ? "Logout" : "Login"}
      </button>
    </span>
  );
}

function Document({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  const sessionContext = useLoaderData();
  return (
    <Document>
      <AuthProvider sessionContext={sessionContext}>
        <Header />
        <Outlet />
      </AuthProvider>
    </Document>
  );
}

function Boundary({ title, details }: { title: string; details: string }) {
  return (
    <Document>
      <Header boundary />
      <section className="text-gray-600 body-font">
        <div className="container px-5 py-24 mx-auto">
          <div className="flex flex-col text-center w-full mb-12">
            <h1 className="sm:text-3xl text-2xl font-medium text-gray-900">{title}</h1>
            <p className="lg:w-2/3 mx-auto leading-relaxed text-base">{details}</p>
          </div>
        </div>
      </section>
    </Document>
  );
}

export function CatchBoundary() {
  const caught = useCatch();
  return <Boundary title="Response Error" details={`${caught.status} ${caught.statusText}`} />;
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);
  return <Boundary title="Application Error" details={error?.message} />;
}
