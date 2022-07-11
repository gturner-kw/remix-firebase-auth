import { useEffect, useContext, createContext } from "react";
import { clientAuth } from "../../session.client";
import type { SessionContext } from "~/session-types";
import { useFetcher } from "@remix-run/react";
import { useImmer } from "use-immer";

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
  const active = !!sessionContext;
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

  // timer to refresh the token every 15 minutes
  useEffect(() => {
    console.log("4. useEffect changed with active=", active);
    // TODO: perform an instant refresh here is session has expired
    const handle = setInterval(async () => {
      if (active) {
        const currentUser = clientAuth.currentUser;
        console.log("4. refreshing token - user=", currentUser);
        if (currentUser) {
          // fetch token with force refresh flag
          const idToken = await currentUser.getIdToken(true);
          submit({ _method: "refresh", "id-token": idToken }, { method: "post" });
          console.log("4. refreshed token=", idToken);
          setTiming(draft => {
            draft.refreshed = Date.now();
          });
        }
      }
    }, (15 * 60 * 1000) / 60);
    return () => clearInterval(handle);
  }, [active, submit, setTiming]);

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

  // TODO: implement an auth listener to determine if the current user has been revoked

  return <AuthContext.Provider value={{ sessionContext }}>{children}</AuthContext.Provider>;
}
