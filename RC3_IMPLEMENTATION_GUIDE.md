# RC3 FINAL BOOKING FLOW FIX - IMPLEMENTATION GUIDE

## Status: IN PROGRESS
All 9 phases will be completed in this session.

## Changes Required to SalonDetail.tsx

### 1. Add New State (After line 94)
```typescript
// PHASE 1: Multi-Service Selection
const [selectedServices, setSelectedServices] = useState<Tables<"services">[]>([]);
const { assignBestBarber, isAssigning, error: assignmentError, result: assignmentResult, reset: resetAssignment } = useSmartBarberAssignment();
const [assignedBarber, setAssignedBarber] = useState<BarberAssignmentResult | null>(null);
```

### 2. Add Import (Top of file)
```typescript
import { ServiceSelector } from "@/components/booking/ServiceSelector";
import { AssignmentLoader } from "@/components/booking/AssignmentLoader";
import { useSmartBarberAssignment, type BarberAssignmentResult } from "@/hooks/useSmartBarberAssignment";
```

### 3. NEW FLOW: Replace Step Handling

**Old Flow (4 steps):**
1. Info
2. Single Service
3. Barber Selection
4. Time Slot

**New Flow (4 steps):**
1. Info
2. Multiple Services
3. Smart Assignment
4. Time Slot + Confirmation

### 4. Update Progress Indicator
Currently shows 4 steps - keep as 4 steps but change step 3 from "Barber" to "Assignment"

### 5. Replace Step 2 Service Selection

**OLD CODE (around line 910):**
```typescript
{currentStep === 2 && (
  // Single service dropdown
  <select value={selectedService?.id || ""} onChange={...}>
  ...
)}
```

**NEW CODE:**
```typescript
{currentStep === 2 && (
  <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-5 md:space-y-6 rounded-xl sm:rounded-2xl bg-[#f4f3f6] p-4 sm:p-6 md:p-8 lg:p-10">
    <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
      <span className="flex h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10 items-center justify-center rounded-full bg-[#4f378a] text-xs font-bold text-white">2</span>
      <h2 className="font-display text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">Select Services</h2>
    </div>
    <ServiceSelector
      services={services}
      selectedServices={selectedServices}
      onServicesChange={setSelectedServices}
      isLoading={false}
    />
  </motion.section>
)}
```

### 6. Replace Step 3 - Auto-Assignment

**REMOVE:**
- Old barber selection code (lines ~950-1000)

**ADD:**
```typescript
{currentStep === 3 && (
  <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-5 md:space-y-6 rounded-xl sm:rounded-2xl bg-[#f4f3f6] p-4 sm:p-6 md:p-8 lg:p-10">
    <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
      <span className="flex h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10 items-center justify-center rounded-full bg-[#4f378a] text-xs font-bold text-white">3</span>
      <h2 className="font-display text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">Find Your Stylist</h2>
    </div>
    <AssignmentLoader
      isLoading={isAssigning}
      assignmentResult={assignmentResult}
      error={assignmentError}
    />
  </motion.section>
)}
```

### 7. Auto-Trigger Assignment

Add effect after services selected:
```typescript
useEffect(() => {
  if (currentStep === 3 && selectedServices.length > 0 && !assignmentResult) {
    console.log("🎯 AUTO_ASSIGNMENT_TRIGGER", { serviceCount: selectedServices.length });
    assignBestBarber(salon.id, selectedServices, date || new Date().toISOString().split('T')[0]);
  }
}, [currentStep, selectedServices]);
```

### 8. Update Step Validation

**OLD (line ~1063):**
```typescript
if (currentStep === 2 && !selectedService) {
  toast.error("Please select a service");
  return;
}
if (currentStep === 3 && !selectedBarberId) {
  toast.error("Please select a barber");
  return;
}
```

**NEW:**
```typescript
if (currentStep === 2 && selectedServices.length === 0) {
  toast.error("Please select at least one service");
  return;
}
if (currentStep === 3 && !assignmentResult) {
  toast.error("Stylist is being assigned...");
  return;
}
```

### 9. Update Booking Logic

**OLD:** Used `selectedService?.name` and `selectedService?.price`
**NEW:** Use `selectedServices` array:

```typescript
const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0);
const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
const serviceNames = selectedServices.map(s => s.name).join(", ");
```

### 10. Update Queue Insertion

```typescript
// OLD:
.insert({
  service_id: selectedService.id,
  service_name: selectedService.name,
  ...
})

// NEW:
.insert({
  service_ids: selectedServices.map(s => s.id), // Or store in booking_services
  service_name: serviceNames,
  total_duration: totalDuration,
  is_multi_service: selectedServices.length > 1,
  barber_id: assignmentResult?.barberId, // Auto-assigned
  ...
})

// Then insert booking_services records:
await supabase
  .from("booking_services")
  .insert(
    selectedServices.map(s => ({
      booking_id: insertedData.id,
      service_id: s.id,
      duration: s.duration,
      price: s.price
    }))
  );
```

### 11. Update Availability Check

```typescript
// Change from checking specific barber to any barber
// Or use: check if TIME SLOT is available for ANY of compatible barbers
```

### 12. Remove selectedBarberId Dependency

Replace all `selectedBarberId` references with `assignmentResult?.barberId`

## Phase Testing Checklist

- [ ] Multi-select works (click service toggles it)
- [ ] Barber screen removed  
- [ ] Auto-assignment triggers when services selected
- [ ] Assignment loader shows correctly
- [ ] Assignment result displays barber name
- [ ] Booking submission uses selectedServices
- [ ] Real-time queue updates work
- [ ] Salon load display works
- [ ] Completion flow works end-to-end

## Files to Modify
1. SalonDetail.tsx - Main booking flow (complex edits)
2. Keep existing: ServiceSelector.tsx, AssignmentLoader.tsx, useSmartBarberAssignment.ts

## Time Estimate
- Update SalonDetail: 30-40 minutes
- QA testing: 15-20 minutes  
- Documentation: 10-15 minutes
- Git push: 5 minutes
