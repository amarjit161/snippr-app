import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import { Loader2, Calendar, RotateCcw } from "lucide-react";

interface SlotPickerProps {
  salonId: string;
  date: string; // YYYY-MM-DD
  barberId?: string;
  selectedSlot: string;
  onSlotSelect: (timeValue: string, timeLabel: string) => void;
}

interface SlotGroup {
  label: string;
  emoji: string;
  slots: any[];
}

export function SlotPicker({
  salonId,
  date,
  barberId,
  selectedSlot,
  onSlotSelect,
}: SlotPickerProps) {
  const { slots, loading, availableCount, totalCount, lastUpdated, refresh } =
    useSlotAvailability(salonId, date, barberId);

  console.log('SLOT_PICKER_RENDER:', { 
    salonId, 
    date, 
    barberId,
    selectedSlot,
    slotsCount: slots.length,
    availableCount,
    totalCount,
    loading,
    lastUpdated
  });

  // Group slots by time of day
  const groupSlots = (): SlotGroup[] => {
    const morning = [];
    const afternoon = [];
    const evening = [];

    for (const slot of slots) {
      const hour = parseInt(slot.timeValue.split(":")[0]);
      if (hour < 12) {
        morning.push(slot);
      } else if (hour < 17) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    }

    return [
      { label: "Morning", emoji: "🌅", slots: morning },
      { label: "Afternoon", emoji: "☀️", slots: afternoon },
      { label: "Evening", emoji: "🌇", slots: evening },
    ];
  };

  const getGroupAvailability = (groupSlots: any[]) => {
    if (groupSlots.length === 0) return { available: 0, total: 0 };
    const available = groupSlots.filter((s) => s.available).length;
    return { available, total: groupSlots.length };
  };

  const getGroupColor = (available: number, total: number) => {
    if (available === 0) return "bg-red-50 border-red-200";
    if (available < 3) return "bg-amber-50 border-amber-200";
    return "bg-green-50 border-green-200";
  };

  const getGroupBadgeColor = (available: number, total: number) => {
    if (available === 0) return "bg-red-100 text-red-700";
    if (available < 3) return "bg-amber-100 text-amber-700";
    return "bg-green-100 text-green-700";
  };

  // Check if fully booked
  const isFullyBooked = availableCount === 0 && totalCount > 0;

  // Seconds ago helper
  const getTimeAgo = () => {
    if (!lastUpdated) return "never";
    const seconds = Math.floor(
      (new Date().getTime() - lastUpdated.getTime()) / 1000
    );
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  if (!date) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Select a date to view available slots</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="h-8 bg-gray-200 rounded-lg animate-pulse" />
        {/* Slot skeletons */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="h-12 bg-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const groups = groupSlots();

  return (
    <div className="space-y-5">
      {/* Header with availability counter */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600 font-medium">Total Availability</p>
          <p
            className={`text-2xl sm:text-3xl font-bold mt-1 ${
              availableCount === 0
                ? "text-red-700"
                : availableCount < totalCount / 3
                  ? "text-amber-700"
                  : "text-green-700"
            }`}
          >
            {availableCount}/{totalCount}
            <span className="text-lg sm:text-xl text-gray-500 ml-1">
              slots
            </span>
          </p>
        </div>

        {/* Refresh button */}
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="p-2.5 rounded-lg border-2 border-gray-300 hover:border-purple-300 transition disabled:opacity-50"
          title="Refresh availability"
        >
          <RotateCcw
            className={`w-5 h-5 text-gray-600 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span>
          Live · Updated {getTimeAgo()} ago
        </span>
      </div>

      {/* Fully booked state */}
      {isFullyBooked ? (
        <div className="text-center py-12 bg-red-50 border-2 border-red-200 rounded-lg">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-red-400" />
          <p className="text-sm font-semibold text-red-700 mb-1">
            No slots available
          </p>
          <p className="text-xs text-red-600">Try selecting a different date</p>
        </div>
      ) : (
        <>
          {/* Time slot groups */}
          <div className="space-y-5">
            {groups.map(
              (group) =>
                group.slots.length > 0 && (
                  <div key={group.label}>
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-sm font-semibold text-gray-700">
                        {group.emoji} {group.label}
                      </p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${getGroupBadgeColor(
                          getGroupAvailability(group.slots).available,
                          getGroupAvailability(group.slots).total
                        )}`}
                      >
                        {getGroupAvailability(group.slots).available}/
                        {getGroupAvailability(group.slots).total}
                      </span>
                    </div>

                    {/* Slot grid */}
                    <div
                      className={`border-2 rounded-lg p-3 sm:p-4 ${getGroupColor(
                        getGroupAvailability(group.slots).available,
                        getGroupAvailability(group.slots).total
                      )}`}
                    >
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                        {group.slots.map((slot) => (
                          <button
                            key={slot.timeValue}
                            onClick={() =>
                              slot.available &&
                              onSlotSelect(slot.timeValue, slot.time)
                            }
                            disabled={!slot.available}
                            className={`
                              relative py-2.5 px-2 rounded-lg font-medium text-xs sm:text-sm transition-all
                              ${
                                selectedSlot === slot.timeValue
                                  ? "bg-purple-500 text-white border-2 border-purple-600 shadow-lg scale-105"
                                  : slot.available
                                    ? "bg-white border-2 border-gray-300 text-gray-700 hover:border-purple-400 hover:bg-purple-50"
                                    : "bg-gray-200 border-2 border-gray-300 text-gray-400 line-through cursor-not-allowed"
                              }
                            `}
                          >
                            {selectedSlot === slot.timeValue && (
                              <span className="absolute -top-1 -right-1 bg-white text-purple-500 rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                ✓
                              </span>
                            )}
                            {!slot.available && (
                              <span className="absolute -top-2 -right-2 w-3 h-3 bg-red-500 rounded-full" />
                            )}
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
            )}
          </div>

          {/* Legend */}
          <div className="border-t pt-4 grid grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded border-2 border-gray-300 bg-white" />
              <span className="text-gray-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-purple-500 border-2 border-purple-600" />
              <span className="text-gray-600">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded border-2 border-gray-300 bg-gray-200 line-through" />
              <span className="text-gray-600">Booked</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
