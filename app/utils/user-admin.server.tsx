import * as firebaseAdmin from "firebase-admin";
import type { UserIdentifier } from "firebase-admin/lib/auth/identifier";
import type { UserRecord } from "firebase-admin/lib/auth/user-record";
import { HOST_URL } from "./constants.server";

const serviceAccount = require("../../serviceAccountKey.json");
if (firebaseAdmin.apps.length === 0) {
  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount)
  });
}

export const getAuth = () => firebaseAdmin.auth();

export type User = {
  uid: string;
  email?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  disabled: boolean;
  displayName?: string;
  tenantId?: string | null;
};

function translateUser(user: UserRecord): User {
  const { uid, email, emailVerified, phoneNumber, disabled, displayName, tenantId } = user;
  return {
    uid,
    email,
    emailVerified,
    phoneNumber,
    disabled,
    displayName,
    tenantId
  };
}

export async function getUsers(userIdentifier: UserIdentifier[]): Promise<User[]> {
  const result = await getAuth().getUsers(userIdentifier);
  return result.users.map(user => translateUser(user));
}

export async function listUsers(maxResults?: number, nextPageToken?: string): Promise<User[]> {
  const result = await getAuth().listUsers(maxResults, nextPageToken);
  return result.users.map(user => translateUser(user));
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const result = await getAuth().getUserByEmail(email);
    return translateUser(result);
  } catch (err) {
    return null;
  }
}

export type AddUser = {
  email: string;
  displayName: string;
};

export async function addUser(user: AddUser) {
  const { email, displayName } = user;
  const auth = getAuth();
  try {
    await auth.getUserByEmail(email);
  } catch (err) {
    await auth.createUser({ email, displayName });
  }
  return auth.generateSignInWithEmailLink(email, { url: HOST_URL });
}
