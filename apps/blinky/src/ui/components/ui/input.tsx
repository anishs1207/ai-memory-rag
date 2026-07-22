import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        style={{ WebkitAppRegion: "no-drag", ...props.style }}
        className={cn(
          "flex h-9 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white shadow-inner placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 focus-visible:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 backdrop-blur-md",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
