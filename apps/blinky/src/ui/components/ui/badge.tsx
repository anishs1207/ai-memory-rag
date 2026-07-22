import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "cyan"
    | "purple"
    | "green"
    | "orange";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const baseStyles =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  const variants = {
    default:
      "border border-transparent bg-white/10 text-white hover:bg-white/20 backdrop-blur-md",
    secondary:
      "border border-transparent bg-white/5 text-white/70 hover:bg-white/15",
    destructive:
      "border border-transparent bg-red-500/20 text-red-300 border border-red-500/30",
    outline: "text-white/80 border border-white/20",
    cyan: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10",
    purple: "bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm shadow-purple-500/10",
    green: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10",
    orange: "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10",
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  );
}
