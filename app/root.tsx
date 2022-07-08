import type { ActionFunction, LinksFunction, LoaderFunction, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useCatch, useLoaderData } from "@remix-run/react";
import { getUser, logout } from "~/session.server";
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
  return getUser(request);
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
  throw new Response(`The _method ${method} is not supported`, { status: 400 });
};

function Header() {
  // TODO explore fetching user via middleware - see temp/my-remix-app for example
  const user = useLoaderData();
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
        <span className="ml-auto flex space-x-3">
          <span className="hidden md:inline-flex items-center text-base">{user?.email}</span>
          <Form method="post">
            <input type="hidden" name="_method" value={user ? "logout" : "login"} />
            <button
              type="submit"
              className="inline-flex items-center bg-gray-100 border-0 py-1 px-3 focus:outline-none hover:bg-gray-200 rounded text-base mt-0">
              {user ? "Logout" : "Login"}
            </button>
          </Form>
        </span>
      </div>
    </header>
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
        <Header />
        {children}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function CatchBoundary() {
  const caught = useCatch();
  return (
    <Document>
      <div className="error-container">
        <h1>
          {caught.status} {caught.statusText}
        </h1>
      </div>
    </Document>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);
  return (
    <Document>
      <div className="error-container">
        <h1>App Error</h1>
        <pre>{error.message}</pre>
      </div>
    </Document>
  );
}
