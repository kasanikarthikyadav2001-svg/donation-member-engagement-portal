import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, send, setCsrf, ApiError } from "../services/api";
export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "volunteer" | "member" | "donor";
  status: string;
};
type Auth = {
  user: User | null;
  loading: boolean;
  error: Error | null;
  login: (values: unknown) => Promise<void>;
  register: (values: unknown) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};
const Context = createContext<Auth>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      try {
        const r = await api("/auth/me");
        setCsrf(r.csrfToken);
        return r.user as User;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60000,
  });
  const signIn = async (path: string, values: unknown) => {
    const r = await send(path, values);
    setCsrf(r.csrfToken);
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
    client.setQueryData(["auth"], r.user);
  };
  return (
    <Context.Provider
      value={{
        user: q.data || null,
        loading: q.isLoading,
        error: q.error,
        login: (v) => signIn("/auth/login", v),
        register: (v) => signIn("/auth/register", v),
        logout: async () => {
          await send("/auth/logout", {});
          setCsrf("");
          client.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
          client.setQueryData(["auth"], null);
        },
        refresh: async () => {
          await q.refetch();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
export const isStaff = (u: User | null) =>
  u && ["admin", "volunteer"].includes(u.role);
