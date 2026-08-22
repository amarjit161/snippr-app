import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Calendar, Clock, Bell, User } from "lucide-react";
import { V, BG, DISP } from "./tokens";
import { easeOut } from "@/lib/animations";
import { Reveal, Label } from "@/components/design/Reveal";
import { PhoneFrame } from "@/components/design/PhoneFrame";
import { HomeScreen } from "@/components/design/phone/HomeScreen";
import { BookScreen } from "@/components/design/phone/BookScreen";
import { QueueScreen } from "@/components/design/phone/QueueScreen";
import { AlertsScreen } from "@/components/design/phone/AlertsScreen";
import { ProfileScreen } from "@/components/design/phone/ProfileScreen";
import { APP_TABS } from "@/components/design/phone/types";
import type { AppTab } from "@/components/design/phone/types";

const TAB_ICONS: Record<AppTab, React.ReactNode> = {
  Home:    <Home    style={{ width: 15, height: 15 }} />,
  Book:    <Calendar style={{ width: 15, height: 15 }} />,
  Queue:   <Clock   style={{ width: 15, height: 15 }} />,
  Alerts:  <Bell    style={{ width: 15, height: 15 }} />,
  Profile: <User    style={{ width: 15, height: 15 }} />,
};

export function AppScreens() {
  const [appTab, setAppTab] = useState<AppTab>("Home");

  return (
    <section className="py-24 px-6" style={{ background: BG }} aria-labelledby="app-heading">
      <div className="max-w-6xl mx-auto">
        <Reveal className="mb-12">
          <Label text="Customer Experience" />
          <h2 id="app-heading" className="text-4xl md:text-5xl font-bold tracking-tight text-white"
            style={{ fontFamily: DISP, letterSpacing: "-0.025em" }}>
            Five screens.<br />Zero confusion.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="flex flex-col items-center gap-8">
            <nav aria-label="App screen navigation"
              className="flex gap-1 p-1 rounded-2xl border"
              style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.025)" }}>
              {APP_TABS.map(tab => {
                const active = appTab === tab;
                return (
                  <button key={tab} onClick={() => setAppTab(tab)}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium"
                    style={{ background: active ? V : "transparent",
                      color: active ? "#fff" : "rgba(255,255,255,0.38)",
                      transition: "all 0.2s ease" }}>
                    {TAB_ICONS[tab]}
                    <span className="hidden sm:inline">{tab}</span>
                  </button>
                );
              })}
            </nav>
            <PhoneFrame ariaLabel={`Snippr app ${appTab} screen`}>
              <AnimatePresence mode="wait">
                <motion.div key={appTab}
                  initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.26, ease: easeOut }}
                  style={{ height: "100%" }}>
                  {appTab === "Home"    && <HomeScreen    onTabChange={setAppTab} />}
                  {appTab === "Book"    && <BookScreen    onTabChange={setAppTab} />}
                  {appTab === "Queue"   && <QueueScreen   onTabChange={setAppTab} />}
                  {appTab === "Alerts"  && <AlertsScreen  onTabChange={setAppTab} />}
                  {appTab === "Profile" && <ProfileScreen onTabChange={setAppTab} />}
                </motion.div>
              </AnimatePresence>
            </PhoneFrame>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
