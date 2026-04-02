import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddWalkInModal } from "@/components/queue/AddWalkInModal";
import { useQueue } from "@/hooks/useQueue";

const formatStatus = (value: string) => value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

export default function Queue() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const { loading, actionLoading, owner, salon, services, barbers, grouped, addWalkIn, updateStatus, updateBarber } = useQueue(navigate);

  const sections = useMemo(
    () => [
      { key: "waiting", title: "Waiting", items: grouped.waiting },
      { key: "in_progress", title: "In Progress", items: grouped.inProgress },
      { key: "completed", title: "Completed", items: grouped.completed },
    ],
    [grouped.completed, grouped.inProgress, grouped.waiting]
  );

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
            <Button className="rounded-xl" onClick={() => setModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add New Walk-in
            </Button>
          </div>
        </section>

        <Card className="rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
          <CardContent className="p-6">
            {services.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e3e2e5] p-8 text-center text-sm text-[#494551]">No active services.</div>
            ) : sections.every((section) => section.items.length === 0) ? (
              <div className="rounded-xl border border-dashed border-[#e3e2e5] p-8 text-center text-sm text-[#494551]">No customers in queue.</div>
            ) : (
              <div className="space-y-8">
                {sections.map((section) => (
                  <div key={section.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-xl font-bold">{section.title}</h2>
                      <Badge variant="outline" className="rounded-full">{section.items.length}</Badge>
                    </div>

                    {section.items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#e3e2e5] p-5 text-center text-sm text-[#494551]">No data yet.</div>
                    ) : (
                      section.items.map((item) => {
                        const customerLabel = item.customer_name || (item.user_id ? `User ${item.user_id.slice(0, 6)}` : "Walk-in Customer");
                        return (
                          <div key={item.id} className="rounded-xl border border-[#e3e2e5] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold">{customerLabel}</p>
                                <p className="text-sm text-[#494551]">{item.services?.name || "Service"} • {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                              <Badge variant="outline" className="rounded-full capitalize">{formatStatus(item.status)}</Badge>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                              <select
                                value={item.barber_id || ""}
                                onChange={(event) => updateBarber(item.id, event.target.value || null)}
                                className="h-10 w-full rounded-xl border border-input bg-background/90 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                                disabled={item.status === "completed" || item.status === "cancelled"}
                              >
                                <option value="">Unassigned barber</option>
                                {barbers.map((barber) => (
                                  <option key={barber.id} value={barber.id}>
                                    {barber.name} {barber.chair_number ? `(Chair ${barber.chair_number})` : ""}
                                  </option>
                                ))}
                              </select>

                              <div className="flex flex-wrap gap-2">
                                {item.status === "waiting" ? (
                                  <>
                                    <Button
                                      size="sm"
                                      className="rounded-xl"
                                      disabled={actionLoading === item.id}
                                      onClick={() => updateStatus(item.id, "in_progress")}
                                    >
                                      {actionLoading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl"
                                      disabled={actionLoading === item.id}
                                      onClick={() => updateStatus(item.id, "cancelled")}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                ) : null}

                                {item.status === "in_progress" ? (
                                  <Button
                                    size="sm"
                                    className="rounded-xl"
                                    disabled={actionLoading === item.id}
                                    onClick={() => updateStatus(item.id, "completed")}
                                  >
                                    {actionLoading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete"}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
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
                        <p className="font-semibold">{item.customer_name || (item.user_id ? `User ${item.user_id.slice(0, 6)}` : "Walk-in Customer")}</p>
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
