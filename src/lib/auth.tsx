import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { syncRemoteAppState } from "@/lib/timesheet-store";

export type Role = "vikar" | "kontaktperson" | "admin" | "bruger";

export const ROLE_LABEL: Record<Role, string> = {
  vikar: "Vikar",
  kontaktperson: "Kontaktperson",
  admin: "Admin",
  bruger: "Bruger 1",
};

export const ROLE_HOME: Record<Role, string> = {
  vikar: "/vikar",
  kontaktperson: "/kontaktperson",
  admin: "/admin",
  bruger: "/admin",
};

export const DEMO_PASSWORD = "0000";
const STORAGE_KEY = "timeseddel.role";

type AuthCtx = {
  role: Role | null;
  login: (role: Role) => void;
  logout: () => void;
  ready: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Role | null;
      if (
        stored === "vikar" ||
        stored === "kontaktperson" ||
        stored === "admin" ||
        stored === "bruger"
      ) {
        setRole(stored);
      }
    } catch {
      /* ignore */
    }
    syncRemoteAppState()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = (r: Role) => {
    try {
      localStorage.setItem(STORAGE_KEY, r);
    } catch {
      /* ignore */
    }
    syncRemoteAppState()
      .catch(() => undefined)
      .finally(() => setRole(r));
  };

  const logout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setRole(null);
  };

  return <Ctx.Provider value={{ role, login, logout, ready }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
