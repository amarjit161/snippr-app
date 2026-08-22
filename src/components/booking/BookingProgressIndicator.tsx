import { useLocation, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { BOOKING_STEPS } from "@/contexts/BookingDraftContext";

export function BookingProgressIndicator() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentIndex = BOOKING_STEPS.findIndex((s) => s.path === location.pathname);

  return (
    <div className="flex items-center gap-2">
      {BOOKING_STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        return (
          <div key={step.key} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={index > currentIndex}
              onClick={() => index < currentIndex && navigate(step.path)}
              className="flex items-center gap-2 disabled:cursor-default"
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={`hidden text-xs font-semibold sm:inline ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </button>
            {index < BOOKING_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 rounded-full transition-colors ${isDone ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
