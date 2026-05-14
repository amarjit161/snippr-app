import { useEffect, useState } from "react";
import { MessageCircle, Phone, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const FAQS = [
  {
    q: "How do I book a salon?",
    a: 'Go to Explore, find a salon near you, click "View & Join Queue", select your service, barber, date and time, then confirm your booking.',
  },
  {
    q: "Can I cancel my booking?",
    a: "Yes! Go to My Bookings, find your booking, then click Cancel. Cancellations should be made at least 30 minutes before your appointment.",
  },
  {
    q: "What is advance booking?",
    a: "You can book up to 30 days in advance. Your slot is locked instantly when you confirm.",
  },
  {
    q: "How do I know my queue position?",
    a: "After booking, you can see your live queue position in My Bookings or the Live Queue section.",
  },
  {
    q: "Why is a salon showing as closed?",
    a: "The salon may be outside working hours or the owner has marked it as closed today. You can still advance book for future dates.",
  },
  {
    q: "How do I register my salon on Snippr?",
    a: 'Click "Register Salon" or go to /owner-signup, verify your email, then complete the onboarding wizard.',
  },
  {
    q: "Is Snippr free to use?",
    a: "Yes, Snippr is free for customers. Salon owners can list their salon without setup charges.",
  },
];

export default function Support() {
  const { user } = useAuth();
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [recentBooking, setRecentBooking] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Tawk_API) {
      (window as any).Tawk_API.showWidget?.();
    }

    if (!user) {
      setRecentBooking(null);
      return;
    }

    supabase
      .from("queue")
      .select("*, salons(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setRecentBooking(data ?? null));
  }, [user]);

  const openChat = () => {
    if (typeof window !== "undefined" && (window as any).Tawk_API) {
      (window as any).Tawk_API.maximize?.();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 text-center">
          <div className="mb-4 text-5xl">💬</div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">How can we help?</h1>
          <p className="text-gray-500">Search our FAQs or chat with us live</p>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            onClick={openChat}
            className="group rounded-2xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-purple-300 hover:shadow-md"
          >
            <MessageCircle className="mb-3 h-8 w-8 text-purple-600" />
            <p className="font-semibold text-gray-800 group-hover:text-purple-700">Live Chat</p>
            <p className="mt-1 text-xs text-gray-500">Chat with us now, usually replies in minutes</p>
          </button>

          <a
            href="mailto:support@snippr.in"
            className="group rounded-2xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-purple-300 hover:shadow-md"
          >
            <Mail className="mb-3 h-8 w-8 text-purple-600" />
            <p className="font-semibold text-gray-800 group-hover:text-purple-700">Email Us</p>
            <p className="mt-1 text-xs text-gray-500">support@snippr.in, response in 24hrs</p>
          </a>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-left">
            <Phone className="mb-3 h-8 w-8 text-gray-400" />
            <p className="font-semibold text-gray-500">Phone Support</p>
            <p className="mt-1 text-xs text-gray-400">Coming soon</p>
          </div>
        </div>

        {user && recentBooking ? (
          <div className="mb-8 rounded-2xl border border-purple-200 bg-purple-50 p-5">
            <p className="mb-1 text-sm font-semibold text-purple-800">Your recent booking</p>
            <p className="text-sm text-purple-700">
              {recentBooking.salons?.name} · Status: {recentBooking.status}
            </p>
            <button
              onClick={openChat}
              className="mt-3 text-xs font-semibold text-purple-700 hover:underline"
            >
              Ask about this booking →
            </button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-bold text-gray-900">Frequently Asked Questions</h2>
          </div>
          {FAQS.map((faq, i) => (
            <div key={faq.q} className="border-b border-gray-100 last:border-0">
              <button
                onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50"
              >
                <span className="pr-4 text-sm font-medium text-gray-800">{faq.q}</span>
                {openFAQ === i ? (
                  <ChevronUp className="h-4 w-4 flex-shrink-0 text-purple-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
                )}
              </button>
              {openFAQ === i ? (
                <div className="px-6 pb-4">
                  <p className="text-sm leading-relaxed text-gray-600">{faq.a}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="mb-3 text-sm text-gray-500">Still need help? Our team is ready.</p>
          <button
            onClick={openChat}
            className="rounded-full bg-purple-600 px-6 py-3 font-semibold text-white shadow-lg shadow-purple-200 transition-colors hover:bg-purple-700"
          >
            💬 Start Live Chat
          </button>
        </div>
      </div>
    </div>
  );
}
