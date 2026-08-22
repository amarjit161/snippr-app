import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const selectedIds = new Set(selectedServices.map(s => s.id));

  const handleToggleService = (service: Tables<"services">) => {
    if (selectedIds.has(service.id)) {
      // Remove service
      onServicesChange(selectedServices.filter(s => s.id !== service.id));
    } else {
      // Add service
      onServicesChange([...selectedServices, service]);
    }
  };

  const handleClearAll = () => {
    onServicesChange([]);
  };

  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Select Services
        </h3>
        {selectedServices.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AnimatePresence>
          {services.map((service) => {
            const isSelected = selectedIds.has(service.id);
            return (
              <motion.button
                key={service.id}
                onClick={() => handleToggleService(service)}
                onMouseEnter={() => setHoveredId(service.id)}
                onMouseLeave={() => setHoveredId(null)}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -2 }}
                disabled={isLoading}
                className={`relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                  ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-gray-200 bg-white hover:border-primary/40"
                  }
                  ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                {/* Checkmark overlay */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute top-2 right-2 bg-primary/100 rounded-full p-1.5"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Service Info */}
                <div className="space-y-2">
                  <div className="pr-8">
                    <h4 className="font-semibold text-gray-900">
                      {service.name}
                    </h4>
                  </div>

                  {/* Duration and Price */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      ⏱️ {service.duration || 30} mins
                    </span>
                    <span className="font-semibold text-primary">
                      ₹{service.price || 0}
                    </span>
                  </div>
                </div>

                {/* Hover effect indicator */}
                {hoveredId === service.id && !isSelected && (
                  <motion.div
                    layoutId="hoverBg"
                    className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Summary Panel */}
      {selectedServices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20 p-4"
        >
          <div className="space-y-3">
            {/* Selected Services List */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Selected Services ({selectedServices.length})
              </h4>
              <div className="space-y-1">
                {selectedServices.map((service) => (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-700">✓ {service.name}</span>
                    <span className="text-gray-600">
                      {service.duration || 30}m / ₹{service.price || 0}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-primary/20 pt-3 mt-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">
                    Total Duration
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {totalDuration}
                  </p>
                  <p className="text-xs text-gray-500">minutes</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600 uppercase tracking-wide">
                    Total Price
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    ₹{totalPrice.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>

            {/* Info text */}
            <p className="text-xs text-gray-600 italic">
              💡 The fastest available barber who can handle all services will be
              automatically assigned
            </p>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {services.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No services available</p>
        </div>
      )}

      {/* Helper Text */}
      {selectedServices.length === 0 && services.length > 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          Select one or more services to continue
        </p>
      )}
    </div>
  );
}
