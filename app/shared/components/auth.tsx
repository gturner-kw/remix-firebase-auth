import { useEffect, useContext, createContext, useCallback, useState } from "react";
import { clientAuth } from "../../session.client";
import type { SessionContext } from "~/shared/session/types";
import { REFRESH_INTERVAL_SECS } from "~/shared/session/contants";
import { useFetcher } from "@remix-run/react";
import { useImmer } from "use-immer";
import type { User as FirebaseUser } from "firebase/auth";

export type Auth = {
  sessionContext: SessionContext | null;
};

const AuthContext = createContext<Auth | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within a AuthProvider");
  }
  return context;
};

export function AuthProvider({ sessionContext: parentSessionContext, children }: { sessionContext: SessionContext | null; children: React.ReactNode }) {
  const [sessionContext, setSessionContext] = useImmer<SessionContext | null>(parentSessionContext);
  const { refreshToken, expires } = sessionContext?.state || {};
  const active = !!sessionContext?.user;
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>();
  const [timing, setTiming] = useImmer<{ updated: number; refreshed?: number }>({ updated: Date.now() });
  const submitFetcher = useFetcher();
  const loadFetcher = useFetcher();

  // hack to force dependency warning off
  const { submit } = submitFetcher;
  const { load, data: loadData } = loadFetcher;

  // update sessionContext with incoming changes from loader
  useEffect(() => {
    console.log("1. useEffect changed with parentSessionContext=", parentSessionContext);
    setSessionContext(draft => parentSessionContext);
    setTiming(draft => {
      draft.updated = Date.now();
    });
  }, [parentSessionContext, setSessionContext, setTiming]);

  // update sessionContext with incoming changes from fetcher load call
  useEffect(() => {
    console.log("2. useEffect changed with loadData=", loadData);
    if (loadData) {
      setSessionContext(draft => loadData);
      setTiming(draft => {
        draft.updated = Date.now();
      });
    }
  }, [loadData, setSessionContext, setTiming]);

  // token was refreshed - send storage event to other tabs after data has been received
  useEffect(() => {
    console.log("3. useEffect changed with timing=", timing);
    const { updated, refreshed } = timing;
    if (updated && refreshed && updated > refreshed) {
      console.log("3. triggering refreshToken");
      window.localStorage.setItem("refreshedToken", "1");
      window.localStorage.removeItem("refreshedToken");
      setTiming(draft => {
        draft.refreshed = undefined;
      });
    }
  }, [timing, setTiming]);

  const submitRefresh = useCallback(async () => {
    console.log("4. useCallback changed refreshToken=", refreshToken, "firebaseUser=", firebaseUser);
    if (!refreshToken) {
      return;
    }
    if (firebaseUser) {
      // fetch token with force refresh flag
      const idToken = await firebaseUser.getIdToken(true);
      submit({ _method: "refresh", "refresh-token": refreshToken, "id-token": idToken }, { method: "post" });
      console.log("4. refreshed token=", idToken);
      setTiming(draft => {
        draft.refreshed = Date.now();
      });
    }
  }, [refreshToken, firebaseUser, setTiming, submit]);

  // timer to refresh the token
  useEffect(() => {
    console.log("4. useEffect changed active=", active);
    // refresh now if not active or will expire before first interval
    if (!active || !expires || isExpired(expires - REFRESH_INTERVAL_SECS)) {
      submitRefresh();
    } else {
      const handle = setInterval(() => {
        submitRefresh();
      }, REFRESH_INTERVAL_SECS * 1000);
      return () => clearInterval(handle);
    }
  }, [active, expires, submitRefresh]);

  // listen for refresh storage event from other tabs
  useEffect(() => {
    console.log("5. useEffect changed");
    window.onstorage = (event: StorageEvent) => {
      if (event.key == "refreshedToken" && event.newValue === "1") {
        console.log("5. running fetcher.load...");
        load("/");
      }
    };
  }, [load]);

  // on page reload, firebase lazy loads user, so let's listen for this action
  useEffect(() => {
    // TODO if auth state becomes null, this signals a user sign out
    // we need to test if this needs to be handled specifically or if other mechanisms handle this correctly
    clientAuth.onAuthStateChanged(user => setFirebaseUser(user));
  }, []);

  return <AuthContext.Provider value={{ sessionContext }}>{children}</AuthContext.Provider>;
}

function isExpired(seconds: number) {
  return Date.now() > seconds * 1000;
}
