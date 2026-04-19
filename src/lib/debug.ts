/**
 * Debug logging utility
 * Only logs in development mode, completely removed from production builds
 */

const isDev = import.meta.env.DEV;

export const debug = {
  log: (message: string, ...args: any[]) => {
    if (isDev) console.log(message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    if (isDev) console.error(message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    if (isDev) console.warn(message, ...args);
  },
};
