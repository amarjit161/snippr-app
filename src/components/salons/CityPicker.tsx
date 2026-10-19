/**
 * "Change city" dialog for /salons: a searchable list of real cities. Cities that
 * have salons show their real count; the other well-known cities are offered
 * with an honest "No salons yet". Built on the app's Radix Dialog (focus trap,
 * Escape, focus return to the trigger).
 */
import { useState, type RefObject } from "react";
import { Check, LocateFixed, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { POPULAR_CITIES, normalizeCity } from "@/lib/cityLocation";

interface CityPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cities that have salons, with real counts (null while salons are loading or failed). */
  cityCounts: { name: string; count: number }[] | null;
  /** Salons with no recognisable city (state name, placeholder or blank); null while unknown. */
  unlistedCount?: number | null;
  /** Further real city names offered when searching (no salons claimed). */
  otherCities: readonly string[];
  /** The city currently filtering the list, if any. */
  selectedCity: string | null;
  onSelectCity: (city: string | null) => void;
  /** "Detect my city", or null when detection is unavailable (e.g. permission blocked). */
  onDetect: (() => void) | null;
  detectNote?: string | null;
  /** Where focus goes when the dialog closes (it is opened from state, not a DialogTrigger). */
  returnFocusTo?: RefObject<HTMLElement>;
}

const eyebrow = "font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";

export function CityPicker({
  open,
  onOpenChange,
  cityCounts,
  unlistedCount = null,
  otherCities,
  selectedCity,
  onSelectCity,
  onDetect,
  detectNote,
  returnFocusTo,
}: CityPickerProps) {
  const [query, setQuery] = useState("");
  const q = normalizeCity(query);
  const matches = (name: string) => !q || name.toLowerCase().includes(query.trim().toLowerCase()) || normalizeCity(name).includes(q);

  const groups = (() => {
    const withSalons = (cityCounts ?? []).filter((c) => matches(c.name));
    const listed = new Set((cityCounts ?? []).map((c) => normalizeCity(c.name)));
    const popular = POPULAR_CITIES.filter((name) => !listed.has(normalizeCity(name)) && matches(name));
    const shown = new Set([...listed, ...popular.map(normalizeCity)]);
    const others = q
      ? otherCities.filter((name) => !shown.has(normalizeCity(name)) && matches(name)).slice(0, 8)
      : [];
    return { withSalons, popular, others };
  })();

  const choose = (city: string | null) => {
    onSelectCity(city);
    setQuery("");
    onOpenChange(false);
  };

  const selectedKey = normalizeCity(selectedCity);
  // While salons are loading (or failed) we can't say whether a city has salons.
  const knowsCounts = cityCounts !== null;

  const row = (name: string, meta: string | null) => {
    const active = selectedKey !== "" && normalizeCity(name) === selectedKey;
    return (
      <li key={name}>
        <button
          type="button"
          onClick={() => choose(name)}
          aria-current={active ? "true" : undefined}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
        >
          <span className="flex items-center gap-2 font-medium text-foreground">
            {name}
            {active ? <Check className="h-4 w-4 text-primary" aria-label="Selected" /> : null}
          </span>
          {meta ? <span className="shrink-0 font-mono text-xs text-muted-foreground">{meta}</span> : null}
        </button>
      </li>
    );
  };

  const nothing = groups.withSalons.length + groups.popular.length + groups.others.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="top-[12%] max-w-md translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:top-[15%]"
        onCloseAutoFocus={(event) => {
          if (!returnFocusTo?.current) return;
          event.preventDefault();
          returnFocusTo.current.focus();
        }}
      >
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="font-display text-lg font-semibold tracking-[-0.01em]">Choose your city</DialogTitle>
          <DialogDescription className="mt-1 text-sm">Salons are filtered to the city you pick.</DialogDescription>

          {onDetect ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                onOpenChange(false);
                onDetect();
              }}
              className="mt-4 flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <LocateFixed className="h-4 w-4" aria-hidden="true" />
              Detect my city
            </button>
          ) : detectNote ? (
            <p className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">{detectNote}</p>
          ) : null}

          <div className="mt-3 flex items-center rounded-lg border border-border bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cities"
              aria-label="Search cities"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-2 py-3">
          {selectedCity ? (
            <button
              type="button"
              onClick={() => choose(null)}
              className="mb-2 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Show salons in all cities
            </button>
          ) : null}

          {groups.withSalons.length > 0 ? (
            <section aria-label="Cities with salons" className="mb-3">
              <h3 className={`px-3 pb-1 ${eyebrow}`}>Cities with salons</h3>
              <ul>{groups.withSalons.map((c) => row(c.name, `${c.count} ${c.count === 1 ? "salon" : "salons"}`))}</ul>
            </section>
          ) : null}

          {groups.popular.length > 0 ? (
            <section aria-label="Popular cities" className="mb-3">
              <h3 className={`px-3 pb-1 ${eyebrow}`}>Popular cities</h3>
              <ul>{groups.popular.map((name) => row(name, knowsCounts ? "No salons yet" : null))}</ul>
            </section>
          ) : null}

          {groups.others.length > 0 ? (
            <section aria-label="More cities">
              <h3 className={`px-3 pb-1 ${eyebrow}`}>More cities</h3>
              <ul>{groups.others.map((name) => row(name, knowsCounts ? "No salons yet" : null))}</ul>
            </section>
          ) : null}

          {nothing ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matching city.</p> : null}

          {unlistedCount ? (
            <div className="mx-3 mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {unlistedCount === 1 ? "1 salon doesn't" : `${unlistedCount} salons don't`} have a city listed yet — shown
                when you browse all cities.
              </p>
              {selectedCity ? (
                <button
                  type="button"
                  onClick={() => choose(null)}
                  className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Show all cities
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
