import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface OwnerProtectedRouteProps {
  children: React.ReactNode;
}

const OwnerProtectedRoute: React.FC<OwnerProtectedRouteProps> = ({ children }) => {
  const { user, profile, loading, profileLoading } = useAuth();

  // Check localStorage as fallback while AuthContext is syncing
  const localStorageProfile = useMemo(() => {
    try {
      const stored = localStorage.getItem("owner");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const hasProfile = profile || localStorageProfile;

  // Wait for BOTH session loading AND profile fetching to complete
  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/owner-login" replace />;
  }

  if (!hasProfile) {
    return <Navigate to="/owner-register" replace />;
  }

  return <>{children}</>;
};

export { OwnerProtectedRoute };

