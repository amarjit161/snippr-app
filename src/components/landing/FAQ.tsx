import { ChevronDown } from "lucide-react";
import { SectionHeading } from "./Section";
import { FAQS } from "./faqData";

export function FAQ() {
  return (
    <section className="border-t border-white/[0.06] px-4 py-24 sm:px-6" aria-labelledby="faq-heading">
      <div id="faq" className="mx-auto max-w-3xl scroll-mt-24">
        <SectionHeading id="faq-heading" eyebrow="FAQ" title="Questions, answered." center />
        <div className="divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group px-5 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-semibold text-white marker:hidden [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="h-5 w-5 shrink-0 text-white/60 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </summary>
              <p className="pb-5 leading-relaxed text-white/70">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
