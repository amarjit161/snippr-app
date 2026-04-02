import { useNavigate, useLocation } from "react-router-dom";
import { Scissors, LogOut, User, Settings, Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onSignOut?: () => void;
  userName?: string;
  onAdminToggle?: () => void;
  isAdmin?: boolean;
}

const Header = ({ onSignOut, userName, onAdminToggle, isAdmin }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isPublic = !userName;

  return (
  <header className="sticky top-0 z-50 border-b border-border/70 bg-card/85 backdrop-blur-md">
    <div className="container flex h-16 items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-500 text-primary-foreground shadow-sm">
          <Scissors className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-display text-xl font-bold text-foreground">
          Snippr
        </span>
      </div>

      {isPublic && location.pathname !== "/auth" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => navigate("/salons")} className="hidden sm:flex text-muted-foreground">
            <Search className="mr-2 h-4 w-4" /> Browse Salons
          </Button>
          <Button variant="outline" onClick={() => navigate("/owner-login")} className="gap-2 rounded-xl">
            Owner Login
          </Button>
          <Button variant="outline" onClick={() => navigate("/owner-register")} className="gap-2 rounded-xl">
            Owner Signup
          </Button>
          <Button onClick={() => navigate("/auth?role=customer")} className="gap-2 rounded-xl">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {userName && onSignOut && (
        <div className="flex items-center gap-2">
          {onAdminToggle && (
            <button
              onClick={onAdminToggle}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors ${
                isAdmin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}
          <span className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground px-2">
            <User className="h-3.5 w-3.5" />
            {userName.length > 20 ? userName.slice(0, 20) + "…" : userName}
          </span>
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      )}
    </div>
  </header>
  );
};

export default Header;
