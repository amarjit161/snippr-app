import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import * as geolocation from "@/hooks/useGeolocation";

// The device position remembered in memory (useGeolocation `remember`) must not
// leak from one test into the next. (Optional: some suites mock the hook module.)
afterEach(() => (geolocation as Partial<typeof geolocation>).forgetRememberedLocation?.());

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

