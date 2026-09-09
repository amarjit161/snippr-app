import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Clock, Scissors } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { formatINR } from "@/lib/currency";

interface ServiceSelectorProps {
  services: Tables<"services">[];
  selectedServices: Tables<"services">[];
  onServicesChange: (services: Tables<"services">[]) => void;
  isLoading?: boolean;
}

export function ServiceSelector({
  services,
  selectedServices,
  onServicesChange,
  isLoading = false,
}: ServiceSelectorProps) {
  const shouldReduceMotion = useReducedMotion();
  const selectedIds = new Set(selectedServices.map((s) => s.id));

  const handleToggleService = (service: Tables<"services">) => {
    if (selectedIds.has(service.id)) {
      onServicesChange(selectedServices.filter((s) => s.id !== service.id));
    } else {
      onServicesChange([...selectedServices, service]);
    }
  };

  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);

  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center">
        <Scissors className="mx-auto mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">No services available</p>
        <p className="mt-1 text-sm text-muted-foreground">This salon hasn&apos;t added any bookable services yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedServices.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onServicesChange([])}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-label="Services">
        <AnimatePresence initial={false}>
          {services.map((service) => {
            const isSelected = selectedIds.has(service.id);
            return (
              <motion.button
                key={service.id}
                type="button"
                onClick={() => handleToggleService(service)}
                aria-pressed={isSelected}
                disabled={isLoading}
                layout={!shouldReduceMotion}
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
                className={`relative min-h-[44px] rounded-2xl border p-4 text-left transition-colors sm:p-5 ${
                  isSelected
                    ? "border-primary bg-primary/[0.08] shadow-sm"
                    : "border-border bg-card hover:border-primary/40"
                } ${isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{service.name}</p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {service.duration || 30} min
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected ? "border-primary bg-primary" : "border-border bg-transparent"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                  </span>
                </div>
                <p className={`mt-3 font-mono text-base font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                  {formatINR(service.price || 0)}
                </p>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {selectedServices.length > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3.5">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {selectedServices.length} {selectedServices.length === 1 ? "service" : "services"} · {totalDuration} min
            </p>
            <p className="text-xs text-muted-foreground">We&apos;ll assign the fastest available stylist</p>
          </div>
          <p className="font-mono text-lg font-bold text-primary">{formatINR(totalPrice)}</p>
        </div>
      ) : (
        <p className="py-2 text-center text-sm text-muted-foreground">Select one or more services to continue</p>
      )}
    </div>
  );
}
