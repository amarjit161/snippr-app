import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type HolidayType = "national" | "festival" | "custom";

type Holiday = {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  note?: string | null;
};

type HolidayCalendarProps = {
  salonId: string;
};

const typeBadgeClass: Record<HolidayType, string> = {
  national: "bg-indigo-100 text-indigo-700",
  festival: "bg-amber-100 text-amber-700",
  custom: "bg-slate-100 text-slate-700",
};

const nationalSuggestions = (year: number) => [
  {
    date: `${year}-01-26`,
    name: "Republic Day",
    type: "national" as HolidayType,
    note: "Closed for Republic Day",
  },
  {
    date: `${year}-08-15`,
    name: "Independence Day",
    type: "national" as HolidayType,
    note: "Closed for Independence Day",
  },
  {
    date: `${year}-10-02`,
    name: "Gandhi Jayanti",
    type: "national" as HolidayType,
    note: "Closed for Gandhi Jayanti",
  },
];

const toMonthLabel = (date: Date) =>
  date.toLocaleString("en-IN", { month: "long", year: "numeric" });

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const dateToISO = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function HolidayCalendar({ salonId }: HolidayCalendarProps) {
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<HolidayType>("custom");
  const [note, setNote] = useState("");

  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);

  const fetchHolidays = async () => {
    if (!salonId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("salon_holidays" as any)
        .select("id, date, name, type, note")
        .eq("salon_id", salonId)
        .gte("date", dateToISO(new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)))
        .lte("date", dateToISO(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 31)))
        .order("date", { ascending: true });

      if (error) throw error;
      setHolidays((data || []) as Holiday[]);
    } catch (error: any) {
      toast.error(error.message || "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [salonId, monthCursor]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    holidays.forEach((h) => map.set(h.date, h));
    return map;
  }, [holidays]);

  const monthCells = useMemo(() => {
    const firstWeekDay = monthStart.getDay();
    const totalDays = monthEnd.getDate();
    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];

    for (let i = 0; i < firstWeekDay; i += 1) {
      cells.push({ iso: "", day: 0, inMonth: false });
    }

    for (let d = 1; d <= totalDays; d += 1) {
      const current = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
      cells.push({ iso: dateToISO(current), day: d, inMonth: true });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ iso: "", day: 0, inMonth: false });
    }

    return cells;
  }, [monthStart, monthEnd]);

  const handleAddHoliday = async () => {
    if (!date || !name.trim()) {
      toast.error("Date and holiday name are required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("salon_holidays" as any).upsert({
        salon_id: salonId,
        date,
        name: name.trim(),
        type,
        note: note.trim() || null,
      });

      if (error) throw error;

      toast.success("Holiday saved");
      setOpenAdd(false);
      setDate("");
      setName("");
      setType("custom");
      setNote("");
      fetchHolidays();
    } catch (error: any) {
      toast.error(error.message || "Failed to save holiday");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase.from("salon_holidays" as any).delete().eq("id", id);
      if (error) throw error;
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      toast.success("Holiday removed");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove holiday");
    }
  };

  const applySuggestion = async (suggestion: {
    date: string;
    name: string;
    type: HolidayType;
    note: string;
  }) => {
    try {
      const { error } = await supabase.from("salon_holidays" as any).upsert({
        salon_id: salonId,
        ...suggestion,
      });
      if (error) throw error;
      toast.success(`${suggestion.name} added`);
      fetchHolidays();
    } catch (error: any) {
      toast.error(error.message || "Failed to add suggestion");
    }
  };

  return (
    <Card className="rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <CalendarDays className="h-5 w-5 text-purple-600" /> Holiday Calendar
          </CardTitle>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-9 px-4">
                <Plus className="h-4 w-4 mr-1" /> Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Holiday</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Input
                  placeholder="Holiday name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as HolidayType)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="custom">Custom</option>
                  <option value="festival">Festival</option>
                  <option value="national">National</option>
                </select>
                <Input
                  placeholder="Optional note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button className="w-full" disabled={saving} onClick={handleAddHoliday}>
                  {saving ? "Saving..." : "Save Holiday"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-[#eeedf0] p-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="font-semibold">{toMonthLabel(monthCursor)}</p>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#6b6474]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {monthCells.map((cell, idx) => {
            const holiday = cell.iso ? holidayMap.get(cell.iso) : undefined;
            const holidayClass = holiday
              ? holiday.type === "national"
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : holiday.type === "festival"
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              : "bg-white border-[#eeedf0]";

            return (
              <div
                key={`${cell.iso}-${idx}`}
                className={`h-16 rounded-lg border p-2 text-xs ${
                  cell.inMonth ? holidayClass : "bg-[#f8f7fa] border-transparent"
                }`}
              >
                {cell.inMonth ? (
                  <>
                    <p className="font-semibold">{cell.day}</p>
                    {holiday ? (
                      <p className="mt-1 line-clamp-2 text-[10px] font-medium">{holiday.name}</p>
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-[#494551]">Quick National/Festival Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {nationalSuggestions(monthCursor.getFullYear()).map((item) => (
              <Button
                key={item.date}
                variant="outline"
                className="rounded-full text-xs"
                onClick={() => applySuggestion(item)}
              >
                Add {item.name}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-[#494551]">Holiday List</p>
          {loading ? (
            <p className="text-sm text-[#6b6474]">Loading holidays...</p>
          ) : holidays.length === 0 ? (
            <p className="text-sm text-[#6b6474]">No holidays for this month.</p>
          ) : (
            <div className="space-y-2">
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border border-[#eeedf0] p-3">
                  <div>
                    <p className="text-sm font-semibold">{h.name}</p>
                    <p className="text-xs text-[#6b6474]">{h.date}</p>
                    {h.note ? <p className="text-xs text-[#6b6474]">{h.note}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${typeBadgeClass[h.type]}`}>
                      {h.type}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteHoliday(h.id)}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
