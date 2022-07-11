import { Link, useLoaderData } from "@remix-run/react";
import type { LoaderFunction, MetaFunction } from "@remix-run/server-runtime";
import { initializeApp } from "firebase/app";
import type { AuthError } from "firebase/auth";
import { getAuth, sendSignInLinkToEmail } from "firebase/auth";
import { useImmer } from "use-immer";
import { verifySessionContext } from "~/utils/session/session.server";
import type { User } from "~/utils/user-admin.server";
import { listUsers } from "~/utils/user-admin.server";

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
  const [state, setState] = useImmer<{ verifying?: boolean; error?: string }>({});
  const { error, verifying } = state;

  const handleVerify = (email?: string) => {
    if (email) {
      setState(draft => {
        draft.error = "";
        draft.verifying = true;
      });
      sendSignInLinkToEmail(auth, email, { url: `${self.origin}/login`, handleCodeInApp: true })
        .then(() => {
          setState(draft => {
            draft.error = `sent verification email to ${email}`;
            draft.verifying = false;
          });
        })
        .catch(err => {
          setState(draft => {
            draft.verifying = true;
            draft.error = (err as AuthError).message;
          });
        });
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
                  <td className="px-4 py-3 flex space-x-3 items-center">
                    {emailVerified ? (
                      "True"
                    ) : (
                      <>
                        <span>False</span>
                        <span className={verifying ? "cursor-wait" : "cursor-pointer"} onClick={() => handleVerify(email)}>
                          <svg className="inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                            <path fill="none" d="M0 0h24v24H0z" />
                            <path
                              d="M22 20.007a1 1 0 0 1-.992.993H2.992A.993.993 0 0 1 2 20.007V19h18V7.3l-8 7.2-10-9V4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v16.007zM4.434 5L12 11.81 19.566 5H4.434zM0 15h8v2H0v-2zm0-5h5v2H0v-2z"
                              fill="rgba(92,92,92,1)"
                            />
                          </svg>
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-center mt-4">{error && <p>{error}</p>}</div>
        <div className="flex items-center justify-center mt-4">
          <Link to="add" className="btn">
            Add User
          </Link>
        </div>
      </div>
    </section>
  );
}
