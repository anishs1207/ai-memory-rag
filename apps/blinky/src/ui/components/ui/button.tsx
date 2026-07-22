import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "accent"
    | "cyan"
    | "purple";
  size?: "default" | "sm" | "lg" | "icon" | "xs";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95";

    const variants = {
      default:
        "bg-white/10 text-white hover:bg-white/20 border border-white/15 shadow-sm backdrop-blur-md",
      destructive:
        "bg-red-500/20 text-red-400 hover:bg-red-500/35 border border-red-500/40 shadow-sm",
      outline:
        "border border-white/20 bg-black/40 hover:bg-white/10 text-white shadow-sm backdrop-blur-md",
      secondary:
        "bg-white/5 text-white/80 hover:bg-white/15 hover:text-white border border-white/10",
      ghost: "hover:bg-white/10 text-white/80 hover:text-white",
      link: "text-cyan-400 underline-offset-4 hover:underline p-0 h-auto",
      accent:
        "bg-blue-600/80 text-white hover:bg-blue-500 border border-blue-400/40 shadow-lg shadow-blue-500/20",
      cyan:
        "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/35 border border-cyan-500/40 shadow-sm shadow-cyan-500/10",
      purple:
        "bg-purple-500/20 text-purple-300 hover:bg-purple-500/35 border border-purple-500/40 shadow-sm shadow-purple-500/10",
    };

    const sizes = {
      default: "h-9 px-4 py-2",
      xs: "h-6 px-2 text-[10px]",
      sm: "h-7 px-3 text-xs",
      lg: "h-10 px-6 text-sm",
      icon: "h-8 w-8 p-0 rounded-lg",
    };

    return (
      <button
        style={{ WebkitAppRegion: "no-drag", ...props.style }}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
