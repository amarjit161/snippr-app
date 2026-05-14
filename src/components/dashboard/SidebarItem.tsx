import { ComponentType } from "react";
import { cn } from "@/lib/utils";

type SidebarItemProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
};

export function SidebarItem({ icon: Icon, label, isActive, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-gradient-to-r from-violet-100 via-indigo-50 to-violet-50 text-violet-700 shadow-sm"
          : "text-gray-700 hover:bg-white"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

