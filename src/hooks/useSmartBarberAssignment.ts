import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface BarberAssignmentResult {
  barberId: string;
  barberName: string;
  workloadScore: number;
  estimatedWait: number; // in minutes
  completionTime: string; // e.g., "5:45 PM"
  reason: string;
}

export function useSmartBarberAssignment() {
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BarberAssignmentResult | null>(null);

  const assignBestBarber = useCallback(
    async (
      salonId: string,
      selectedServices: Tables<"services">[],
      bookingDate: string
    ): Promise<BarberAssignmentResult | null> => {
      setIsAssigning(true);
      setError(null);
      setResult(null);

      try {
        console.log("🎯 SMART_ASSIGNMENT_START", {
          salonId,
          serviceCount: selectedServices.length,
          bookingDate,
        });

        if (!selectedServices || selectedServices.length === 0) {
          throw new Error("No services selected");
        }

        // Get total duration and price
        const totalDuration = selectedServices.reduce(
          (sum, s) => sum + (s.duration || 30),
          0
        );
        const totalPrice = selectedServices.reduce(
          (sum, s) => sum + (s.price || 0),
          0
        );

        // PHASE 1: Fetch all active barbers for this salon
        console.log("📥 FETCHING_BARBERS for salon:", salonId);
        const { data: barbers, error: barbersError } = await supabase
          .from("barbers")
          .select("id, name, is_online, is_active, status")
          .eq("salon_id", salonId)
          .eq("is_active", true);

        if (barbersError) {
          console.error("❌ BARBERS_QUERY_ERROR:", barbersError);
          throw barbersError;
        }

        if (!barbers || barbers.length === 0) {
          console.warn("⚠️ NO_BARBERS_FOUND for salon:", salonId);
          throw new Error("No stylists available. Please try again later.");
        }

        console.log("✅ BARBERS_FETCHED", {
          count: barbers.length,
          names: barbers.map((b: any) => b.name),
          onlineCount: barbers.filter((b: any) => b.is_online).length,
        });

        // PHASE 2: Get barber service capabilities
        const serviceIds = selectedServices.map((s) => s.id);
        console.log("📥 CHECKING_SERVICE_COMPATIBILITY for", serviceIds.length, "services");

        const { data: capabilities, error: capError } = await supabase
          .from("barber_services")
          .select("barber_id, service_id")
          .in("service_id", serviceIds);

        if (capError) {
          console.error("❌ BARBER_SERVICES_QUERY_ERROR:", capError);
          // FALLBACK: If barber_services unavailable, assume all barbers can do all services
          console.warn("⚠️ FALLBACK: Assuming all barbers support all services");
        }

        // Group capabilities by barber
        const barberCapabilities = new Map<string, Set<string>>();
        (capabilities || []).forEach((cap: any) => {
          if (!barberCapabilities.has(cap.barber_id)) {
            barberCapabilities.set(cap.barber_id, new Set());
          }
          barberCapabilities.get(cap.barber_id)!.add(cap.service_id);
        });

        console.log("📊 SERVICE_COMPATIBILITY_MAP", {
          barberCount: barberCapabilities.size,
          totalCapabilities: capabilities?.length || 0,
        });

        // Find barbers who can do ALL services (or fallback if no capabilities data)
        let compatibleBarbers = barbers.filter((barber) => {
          if (capabilities && capabilities.length > 0) {
            // If we have capability data, filter strictly
            const barberCaps = barberCapabilities.get(barber.id) || new Set();
            return serviceIds.every((id) => barberCaps.has(id));
          }
          // FALLBACK: If no capability data, consider all barbers compatible
          return true;
        });

        console.log("📋 COMPATIBLE_BARBERS", {
          count: compatibleBarbers.length,
          names: compatibleBarbers.map((b: any) => b.name),
        });

        // FALLBACK: If no compatible barbers found for specific services,
        // use least loaded barber from all available
        if (compatibleBarbers.length === 0) {
          console.warn("⚠️ NO_COMPATIBLE_BARBERS: Using fallback selection");
          compatibleBarbers = barbers; // Fallback to all barbers
        }

        // PHASE 3: Fetch queue data for workload calculation
        console.log("📥 FETCHING_QUEUE_DATA for", salonId, "on", bookingDate);
        const { data: queueData, error: queueError } = await supabase
          .from("queue")
          .select("barber_id, status, total_duration")
          .eq("salon_id", salonId)
          .eq("booking_date", bookingDate)
          .in("status", ["waiting", "in_progress"]);

        if (queueError) {
          console.error("❌ QUEUE_QUERY_ERROR:", queueError);
          // Continue anyway, just use empty queue
        }

        console.log("📊 QUEUE_DATA", {
          totalQueue: queueData?.length || 0,
          byBarber: compatibleBarbers.map((b: any) => ({
            name: b.name,
            queueCount: (queueData || []).filter((q: any) => q.barber_id === b.id).length,
          })),
        });

        // PHASE 4: Calculate workload score for each compatible barber
        interface BarberScore {
          barber: (typeof compatibleBarbers)[0];
          score: number;
          queueCount: number;
          totalMinutes: number;
          reason: string;
          isOnline: boolean;
        }

        const barberScores: BarberScore[] = compatibleBarbers.map((barber) => {
          const barberQueue = (queueData || []).filter(
            (q: any) => q.barber_id === barber.id
          );
          const queueCount = barberQueue.length;
          const totalMinutes = barberQueue.reduce(
            (sum: number, q: any) => sum + (q.total_duration || 30),
            0
          );

          // Workload score formula
          // Lower score = better availability
          const workloadScore = queueCount * 0.5 + (totalMinutes / 30) * 0.3;

          // Apply online penalty (heavy penalty if offline)
          const finalScore = barber.is_online ? workloadScore : workloadScore + 1000;

          return {
            barber,
            score: finalScore,
            queueCount,
            totalMinutes,
            isOnline: barber.is_online,
            reason:
              queueCount === 0
                ? "No customers ahead"
                : `${queueCount} customer${queueCount > 1 ? "s" : ""} ahead`,
          };
        });

        // Sort by score and pick the best
        barberScores.sort((a, b) => a.score - b.score);
        const bestMatch = barberScores[0];

        console.log("📊 WORKLOAD_SCORES", {
          top3: barberScores.slice(0, 3).map((b) => ({
            name: b.barber.name,
            score: b.score.toFixed(2),
            queue: b.queueCount,
            online: b.isOnline,
          })),
        });

        // PHASE 5: Calculate estimated wait and completion time
        const onlineBarbers = compatibleBarbers.filter((b: any) => b.is_online);
        const activeBarberCount = Math.max(1, onlineBarbers.length); // At least 1
        const baseWait = Math.ceil(bestMatch.totalMinutes / activeBarberCount);
        const buffer = Math.min(15, Math.max(2, bestMatch.queueCount * 2));
        const estimatedWait = Math.max(5, baseWait + buffer);

        // Calculate completion time
        const now = new Date();
        now.setHours(10, 0, 0, 0);
        const completionMinutes = estimatedWait + totalDuration;
        now.setMinutes(now.getMinutes() + completionMinutes);
        const completionTime = now.toLocaleString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        const assignmentResult: BarberAssignmentResult = {
          barberId: bestMatch.barber.id,
          barberName: bestMatch.barber.name,
          workloadScore: bestMatch.score,
          estimatedWait,
          completionTime,
          reason: bestMatch.isOnline
            ? bestMatch.reason
            : `${bestMatch.reason} (currently offline)`,
        };

        console.log("✅ ASSIGNMENT_COMPLETE", assignmentResult);

        setResult(assignmentResult);
        return assignmentResult;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unable to find available stylist";
        console.error("❌ SMART_ASSIGNMENT_ERROR:", errorMessage, err);
        setError(errorMessage);
        
        // PHASE 6: Show loading state for retry
        // Don't completely fail - show "Finding available stylist..." to user
        return null;
      } finally {
        setIsAssigning(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsAssigning(false);
    setError(null);
    setResult(null);
  }, []);

  return {
    assignBestBarber,
    isAssigning,
    error,
    result,
    reset,
  };
}
