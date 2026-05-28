/**
 * Session Validation and Recovery
 * Ensures user is properly authenticated before sensitive operations
 */

import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export interface SessionStatus {
  isValid: boolean;
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  requiresLogin: boolean;
  error?: string;
}

/**
 * Verify current session is valid and user is authenticated
 * Use before any RLS-protected operations
 */
export const verifySession = async (): Promise<SessionStatus> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      return {
        isValid: false,
        user: null,
        session: null,
        accessToken: null,
        requiresLogin: true,
        error: error.message,
      };
    }

    if (!session || !session.user) {
      return {
        isValid: false,
        user: null,
        session: null,
        accessToken: null,
        requiresLogin: true,
        error: 'No active session',
      };
    }

    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at || 0;
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = expiresAt - now;
    const tokenExpiringSoon = expiresIn < 300; // 5 minutes

    // Refresh token if expiring soon
    if (tokenExpiringSoon) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        return {
          isValid: false,
          user: null,
          session: null,
          accessToken: null,
          requiresLogin: true,
          error: 'Session expired, please log in again',
        };
      }

      session = refreshData.session;
    }

    return {
      isValid: true,
      user: session.user,
      session: session,
      accessToken: session.access_token || null,
      requiresLogin: false,
    };
  } catch (err: any) {
    return {
      isValid: false,
      user: null,
      session: null,
      accessToken: null,
      requiresLogin: true,
      error: err?.message || 'Session verification failed',
    };
  }
};

/**
 * Ensure authenticated before operation
 * Throws if session invalid
 */
export const requireSession = async (): Promise<{ user: User; session: Session; accessToken: string }> => {
  const status = await verifySession();

  if (!status.isValid || !status.user || !status.session || !status.accessToken) {
    throw new Error(status.error || 'Authentication required. Please log in to book.');
  }

  return {
    user: status.user,
    session: status.session,
    accessToken: status.accessToken,
  };
};

/**
 * Get current user with fallback to context
 */
export const getCurrentUser = async (
  contextUser: User | null | undefined
): Promise<User | null> => {
  // Try context first (faster)
  if (contextUser?.id) {
    return contextUser;
  }

  // Fall back to session check
  const status = await verifySession();
  return status.user;
};
