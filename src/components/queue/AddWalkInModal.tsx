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

type AccountType = "guest" | "existing";

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AddWalkInModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ServiceRow[];
  barbers: BarberRow[];
  // Returns whether a booking was actually created — false for a failed
  // "existing customer" lookup (no match), so the modal can stay open
  // instead of silently closing over a booking that was never made.
  onSubmit: (payload: {
    customerFirstName: string;
    customerLastName: string;
    phoneNumber: string;
    serviceId: string;
    barberId: string;
    customerMode: AccountType;
    email?: string;
  }) => Promise<boolean>;
};

export function AddWalkInModal({ open, onOpenChange, services, barbers, onSubmit }: AddWalkInModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [barberId, setBarberId] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("guest");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!open) {
      setCustomerFirstName("");
      setCustomerLastName("");
      setPhoneNumber("");
      setServiceId("");
      setBarberId("");
      setAccountType("guest");
      setEmail("");
      setSubmitting(false);
      return;
    }

    if (services.length > 0 && !serviceId) setServiceId(services[0].id);
    if (barbers.length > 0 && !barberId) setBarberId(barbers[0].id);
  }, [open, services, barbers]);

  const isEmailValid = EMAIL_FORMAT.test(email.trim());

  const isValid = useMemo(() => {
    const baseValid = customerFirstName.trim().length > 1 && customerLastName.trim().length > 1 && phoneNumber.trim().length >= 8 && !!serviceId && !!barberId;
    if (!baseValid) return false;
    return accountType === "guest" || isEmailValid;
  }, [customerFirstName, customerLastName, phoneNumber, serviceId, barberId, accountType, isEmailValid]);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    const created = await onSubmit({
      customerFirstName: customerFirstName.trim(),
      customerLastName: customerLastName.trim(),
      phoneNumber: phoneNumber.trim(),
      serviceId,
      barberId,
      customerMode: accountType,
      email: accountType === "existing" ? email.trim() : undefined,
    });
    setSubmitting(false);
    // Only close on an actual booking — e.g. an "existing customer" lookup
    // that found no match creates nothing, so the owner stays here to fix
    // the email or switch to Guest / walk-in.
    if (created) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl border border-[#e3e2e5] bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold tracking-tight">Add New Walk-in</DialogTitle>
          <DialogDescription>Add a walk-in customer directly to the live queue.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <Input placeholder="First Name" value={customerFirstName} onChange={(event) => setCustomerFirstName(event.target.value)} />
          <Input placeholder="Last Name" value={customerLastName} onChange={(event) => setCustomerLastName(event.target.value)} />
          <Input placeholder="Phone Number" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-foreground">Customer account</legend>
            <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-input px-3 text-sm">
              <input
                type="radio"
                name="walk-in-account-type"
                checked={accountType === "existing"}
                onChange={() => setAccountType("existing")}
              />
              Existing Snippr customer
            </label>
            <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-input px-3 text-sm">
              <input
                type="radio"
                name="walk-in-account-type"
                checked={accountType === "guest"}
                onChange={() => setAccountType("guest")}
              />
              Guest / walk-in
            </label>
          </fieldset>

          {accountType === "existing" ? (
            <div>
              <Input
                type="email"
                placeholder="Customer's email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={email.length > 0 && !isEmailValid}
              />
              {email.length > 0 && !isEmailValid ? (
                <p className="mt-1 text-xs text-destructive">Enter a valid email address.</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  We'll check if this email has a Snippr account and link the booking to it. If no account is found, the booking will not be created — switch to Guest / walk-in instead.
                </p>
              )}
            </div>
          ) : null}

          <select
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background/90 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {services.length === 0 ? <option value="">No active services</option> : null}
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service?.name ?? "Service"} • INR {service?.price ?? 0}
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
                {barber?.name ?? "Barber"} {barber?.chair_number ? `(Chair ${barber.chair_number})` : ""}
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

