import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddWalkInModal } from "@/components/queue/AddWalkInModal";
import { useQueue } from "@/hooks/useQueue";

const formatStatus = (value: string) => value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
const todayISO = () => new Date().toISOString().split("T")[0];
const tomorrowISO = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
};
const getQueueDate = (item: any) => item.booking_date || item.created_at.slice(0, 10);

type QueueDatePreset = "today" | "tomorrow" | "custom";

export default function Queue() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [queueDatePreset, setQueueDatePreset] = useState<QueueDatePreset>("today");
  const [customQueueDate, setCustomQueueDate] = useState(todayISO());
  const [now, setNow] = useState(Date.now());
  const { loading, actionLoading, owner, salon, services, barbers, grouped, pendingAccepts, startAccept, undoAccept, addWalkIn, updateStatus, updateBarber } = useQueue(navigate);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  console.log("QUEUE_COMPONENT_RENDER", { waiting: grouped.waiting.length, inProgress: grouped.inProgress.length, completed: grouped.completed.length, cancelled: grouped.cancelled.length });

  const sections = useMemo(
    () => [
      { key: "waiting", title: "Waiting", items: grouped.waiting },
      { key: "in_progress", title: "In Progress", items: grouped.inProgress },
      { key: "completed", title: "Completed", items: grouped.completed },
    ],
    [grouped.completed, grouped.inProgress, grouped.waiting]
  );

  const selectedQueueDate = useMemo(() => {
    if (queueDatePreset === "today") return todayISO();
    if (queueDatePreset === "tomorrow") return tomorrowISO();
    return customQueueDate || todayISO();
  }, [customQueueDate, queueDatePreset]);

  const isTodayActionDate = selectedQueueDate === todayISO();

  const filteredSections = useMemo(
    () => sections.map((section) => ({
      ...section,
      items: section.items.filter((item) => getQueueDate(item) === selectedQueueDate),
    })),
    [sections, selectedQueueDate]
  );

  const totalFiltered = filteredSections.reduce((sum, section) => sum + section.items.length, 0);
  const canAcceptSelectedDate = selectedQueueDate === todayISO();

  if (loading) return <div className="mx-auto h-72 max-w-4xl rounded-xl bg-gray-200/70 animate-pulse" />;
  if (!owner || !salon) return null;

  return (
    <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-xl border border-[#e3e2e5] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight">Live Queue</h1>
              <p className="mt-1 text-sm text-[#494551]">Manage active and pending queue entries.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={queueDatePreset}
                onChange={(event) => setQueueDatePreset(event.target.value as QueueDatePreset)}
                className="h-11 rounded-xl border border-[#e3e2e5] bg-white px-4 text-sm font-semibold outline-none"
              >
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="custom">Pick date</option>
              </select>
              {queueDatePreset === "custom" ? (
                <input
                  type="date"
                  value={customQueueDate}
                  onChange={(event) => setCustomQueueDate(event.target.value)}
                  className="h-11 rounded-xl border border-[#e3e2e5] bg-white px-4 text-sm font-semibold outline-none"
                />
              ) : null}
              <Button className="rounded-xl" onClick={() => setModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add New Walk-in
              </Button>
            </div>
          </div>
        </section>

        <Card className="rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ece9f2] bg-[#faf8ff] px-4 py-3 text-sm">
              <p className="text-[#5b5566]">
                Showing queue for <span className="font-semibold text-[#1f2023]">{selectedQueueDate}</span>
              </p>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#4c4659]">{totalFiltered} items</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isTodayActionDate ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {isTodayActionDate ? "Actions enabled" : "View only"}
                </span>
              </div>
            </div>

            {services.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e3e2e5] p-8 text-center text-sm text-[#494551]">No active services.</div>
            ) : filteredSections.every((section) => section.items.length === 0) ? (
              <div className="rounded-xl border border-dashed border-[#e3e2e5] p-8 text-center text-sm text-[#494551]">
                No customers in queue for {queueDatePreset === "today" ? "today" : queueDatePreset === "tomorrow" ? "tomorrow" : selectedQueueDate}.
              </div>
            ) : (
              <div className="space-y-8">
                {filteredSections.map((section) => (
                  <div key={section.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-xl font-bold">{section.title}</h2>
                      <Badge variant="outline" className="rounded-full">{section.items.length}</Badge>
                    </div>

                    {section.items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#e3e2e5] p-5 text-center text-sm text-[#494551]">No data yet.</div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-[#ece9f2]">
                        <div className="grid grid-cols-[1.5fr_1.2fr_0.9fr_1fr] gap-3 border-b border-[#f0edf5] bg-[#faf8ff] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6e6879]">
                          <div>Customer</div>
                          <div>Barber</div>
                          <div>Status</div>
                          <div className="text-right">Actions</div>
                        </div>
                        {section.items.map((item) => {
                        const customerLabel = item.customer_first_name && item.customer_last_name 
                          ? `${item.customer_first_name} ${item.customer_last_name}` 
                          : (item.customer_phone ? item.customer_phone : "Walk-in Customer");
                        const isPendingAccept = !!pendingAccepts[item.id];
                        const remainingMs = pendingAccepts[item.id] ? Math.max(0, pendingAccepts[item.id] - now) : 0;
                        const remainingSeconds = Math.ceil(remainingMs / 1000);
                        const progressPercent = pendingAccepts[item.id] ? (remainingMs / 15000) * 100 : 0;
                        const canOperateThisItem = isTodayActionDate && getQueueDate(item) === todayISO();
                        return (
                          <div key={item.id} className="border-b border-[#f5f2f8] px-4 py-3 last:border-b-0">
                            <div className="grid grid-cols-[1.5fr_1.2fr_0.9fr_1fr] items-center gap-3">
                              <div>
                                <p className="font-semibold text-[#1f2023]">{customerLabel}</p>
                                <p className="text-sm text-[#625d6f]">{item.services?.name || "Service"} • {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                              </div>

                              <select
                                value={item.barber_id || ""}
                                onChange={(event) => updateBarber(item.id, event.target.value || null)}
                                className="h-10 w-full rounded-xl border border-input bg-background/90 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                disabled={!canOperateThisItem || item.status === "completed" || item.status === "cancelled" || item.status === "rejected"}
                              >
                                <option value="">Unassigned barber</option>
                                {barbers.map((barber) => (
                                  <option key={barber.id} value={barber.id}>
                                    {barber.name} {barber.chair_number ? `(Chair ${barber.chair_number})` : ""}
                                  </option>
                                ))}
                              </select>

                              <div>
                                <Badge variant="outline" className="rounded-full capitalize">{formatStatus(item.status)}</Badge>
                              </div>

                              <div className="flex flex-wrap justify-end gap-2">
                                {item.status === "waiting" ? (
                                  <>
                                    {canOperateThisItem ? (
                                      <Button
                                        size="sm"
                                        className="rounded-xl"
                                        disabled={actionLoading === item.id}
                                        onClick={() => startAccept(item.id)}
                                      >
                                        {actionLoading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept"}
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl"
                                      disabled={actionLoading === item.id || !canOperateThisItem}
                                      onClick={() => updateStatus(item.id, "cancelled")}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                ) : null}

                                {isPendingAccept ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50"
                                    disabled={actionLoading === item.id}
                                    onClick={() => undoAccept(item.id)}
                                  >
                                    Undo {remainingSeconds}s
                                  </Button>
                                ) : null}

                                {(item.status === "in_progress" || item.status === "accepted") && !isPendingAccept ? (
                                  <Button
                                    size="sm"
                                    className="rounded-xl"
                                    disabled={actionLoading === item.id || !canOperateThisItem}
                                    onClick={() => updateStatus(item.id, "completed")}
                                  >
                                    {actionLoading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete"}
                                  </Button>
                                ) : null}

                                {!canOperateThisItem ? (
                                  <span className="self-center text-xs font-medium text-[#7a7388]">View only</span>
                                ) : null}
                              </div>
                            </div>

                            {isPendingAccept ? (
                              <div className="mt-3 space-y-1">
                                <div className="h-1 overflow-hidden rounded-full bg-amber-100">
                                  <div
                                    className="h-full rounded-full bg-amber-500 transition-all duration-200"
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                                <p className="text-[11px] text-amber-700">Accepting in {remainingSeconds}s. Undo if this was a mistake.</p>
                              </div>
                            ) : null}
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {grouped.cancelled.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-xl font-bold">Cancelled</h2>
                      <Badge variant="outline" className="rounded-full">{grouped.cancelled.length}</Badge>
                    </div>
                    {grouped.cancelled.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[#e3e2e5] p-4">
                        <p className="font-semibold">{item.customer_first_name && item.customer_last_name ? `${item.customer_first_name} ${item.customer_last_name}` : (item.customer_phone ? item.customer_phone : "Walk-in Customer")}</p>
                        <p className="text-sm text-[#494551]">{item.services?.name || "Service"}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <AddWalkInModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          services={services}
          barbers={barbers}
          onSubmit={addWalkIn}
        />
      </div>
    </OwnerShell>
  );
}

