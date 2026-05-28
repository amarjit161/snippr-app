/**
 * RLS Error Handler for Queue Booking System
 * Detects and handles Supabase Row Level Security errors
 */

export interface RLSError {
  code: string;
  message: string;
  status: number;
  details: any;
  isRLSError: boolean;
  isAuthError: boolean;
  userFacingMessage: string;
  suggestedAction: string;
}

/**
 * Detect if an error is an RLS permission error
 */
export const isRLSPermissionError = (error: any): boolean => {
  return (
    error?.code === '42501' || // PostgreSQL permission denied
    error?.message?.includes('permission denied') ||
    error?.status === 403
  );
};

/**
 * Detect if an error is an authentication error
 */
export const isAuthError = (error: any): boolean => {
  return (
    error?.status === 401 ||
    error?.code === '401' ||
    error?.message?.includes('Unauthorized') ||
    error?.message?.includes('not authenticated')
  );
};

/**
 * Parse booking error and provide user-facing message
 */
export const parseBookingError = (error: any): RLSError => {
  const code = error?.code || 'UNKNOWN';
  const status = error?.status || 500;
  const message = error?.message || 'Unknown error';
  const details = error?.details || {};

  const isRLS = isRLSPermissionError(error);
  const isAuth = isAuthError(error);

  let userFacingMessage = 'Booking failed. Please try again.';
  let suggestedAction = 'retry';

  // RLS Permission Denied
  if (isRLS) {
    userFacingMessage = 'Permission denied. This is a system error. Please refresh and try again.';
    suggestedAction = 'refresh_and_retry';
  }
  // Authentication / Session Expired
  else if (isAuth) {
    userFacingMessage = 'Your session has expired. Please log in again to book.';
    suggestedAction = 'redirect_to_login';
  }
  // Duplicate Slot Error
  else if (message.includes('duplicate') || code === '23505') {
    userFacingMessage = 'This time slot was just booked by another customer! Please choose a different time.';
    suggestedAction = 'refresh_availability';
  }
  // Foreign Key Constraint
  else if (message.includes('foreign key') || code === '23503') {
    userFacingMessage = 'Invalid barber or service selection. Please refresh and try again.';
    suggestedAction = 'refresh_and_retry';
  }
  // Network Error
  else if (error?.message?.includes('timeout') || error?.message?.includes('network')) {
    userFacingMessage = 'Network connection lost. Please check your connection and try again.';
    suggestedAction = 'retry';
  }

  return {
    code,
    message,
    status,
    details,
    isRLSError: isRLS,
    isAuthError: isAuth,
    userFacingMessage,
    suggestedAction,
  };
};

/**
 * Recommend action based on error
 */
export const getBookingErrorAction = (error: RLSError): {
  action: 'retry' | 'redirect' | 'refresh' | 'manual_fix';
  delay?: number;
} => {
  switch (error.suggestedAction) {
    case 'redirect_to_login':
      return { action: 'redirect', delay: 2000 };
    case 'refresh_and_retry':
      return { action: 'refresh', delay: 1500 };
    case 'refresh_availability':
      return { action: 'refresh', delay: 500 };
    case 'retry':
      return { action: 'retry', delay: 1000 };
    default:
      return { action: 'manual_fix' };
  }
};
