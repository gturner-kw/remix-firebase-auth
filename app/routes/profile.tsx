import type { ActionFunction, LoaderFunction, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import type { SessionContext } from "~/session-types";
import { verifyUser } from "~/session.server";
import { useAuth } from "~/shared/components/auth";

export const meta: MetaFunction = () => ({
  title: "Profile"
});

export const loader: LoaderFunction = async ({ request }) => {
  return verifyUser(request);
};

export const action: ActionFunction = async () => {
  return redirect("login");
};

export default function Profile() {
  const { sessionContext } = useAuth();
  const { user } = sessionContext || ({} as SessionContext);
  const { uid, email, emailVerified, admin } = user || {};
  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-col text-center w-full mb-12">
          <h1 className="sm:text-3xl text-2xl font-medium mb-4 text-gray-900">Profile Page</h1>
          <p className="lg:w-2/3 mx-auto leading-relaxed text-base">This page is private.</p>
        </div>
        <div className="flex flex-col mx-auto space-y-4 items-center justify-center">
          <div className="p-6 rounded-lg border-2 border-gray-300 flex flex-col relative overflow-hidden">
            <div className="w-full">
              <div className="leading-7 text-sm text-gray-500">UID</div>
              <div className="leading-9 text-gray-800">{uid}</div>
            </div>
            <div className="w-full">
              <div className="leading-7 text-sm text-gray-500">Email</div>
              <div className="leading-9 text-gray-800">{email}</div>
            </div>
            <div className="w-full">
              <div className="leading-7 text-sm text-gray-500">Email Verified</div>
              <div className="leading-9 text-gray-800">{emailVerified ? "True" : "False"}</div>
            </div>
            <div className="w-full">
              <div className="leading-7 text-sm text-gray-500">Admin</div>
              <div className="leading-9 text-gray-800">{admin ? "True" : "False"}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
