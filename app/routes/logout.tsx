import type { ActionFunction } from "@remix-run/node";
import { logout } from "~/session.server";

export const action: ActionFunction = async ({ request }) => {
  return logout(request);
};

export default function Logout() {
  return null;
}
