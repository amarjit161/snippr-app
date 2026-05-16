import { publicSupabase } from "@/integrations/supabase/publicClient";

export const runbookService = {
  async getByKey(runbookKey: string) {
    const { data, error } = await publicSupabase
      .from("operational_runbooks")
      .select("runbook_key,title,severity,checklist,automation_hints")
      .eq("runbook_key", runbookKey)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async list(limit = 50) {
    const { data, error } = await publicSupabase
      .from("operational_runbooks")
      .select("runbook_key,title,severity,checklist,automation_hints")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};

export default runbookService;
