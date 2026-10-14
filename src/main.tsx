import { getAppHostRedirect } from "./lib/domains";
import "./index.css";

// Marketing host + app route (e.g. www.snippr.in/q/<code>): hand off to the app
// host before App (and with it the Supabase client) is even imported, so auth
// tokens in the URL are consumed on the host that will actually use the session.
const appHostRedirect = getAppHostRedirect();

if (appHostRedirect) {
  window.location.replace(appHostRedirect);
} else {
  void Promise.all([import("react-dom/client"), import("./App.tsx")]).then(([{ createRoot }, { default: App }]) => {
    createRoot(document.getElementById("root")!).render(<App />);
  });
}
