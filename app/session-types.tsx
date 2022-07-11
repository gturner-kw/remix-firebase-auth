export type User = {
  uid: string;
  email: string;
  emailVerified: boolean;
  admin: boolean;
};

export type SessionContext = {
  user: User;
  expires: number;
};
