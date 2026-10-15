import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { formatFullName, splitFullName } from "@/lib/fullName";
import BookingConfirmPage from "@/pages/booking/BookingConfirmPage";

type Customer = { firstName: string; lastName: string; phone: string; altPhone: string; notes: string };

// Latest customer state written by the page, so tests can assert what the
// booking context would receive (and later validate / submit).
let latestCustomer: Customer;
let setCustomerFromOutside: (next: Customer) => void;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) } },
}));

vi.mock("@/components/booking/BookingPageShell", () => ({
  BookingPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/BookingDraftContext", () => ({
  // Minimal stateful stand-in for the real provider: the page only needs the
  // customer state plus a valid date/time/service so it renders the form.
  useBookingDraft: () => {
    const [customer, setCustomer] = useState<Customer>({ firstName: "", lastName: "", phone: "", altPhone: "", notes: "" });
    latestCustomer = customer;
    setCustomerFromOutside = setCustomer;
    return {
      customer,
      setCustomer,
      activeCustomer: customer,
      hasSavedProfile: false,
      savedProfile: customer,
      bookingForSomeoneElse: false,
      setBookingForSomeoneElse: vi.fn(),
      saveProfile: vi.fn(),
      confirmedBookingState: null,
      loadingSalon: false,
      exitFlow: vi.fn(),
      selectedServices: [{ id: "svc-1" }],
      date: "2026-10-20",
      time: "10:00",
      salon: null,
    };
  },
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <BookingConfirmPage />
    </MemoryRouter>,
  );

/** Types like a keyboard: one change event per character, appending to the current value. */
const typeInto = (input: HTMLInputElement, text: string) => {
  for (const ch of text) {
    fireEvent.change(input, { target: { value: input.value + ch } });
  }
};

const nameInput = () => screen.getByLabelText(/full name/i) as HTMLInputElement;

describe("splitFullName / formatFullName", () => {
  it("splits on the first run of whitespace and trims the ends", () => {
    expect(splitFullName("Amarjit Sharma")).toEqual({ firstName: "Amarjit", lastName: "Sharma" });
    expect(splitFullName("  Amarjit   Kumar  Sharma  ")).toEqual({ firstName: "Amarjit", lastName: "Kumar Sharma" });
    expect(splitFullName("sam")).toEqual({ firstName: "sam", lastName: "" });
    expect(splitFullName("sam ")).toEqual({ firstName: "sam", lastName: "" });
    expect(splitFullName("   ")).toEqual({ firstName: "", lastName: "" });
  });

  it("formats stored names back into one display string", () => {
    expect(formatFullName("Amarjit", "Sharma")).toBe("Amarjit Sharma");
    expect(formatFullName("sam", "")).toBe("sam");
    expect(formatFullName("", "")).toBe("");
  });
});

describe("Booking confirm — full name input", () => {
  beforeEach(() => {
    latestCustomer = { firstName: "", lastName: "", phone: "", altPhone: "", notes: "" };
  });

  it("keeps the space while typing a two-word name", () => {
    renderPage();
    typeInto(nameInput(), "Amarjit ");
    expect(nameInput().value).toBe("Amarjit ");
    typeInto(nameInput(), "Sharma");
    expect(nameInput().value).toBe("Amarjit Sharma");
    expect(latestCustomer).toMatchObject({ firstName: "Amarjit", lastName: "Sharma" });
  });

  it("accepts a name with multiple words and extra spaces", () => {
    renderPage();
    typeInto(nameInput(), "Amarjit  Kumar Sharma");
    expect(nameInput().value).toBe("Amarjit  Kumar Sharma");
    expect(latestCustomer).toMatchObject({ firstName: "Amarjit", lastName: "Kumar Sharma" });
  });

  it("trims leading/trailing whitespace for the stored names only", () => {
    renderPage();
    typeInto(nameInput(), "  Amarjit Sharma  ");
    expect(nameInput().value).toBe("  Amarjit Sharma  ");
    expect(latestCustomer).toMatchObject({ firstName: "Amarjit", lastName: "Sharma" });
  });

  it("still requires a last name for a one-word name", () => {
    renderPage();
    typeInto(nameInput(), "sam");
    fireEvent.blur(nameInput());
    expect(latestCustomer).toMatchObject({ firstName: "sam", lastName: "" });
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
  });

  it("clears the last-name error once a last name is typed", () => {
    renderPage();
    typeInto(nameInput(), "sam");
    fireEvent.blur(nameInput());
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    typeInto(nameInput(), " Lee");
    expect(screen.queryByText("Last name is required")).not.toBeInTheDocument();
  });

  it("shows names set outside the field (e.g. restored or saved profile)", () => {
    renderPage();
    act(() => setCustomerFromOutside({ ...latestCustomer, firstName: "Priya", lastName: "Nair" }));
    expect(nameInput().value).toBe("Priya Nair");
    typeInto(nameInput(), " K");
    expect(nameInput().value).toBe("Priya Nair K");
    expect(latestCustomer).toMatchObject({ firstName: "Priya", lastName: "Nair K" });
  });

  it("requires a first name when the field is left empty", () => {
    renderPage();
    fireEvent.blur(nameInput());
    expect(screen.getByText("First name is required")).toBeInTheDocument();
  });
});
