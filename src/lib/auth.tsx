import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  clearSessionCredential,
  createVerifiedDemoSession,
  getVerifiedSession,
  safeSessionErrorMessage,
  SessionApiError,
  type ApiMembershipRole,
  type ApiSession,
} from "@/lib/api-session";

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

let inMemoryUiRolePreference: Role | null = null;

type LoginOptions = {
  workerIdentity?: { name: string; email: string };
  demo?: boolean;
};

type AuthCtx = {
  role: Role | null;
  workerIdentity: { name: string; email: string } | null;
  login: (role: Role, options?: LoginOptions) => void;
  logout: () => void;
  ready: boolean;
  authenticating: boolean;
  error: string | null;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [workerIdentity, setWorkerIdentity] = useState<{ name: string; email: string } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function restoreVerifiedSession() {
      try {
        const session = await getVerifiedSession();
        if (cancelled) return;
        const verifiedRole = roleForSession(session, readUiRolePreference());
        setRole(verifiedRole);
        setWorkerIdentity(session.workerIdentity ?? null);
      } catch {
        if (cancelled) return;
        clearSessionCredential();
        clearUiRolePreference();
        setRole(null);
        setWorkerIdentity(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void restoreVerifiedSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = (requestedRole: Role, options: LoginOptions = {}) => {
    const requestId = ++authRequest.current;
    setAuthenticating(true);
    setError(null);

    async function verifyLogin() {
      try {
        const expectedApiRole = apiRoleForUiRole(requestedRole);
        const session = options.demo
          ? await createVerifiedDemoSession(expectedApiRole)
          : await getVerifiedSession();
        if (session.role !== expectedApiRole || (options.demo && !session.demo)) {
          throw new SessionApiError("role_mismatch", "Sessionen har ikke den valgte rolle.");
        }
        if (authRequest.current !== requestId) return;

        const verifiedRole = roleForSession(session, requestedRole);
        writeUiRolePreference(verifiedRole);
        setRole(verifiedRole);
        setWorkerIdentity(
          session.workerIdentity ??
            (verifiedRole === "vikar" && options.workerIdentity ? options.workerIdentity : null),
        );
      } catch (cause) {
        if (authRequest.current !== requestId) return;
        clearSessionCredential();
        clearUiRolePreference();
        setRole(null);
        setWorkerIdentity(null);
        setError(safeSessionErrorMessage(cause));
      } finally {
        if (authRequest.current === requestId) {
          setAuthenticating(false);
          setReady(true);
        }
      }
    }

    void verifyLogin();
  };

  const logout = () => {
    authRequest.current += 1;
    clearSessionCredential();
    clearUiRolePreference();
    setRole(null);
    setWorkerIdentity(null);
    setAuthenticating(false);
    setError(null);
  };

  return (
    <Ctx.Provider value={{ role, workerIdentity, login, logout, ready, authenticating, error }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function apiRoleForUiRole(role: Role): Exclude<ApiMembershipRole, "platformsadministrator"> {
  if (role === "admin") return "organisationsadministrator";
  if (role === "bruger" || role === "bruger2") return "konsulent";
  return role;
}

function roleForSession(session: ApiSession, preferredRole: Role | null): Role {
  if (preferredRole && apiRoleForUiRole(preferredRole) === session.role) {
    return preferredRole;
  }
  if (session.role === "organisationsadministrator" || session.role === "platformsadministrator") {
    return "admin";
  }
  if (session.role === "konsulent") return "bruger";
  return session.role;
}

function readUiRolePreference(): Role | null {
  return inMemoryUiRolePreference;
}

function writeUiRolePreference(role: Role): void {
  inMemoryUiRolePreference = role;
}

function clearUiRolePreference(): void {
  inMemoryUiRolePreference = null;
}
