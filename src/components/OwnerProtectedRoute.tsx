import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

interface OwnerProtectedRouteProps {
  children: ReactNode;
}

export const OwnerProtectedRoute = ({ children }: OwnerProtectedRouteProps) => {
  const ownerRaw = localStorage.getItem("owner");

  if (!ownerRaw) {
    return <Navigate to="/owner-login" replace />;
  }

  try {
    JSON.parse(ownerRaw);
  } catch {
    localStorage.removeItem("owner");
    return <Navigate to="/owner-login" replace />;
  }

  return <>{children}</>;
};
