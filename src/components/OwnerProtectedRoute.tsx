import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface OwnerProtectedRouteProps {
  children: React.ReactNode;
}

const OwnerProtectedRoute: React.FC<OwnerProtectedRouteProps> = ({ children }) => {
  const { user, profile, loading, profileLoading } = useAuth();

  console.log('OWNER_PROTECTED_ROUTE', {
    loading,
    profileLoading,
    user: user?.email,
    profile: !!profile,
  });

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
    console.log('OWNER_PROTECTED_ROUTE: No user, redirecting to login');
    return <Navigate to="/owner-login" replace />;
  }

  if (!profile) {
    console.log('OWNER_PROTECTED_ROUTE: No owner profile found, redirecting to registration');
    return <Navigate to="/owner-registration" replace />;
  }

  console.log('OWNER_PROTECTED_ROUTE: Access granted for', user.email);
  return <>{children}</>;
};

export default OwnerProtectedRoute;
