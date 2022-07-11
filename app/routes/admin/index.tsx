import { Link, useLoaderData } from "@remix-run/react";
import type { LoaderFunction, MetaFunction } from "@remix-run/server-runtime";
import { initializeApp } from "firebase/app";
import type { AuthError } from "firebase/auth";
import { getAuth, sendSignInLinkToEmail } from "firebase/auth";
import { verifySessionContext } from "~/session.server";
import type { User } from "~/user-admin.server";
import { listUsers } from "~/user-admin.server";

// Initialize Firebase
const firebaseConfig = require("../../../firebaseConfig.json");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export const meta: MetaFunction = () => ({
  title: "Admin"
});

export const loader: LoaderFunction = async ({ request }) => {
  return verifySessionContext(request).then(async session => {
    if (!session?.user?.admin) {
      throw new Response("Unauthorized access", {
        status: 401
      });
    }
    const users = (await listUsers()) || {};
    return users;
  });
};

export default function Index() {
  const users: User[] = useLoaderData() || {};
  const handleVerify = async (email?: string) => {
    if (email) {
      try {
        await sendSignInLinkToEmail(auth, email, { url: "http://localhost:3000/login", handleCodeInApp: true });
      } catch (err) {
        console.log((err as AuthError).message);
      }
    }
  };

  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-col text-center w-full mb-12">
          <h1 className="sm:text-3xl text-2xl font-medium mb-4 text-gray-900">Admin Page</h1>
          <p className="lg:w-2/3 mx-auto leading-relaxed text-base">This page is restriced to admins.</p>
        </div>
        <div className="lg:w-2/3 w-full mx-auto overflow-auto">
          <table className="table-auto w-full text-left whitespace-no-wrap">
            <thead>
              <tr className="tracking-wider font-medium text-gray-900 text-sm bg-gray-100">
                <th className="px-4 py-3">DisplayName</th>
                <th className="px-4 py-3 rounded-l">Email</th>
                <th className="px-4 py-3">Disabled</th>
                <th className="px-4 py-3 rounded-r">Verified</th>
              </tr>
            </thead>
            <tbody>
              {users.map(({ uid, email, emailVerified, disabled, displayName }) => (
                <tr key={uid} className="border-gray-200 first:border-t-0 border-t-2">
                  <td className="px-4 py-3 ">{displayName || "None"}</td>
                  <td className="px-4 py-3 ">{email}</td>
                  <td className="px-4 py-3 ">{disabled ? "True" : "False"}</td>
                  <td className="px-4 py-3 ">
                    {emailVerified ? (
                      "True"
                    ) : (
                      <button className="text-blue-600 hover:text-blue-500" onClick={() => handleVerify(email)}>
                        Send Link
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-center mt-4">
          <Link to="add" className="btn">
            Add User
          </Link>
        </div>
      </div>
    </section>
  );
}
