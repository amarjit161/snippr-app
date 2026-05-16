import React, { useEffect, useState } from 'react';
import { publicSupabase } from '@/integrations/supabase/publicClient';

export default function QueueAnalytics() {
  const [counts, setCounts] = useState<any>(null);

  useEffect(() => {
    (async function load() {
      try {
        // Example analytics: count per status
        const { data } = await publicSupabase.from('queue_bookings').select('status,count:id', { count: 'exact' }).order('status');
        setCounts(data);
      } catch (err) {
        console.error('analytics.load', err);
      }
    })();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold">Queue Analytics (scaffold)</h2>
      <pre>{JSON.stringify(counts, null, 2)}</pre>
    </div>
  );
}
