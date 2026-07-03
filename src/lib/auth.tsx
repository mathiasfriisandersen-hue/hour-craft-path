import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { syncRemoteAppState } from "@/lib/timesheet-store";

export type Role = "vikar" | "kontaktperson" | "admin" | "bruger" | "bruger2";

export const ROLE_LABEL: Record<Role, string> = {
  vikar: "Vikar",
  kontaktperson: "Kontaktperson",
  admin: "Admin",
  bruger: "Bruger 1",
  bruger2: "Bruger 2",
};

export const ROLE_HOME: Record<Role, string> = {
  vikar: "/vikar",
  kontaktperson: "/kontaktperson",
  admin: "/admin",
  bruger: "/bruger1",
  bruger2: "/bruger2",
};

export const DEMO_PASSWORD = "0000";
const STORAGE_KEY = "timeseddel.role";

function isRole(value: string | null): value is Role {
  return (
    value === "vikar" ||
    value === "kontaktperson" ||
    value === "admin" ||
    value === "bruger" ||
    value === "bruger2"
  );
}

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
      const storedRole = localStorage.getItem(STORAGE_KEY);
      if (isRole(storedRole)) {
        setRole(storedRole);
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
