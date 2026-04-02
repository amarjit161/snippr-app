import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ServiceRow = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

type BarberRow = {
  id: string;
  name: string;
  chair_number: number | null;
};

type AddWalkInModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ServiceRow[];
  barbers: BarberRow[];
  onSubmit: (payload: { customerName: string; phoneNumber: string; serviceId: string; barberId: string }) => Promise<void>;
};

export function AddWalkInModal({ open, onOpenChange, services, barbers, onSubmit }: AddWalkInModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [barberId, setBarberId] = useState("");

  useEffect(() => {
    if (!open) {
      setCustomerName("");
      setPhoneNumber("");
      setServiceId("");
      setBarberId("");
      setSubmitting(false);
      return;
    }

    if (services.length > 0 && !serviceId) setServiceId(services[0].id);
    if (barbers.length > 0 && !barberId) setBarberId(barbers[0].id);
  }, [open, services, barbers]);

  const isValid = useMemo(() => {
    return customerName.trim().length > 1 && phoneNumber.trim().length >= 8 && !!serviceId && !!barberId;
  }, [customerName, phoneNumber, serviceId, barberId]);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    await onSubmit({
      customerName: customerName.trim(),
      phoneNumber: phoneNumber.trim(),
      serviceId,
      barberId,
    });
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl border border-[#e3e2e5] bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold tracking-tight">Add New Walk-in</DialogTitle>
          <DialogDescription>Add a walk-in customer directly to the live queue.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <Input placeholder="Customer Name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          <Input placeholder="Phone Number" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />

          <select
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background/90 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {services.length === 0 ? <option value="">No active services</option> : null}
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} • INR {service.price}
              </option>
            ))}
          </select>

          <select
            value={barberId}
            onChange={(event) => setBarberId(event.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background/90 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {barbers.length === 0 ? <option value="">No barbers available</option> : null}
            {barbers.map((barber) => (
              <option key={barber.id} value={barber.id}>
                {barber.name} {barber.chair_number ? `(Chair ${barber.chair_number})` : ""}
              </option>
            ))}
          </select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-xl" disabled={!isValid || submitting || services.length === 0} onClick={handleSubmit}>
            {submitting ? "Adding..." : "Add to Queue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
