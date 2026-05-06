import { useEffect, useState } from "react";
import { DEPARTMENTS, type Department } from "@/lib/types";

const KEY = "mcr.parts.user";

export type CurrentUser = { name: string; department: Department };

const DEFAULT: CurrentUser = { name: "", department: "dispatch" };

export function getCurrentUser(): CurrentUser {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<CurrentUser>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      department: (DEPARTMENTS as readonly string[]).includes(parsed.department ?? "")
        ? (parsed.department as Department)
        : "dispatch",
    };
  } catch {
    return DEFAULT;
  }
}

export function setCurrentUser(u: CurrentUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(u));
  window.dispatchEvent(new CustomEvent("mcr-user-changed"));
}

export function useCurrentUser(): [CurrentUser, (u: CurrentUser) => void] {
  const [user, setUser] = useState<CurrentUser>(DEFAULT);
  useEffect(() => {
    setUser(getCurrentUser());
    const onChange = () => setUser(getCurrentUser());
    window.addEventListener("mcr-user-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("mcr-user-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const update = (u: CurrentUser) => {
    setCurrentUser(u);
    setUser(u);
  };
  return [user, update];
}
