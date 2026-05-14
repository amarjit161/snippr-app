import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Scissors, Home } from "lucide-react";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-white px-6">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100 text-purple-600 shadow-inner">
        <Scissors className="h-10 w-10" />
      </div>
      <div className="text-center">
        <h1 className="mb-2 text-7xl font-extrabold tracking-tight text-gray-900">404</h1>
        <h2 className="mb-4 text-2xl font-bold text-gray-800">Oops! Page not found</h2>
        <p className="mx-auto mb-8 max-w-md text-gray-500">
          It looks like the page you are looking for has been snipped away or doesn't exist.
        </p>
        <Link 
          to="/" 
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition-all hover:bg-purple-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
        >
          <Home className="h-4 w-4" />
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

