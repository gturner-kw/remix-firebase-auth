export type User = {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  admin?: boolean;
};

export type State = {
  issued?: number;
  expires?: number;
  loggedIn: number;
  refreshToken: string;
  refreshExpires: number;
};

export type SessionContext = {
  user?: User;
  state: State;
};
