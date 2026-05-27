# Auto-Assignment Logic Documentation

**Date**: May 27, 2026  
**Status**: Production Ready  
**Component**: `bookingEngine.ts`

---

## Overview

The **Smart Barber Auto-Assignment System** intelligently matches customers with the best available barber for their selected services. This eliminates manual barber selection while ensuring optimal queue distribution and service compatibility.

---

## Architecture

### Core Functions

#### 1. `assignBestBarber(salonId, selectedServices, bookingDate)`

**Purpose**: Main entry point for automatic barber assignment

**Input Parameters**:
```typescript
salonId: string;              // Salon ID
selectedServices: ServiceSelection[]; // Array of selected services
bookingDate: string;          // Date of booking (YYYY-MM-DD)
```

**Output**:
```typescript
{
  barberId: string;
  barberName: string;
  supportedServices: number;
  totalServiceCount: number;
  canServiceAll: boolean;
  activeQueueCount: number;
  workloadScore: number;
  estimatedWaitMinutes: number;
  estimatedCompletionTime: string;
  assignmentReason: string;
}
```

**Algorithm Flow**:
```
1. Validate Input
   ├─ Check salon exists
   ├─ Check services not empty
   └─ Check booking date valid

2. Fetch Active Barbers
   ├─ Query: WHERE salon_id=? AND is_active=TRUE
   └─ Requires: Name, online status

3. Calculate Workload
   ├─ For each barber:
   │  ├─ Count active bookings
   │  ├─ Sum booking durations
   │  └─ Calculate workload score
   └─ Store in workloadMap

4. Score Each Barber
   ├─ Check service compatibility
   ├─ Apply workload formula
   └─ Collect results

5. Sort by Priority
   ├─ Can service ALL services (DESC)
   ├─ Workload score (ASC)
   └─ Creation date (ASC)

6. Select Best
   ├─ Get first barber
   ├─ Calculate next available slot
   └─ Return assignment result
```

---

## Workload Score Calculation

### Formula

```
workloadScore = (activeQueueCount × 0.5) 
              + (totalDuration / 30 × 0.3)
              + (isOnline ? 0 : 1000)

Where:
- activeQueueCount = Number of active bookings
- totalDuration = Sum of booking durations
- isOnline = Barber online status
```

### Component Explanation

#### Queue Count Component (0.5 weight)
Each active booking adds **0.5 points**:
- 0 bookings = 0 points
- 1 booking = 0.5 points
- 2 bookings = 1.0 points
- 10 bookings = 5.0 points

**Rationale**: Queue length is most important for fair distribution

#### Duration Component (0.3 weight)
Each 30-minute block of scheduled time adds **0.3 points**:
- 0 minutes = 0 points
- 30 minutes = 0.3 points
- 60 minutes = 0.6 points
- 120 minutes = 1.2 points

**Rationale**: Accounts for the time commitment, not just booking count

#### Online Penalty (1000 points)
Offline barbers receive **1000-point penalty**:
- Online barber = 0 additional points
- Offline barber = 1000 additional points

**Rationale**: Heavily prevents assigning to offline barbers

### Score Examples

**Scenario A**: Finding best barber
```
Ali:
├─ Active bookings: 2
├─ Total duration: 60 minutes
├─ Online: Yes
└─ Score = (2 × 0.5) + (60/30 × 0.3) + 0 = 1.6

Bob:
├─ Active bookings: 1
├─ Total duration: 30 minutes
├─ Online: Yes
└─ Score = (1 × 0.5) + (30/30 × 0.3) + 0 = 0.8 ✅ SELECTED

Charlie:
├─ Active bookings: 3
├─ Total duration: 90 minutes
├─ Online: Yes
└─ Score = (3 × 0.5) + (90/30 × 0.3) + 0 = 1.8

Ranked: Bob (0.8) < Ali (1.6) < Charlie (1.8)
Selection: Bob has lowest score
```

**Scenario B**: Online preference
```
Ali:
├─ Active bookings: 1
├─ Total duration: 30 minutes
├─ Online: Yes
└─ Score = 0.5 + 0.3 + 0 = 0.8

Bob:
├─ Active bookings: 0
├─ Total duration: 0 minutes
├─ Online: No
└─ Score = 0 + 0 + 1000 = 1000 ❌ PENALIZED

Ranked: Ali (0.8) << Bob (1000)
Selection: Ali always chosen (offline heavily penalized)
```

---

## Priority System

### Three-Tier Priority

#### Priority 1: Service Compatibility ⭐⭐⭐

**Most Important**: Barber must support ALL selected services

**Example**:
```
Services selected: Haircut, Spa, Facial

Barber compatibility check:
├─ Ali: Haircut ✓, Spa ✓, Facial ✗ → CANNOT SERVICE ALL
├─ Bob: Haircut ✓, Spa ✓, Facial ✓ → CAN SERVICE ALL ✅
└─ Charlie: Haircut ✓, Spa ✗, Facial ✓ → CANNOT SERVICE ALL

Result: Bob selected (only one who can handle all)
```

**Implementation**:
```typescript
const canServiceAll = await canBarberServiceAll(barber.id, serviceIds);

barberScores.sort((a, b) => {
  // Priority 1: Can service all
  if (a.canServiceAll !== b.canServiceAll) {
    return a.canServiceAll ? -1 : 1;  // canServiceAll comes first
  }
  // ... rest of comparison
});
```

#### Priority 2: Workload Score ⭐⭐

**Second Most Important**: Among barbers who can service all, pick lowest workload

**Example**:
```
All barbers can perform services:
├─ Ali: Score 1.6
├─ Bob: Score 0.8 ✅ SELECTED (lowest)
└─ Charlie: Score 1.8

Rationale: Fair queue distribution
```

#### Priority 3: Creation Order ⭐

**Tie-breaker**: If scores identical, pick earliest barber

**Example**:
```
Both barbers have same score (0.8):
├─ Ali: created_at = 2025-01-01
├─ Bob: created_at = 2025-06-01
└─ Selected: Ali (earlier)

Rationale: Consistent tiebreaker
```

---

## Service Compatibility Checking

### Function: `canBarberServiceAll(barberId, serviceIds)`

**Purpose**: Verify barber can perform all selected services

**Process**:
```sql
SELECT service_id 
FROM barber_services 
WHERE barber_id = ? 
AND service_id = ANY(?)
```

**Logic**:
```typescript
const supportedServices = new Set(data.map(s => s.service_id));
return serviceIds.every(id => supportedServices.has(id));
```

**Examples**:

Example 1 - Full Match:
```
Barber Ali services: [haircut_id, beard_id, detan_id]
Requested services: [haircut_id, beard_id, detan_id]
Result: true ✅
```

Example 2 - Partial Match:
```
Barber Ali services: [haircut_id, beard_id]
Requested services: [haircut_id, beard_id, spa_id]
Result: false ❌ (missing spa_id)
```

Example 3 - Extra Services:
```
Barber Ali services: [haircut_id, beard_id, detan_id, spa_id]
Requested services: [haircut_id, beard_id]
Result: true ✅ (has at least all requested)
```

---

## Workload Calculation

### Data Collection

**Query**:
```sql
SELECT barber_id, status, total_duration
FROM queue
WHERE salon_id = ?
  AND booking_date = ?
  AND status IN ('waiting', 'confirmed', 'in_progress')
```

**Processing**:
```typescript
const workloadMap = new Map();

workloadData.forEach(q => {
  if (!workloadMap.has(q.barber_id)) {
    workloadMap.set(q.barber_id, { count: 0, duration: 0 });
  }
  const current = workloadMap.get(q.barber_id);
  current.count++;
  current.duration += q.total_duration || 30;
});
```

### Workload States

```
Light Workload:
├─ Count: 0-2 bookings
├─ Duration: 0-60 minutes
└─ Score: 0-0.9
   └─ Good capacity, customer gets quick service

Medium Workload:
├─ Count: 3-5 bookings
├─ Duration: 60-150 minutes
└─ Score: 1.0-2.0
   └─ Moderate queue, acceptable wait

Heavy Workload:
├─ Count: 6-10 bookings
├─ Duration: 150-300 minutes
└─ Score: 2.0-5.0
   └─ Busy, longer wait

Overloaded:
├─ Count: 10+ bookings
├─ Duration: 300+ minutes
└─ Score: 5.0+
   └─ Very busy, may need fallback
```

---

## Next Available Slot Calculation

### Function: `getNextAvailableSlot(barberId, salonId, bookingDate, totalDuration)`

**Purpose**: Calculate when barber will be free

**Algorithm**:
```
1. Fetch all barber's bookings for date
2. Sum their total durations
3. Calculate occupied time slots (30-min blocks)
4. Find first free slot
5. Add service duration to estimate completion
```

**Example**:
```
Barber Ali bookings on 2026-05-28:
├─ 10:00 AM: Haircut (30m)
├─ 10:30 AM: Beard (20m)
└─ 10:50 AM: Detan (20m)
Total occupied: 70 minutes

New booking (50m service):
├─ Current time: ~11:00 AM
├─ Available: Yes, at 11:00 AM
├─ Completion: 11:50 AM
└─ Displayed: "Available at 11:00 AM, done by 11:50 AM"
```

---

## Fallback Scenarios

### Scenario 1: No Barber Supports All Services

**Condition**: None of the barbers can perform all selected services

**Handling**:
```typescript
const unsupportedServices = serviceIds.filter(
  id => !supportedSet.has(id)
);

return {
  valid: false,
  reason: `Cannot perform: ${unsupportedServices.join(", ")}`,
  suggestions: getBarberSuggestions(...)
};
```

**User Experience**:
```
Message: "No barber available for all services"
Options:
  1. Remove incompatible services
  2. Book with partial match (see suggestions)
  3. Contact salon directly
```

### Scenario 2: All Barbers Offline

**Condition**: is_online = false for all barbers

**Handling**:
```typescript
if (allBarbers.every(b => !b.is_online)) {
  return null;  // No assignment possible
}

// User gets error message
```

**User Experience**:
```
Message: "No barbers online right now"
Options:
  1. Try booking for later
  2. Call salon directly
```

### Scenario 3: Queue Full

**Condition**: Salon has 50+ bookings for date

**Handling**:
```typescript
if (queueCount > 50) {
  // Allow booking but warn
  console.warn("Queue full - wait time may be very long");
}
```

**User Experience**:
```
Warning: "Queue is full, very long wait expected"
Options:
  1. Proceed anyway (long wait)
  2. Choose different date
```

### Scenario 4: Barber Becomes Unavailable

**Condition**: Selected barber goes offline during booking process

**Handling**:
```typescript
// Check again just before insert
const updatedBarber = await getBarber(selectedBarberId);
if (!updatedBarber.is_online) {
  // Reassign to best alternative
  return await assignBestBarber(...);
}
```

**User Experience**:
```
Notification: "Barber changed due to availability"
Reason: Transparency about reassignment
Details: New barber name and wait time shown
```

---

## Performance Optimizations

### Index Strategies

**Critical Indexes**:
```sql
-- For fetching active barbers
CREATE INDEX idx_barbers_salon_active 
ON barbers(salon_id, is_active);

-- For workload calculation
CREATE INDEX idx_queue_salon_barber_status 
ON queue(salon_id, barber_id, booking_date, status);

-- For service compatibility
CREATE INDEX idx_barber_services_barber_id 
ON barber_services(barber_id);
```

### Query Optimization

**N+1 Problem Prevention**:
```
Problem: Loop through barbers, query services for each
├─ Barber 1: SELECT services (1 query)
├─ Barber 2: SELECT services (1 query)
└─ Barber N: SELECT services (N queries)
Total: N+1 queries

Solution: Batch fetch
├─ Fetch all barber_services at once
├─ Build in-memory map: barber_id → [service_ids]
└─ Total: 2 queries
```

**Query Caching**:
```typescript
// Cache barber services for 5 minutes
const cache = new Map<string, Set<string>>();

async function getBarberServices(barberId) {
  if (cache.has(barberId)) {
    return cache.get(barberId);
  }
  
  const services = await query(...);
  cache.set(barberId, new Set(services));
  
  // Clear after 5 minutes
  setTimeout(() => cache.delete(barberId), 300000);
  
  return cache.get(barberId);
}
```

### Real-Time Updates

**Subscription Pattern**:
```typescript
// Subscribe to queue changes
supabase.channel('queue-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'queue'
  }, (payload) => {
    // Invalidate workload cache
    workloadCache.clear();
    // Trigger UI update
    onQueueChanged();
  })
  .subscribe();
```

---

## Configuration & Tuning

### Weight Adjustment

Current weights:
```
Queue Count: 0.5 (70% importance)
Duration: 0.3 (20% importance)  
Online Penalty: 1000 (10% importance)
```

To adjust fairness:
```typescript
// More queue-focused (default, fair distribution)
queueScore = activeQueueCount * 0.5;
durationScore = totalDuration / 30 * 0.3;

// More duration-focused (prefer empty barbers even if few bookings)
queueScore = activeQueueCount * 0.3;
durationScore = totalDuration / 30 * 0.5;

// More balanced
queueScore = activeQueueCount * 0.4;
durationScore = totalDuration / 30 * 0.4;
```

### Buffer Time

Current: 2-3 min per booking:
```typescript
const bufferMinutes = Math.min(queue.length * 2, 15);
```

To adjust:
```
Less buffer (faster): queue.length * 1, max 10
More buffer (safer): queue.length * 3, max 20
```

---

## Audit & Analytics

### Assignment Audit Trail

Every assignment logged:
```sql
INSERT INTO booking_assignments (
  booking_id,
  assigned_barber_id,
  assignment_reason,
  workload_score,
  completion_estimate,
  assigned_at
) VALUES (...)
```

### Analytics Queries

**Fair Distribution Check**:
```sql
SELECT 
  assigned_barber_id,
  COUNT(*) as assignments,
  AVG(workload_score) as avg_score
FROM booking_assignments
WHERE assigned_at > NOW() - INTERVAL '7 days'
GROUP BY assigned_barber_id
ORDER BY assignments DESC;

-- Result: Should be roughly equal
-- Example: 
--   Ali: 24 assignments, avg score 0.8
--   Bob: 23 assignments, avg score 0.9
--   Charlie: 25 assignments, avg score 0.7
```

**Wait Time Accuracy**:
```sql
SELECT 
  completion_estimate,
  EXTRACT(MINUTE FROM (completed_at - assigned_at)) as actual_wait,
  ABS(completion_estimate - EXTRACT(MINUTE FROM (completed_at - assigned_at))) as error
FROM booking_assignments
WHERE completed_at IS NOT NULL
ORDER BY assigned_at DESC
LIMIT 100;

-- Calculate average error
-- Goal: < 5 minutes error
```

---

## Testing Checklist

- [ ] Single service assignment works
- [ ] Multi-service assignment works
- [ ] Service compatibility checked
- [ ] Workload balanced across barbers
- [ ] Online barbers preferred
- [ ] Fallback suggestions work
- [ ] No race conditions
- [ ] Performance <200ms
- [ ] Real-time updates accurate
- [ ] Edge cases handled

---

## Troubleshooting

### Issue: Same barber assigned every time

**Cause**: Workload not updating correctly

**Fix**:
```sql
-- Check queue data
SELECT barber_id, COUNT(*) as booking_count
FROM queue
WHERE salon_id = ?
  AND booking_date = CURRENT_DATE
  AND status IN ('waiting', 'confirmed', 'in_progress')
GROUP BY barber_id;

-- Verify total_duration populated
SELECT barber_id, SUM(total_duration)
FROM queue
WHERE barber_id = ?
GROUP BY barber_id;
```

### Issue: Wrong barber assigned

**Cause**: Service compatibility data missing

**Fix**:
```sql
-- Check barber_services mapping
SELECT * FROM barber_services WHERE barber_id = ?;

-- If empty, add services
INSERT INTO barber_services (barber_id, service_id)
VALUES (?, ?);
```

### Issue: Very long wait times calculated

**Cause**: Old bookings in queue with zero duration

**Fix**:
```sql
-- Update missing durations
UPDATE queue
SET total_duration = (SELECT duration FROM services WHERE id = service_id)
WHERE total_duration IS NULL OR total_duration = 0;
```

---

## Future Enhancements

### Phase 2: Specialization Levels
```sql
ALTER TABLE barber_services 
ADD COLUMN specialization_level INT DEFAULT 1;
-- 1=basic, 2=intermediate, 3=expert

-- Prefer expert for complex services
score *= (3 / specialization_level);
```

### Phase 3: Customer Preferences
```
Remember: "Customer prefers Ali"
Future bookings: Prioritize Ali unless too busy
```

### Phase 4: Dynamic Pricing
```
Peak barber: Higher price (premium service)
Free barber: Lower price (inducement)
```

---

## References

- [bookingEngine.ts](./src/services/bookingEngine.ts) - Implementation
- [SMART_BOOKING_ENGINE_REPORT.md](./SMART_BOOKING_ENGINE_REPORT.md) - Full guide
- Database schema: `20260527000100_multi_service_booking_engine.sql`

---

**Document Version**: 1.0  
**Last Updated**: May 27, 2026  
**Status**: Production Ready
