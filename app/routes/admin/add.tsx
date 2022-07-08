import { Form, useActionData, useTransition } from "@remix-run/react";
import type { ActionFunction, LoaderFunction, MetaFunction } from "@remix-run/server-runtime";
import { redirect } from "@remix-run/server-runtime";
import { json } from "@remix-run/server-runtime";
import { verifyUser } from "~/session.server";
import { addUser } from "~/user-admin.server";

export const meta: MetaFunction = () => ({
  title: "Add User"
});

export const loader: LoaderFunction = async ({ request }) => {
  return verifyUser(request).then(async user => {
    if (!user?.admin) {
      throw new Response("Unauthorized access", {
        status: 401
      });
    }
    return user;
  });
};

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const displayName = form.get("display-name");
  const email = form.get("email");
  if (typeof displayName !== "string") {
    return json({ message: "displayName required" }, { status: 422 });
  }
  if (typeof email !== "string") {
    return json({ message: "email required" }, { status: 422 });
  }
  return addUser({ displayName, email })
    .then(emailLink => {
      console.log("created user=", emailLink);
      return redirect("/admin");
    })
    .catch(error => {
      console.log("error=", error.message);
      return json({ error }, { status: 400 });
    });
};

export default function Index() {
  const { error } = useActionData() || {};
  const transition = useTransition();
  const busy = transition.submission;

  const renderFormBody = () => {
    return (
      <div className="flex sm:w-96 w-5/6 flex-col mx-auto px-8 space-y-4 items-center">
        <div className="relative flex-grow w-full">
          <label htmlFor="displayName" className="leading-7 text-sm text-gray-600">
            Display Name
          </label>
          <input
            type="text"
            id="displayName"
            name="display-name"
            className="w-full bg-gray-100 bg-opacity-50 rounded border border-gray-300 focus:border-indigo-500 focus:bg-transparent focus:ring-2 focus:ring-indigo-200 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
          />
        </div>
        <div className="relative flex-grow w-full">
          <label htmlFor="email" className="leading-7 text-sm text-gray-600">
            Email
          </label>
          <input
            type="text"
            id="email"
            name="email"
            className="w-full bg-gray-100 bg-opacity-50 rounded border border-gray-300 focus:border-indigo-500 focus:bg-transparent focus:ring-2 focus:ring-indigo-200 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
          />
        </div>
        <button className="btn w-2/3" type="submit" disabled={!!busy}>
          {busy ? "Submitting..." : "Submit"}
        </button>
        {error && <p>{error}</p>}
      </div>
    );
  };

  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-col text-center w-full mb-12">
          <h1 className="sm:text-3xl text-2xl font-medium text-gray-900">Add User</h1>
          <p className="lg:w-2/3 mx-auto leading-relaxed text-base">This page is restriced to admins.</p>
        </div>
        <Form method="post">{renderFormBody()}</Form>
      </div>
    </section>
  );
}
