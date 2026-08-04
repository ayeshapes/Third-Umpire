import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 font-body",
  {
    variants: {
      variant: {
        primary:
          "bg-crimson text-on-crimson shadow-sm hover:bg-crimson-bright hover:shadow-md active:shadow-sm",
        outline:
          "border border-line-strong text-ivory bg-surface hover:border-crimson hover:text-crimson",
        ghost: "text-fg-muted hover:text-ivory hover:bg-surface-2",
        subtle: "bg-surface-2 text-ivory hover:bg-surface-2/70 border border-line",
      },
      size: {
        sm: "h-8 px-3.5 text-xs",
        md: "h-10 px-5",
        lg: "h-12 px-7 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
