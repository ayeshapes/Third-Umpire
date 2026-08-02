import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-full border border-line-strong bg-surface px-4 text-sm text-ivory placeholder:text-fg-faint",
        "focus:outline-none focus:ring-2 focus:ring-crimson-bright/50 focus:border-crimson-bright/60",
        "transition-colors",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
