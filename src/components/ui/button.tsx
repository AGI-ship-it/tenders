import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * Button system. Pick a variant for emphasis and a size from one shared scale; avoid one-off
 * heights, radii or colours in className so buttons stay aligned with the future design system.
 *
 * Variants (emphasis, high to low):
 *   default      Primary action on a surface. One per area (Export CSV, Prequalify, Open on portal).
 *   success      Positive decision that completes a workflow step (HoD prequalifies).
 *   secondary    Tinted purple with a soft purple border: supporting actions such as Filter.
 *   outline      Neutral bordered: Cancel, Sources, Request changes.
 *   ghost        No chrome: icon buttons, Back, low-priority actions.
 *   destructive  Soft red: reject or remove.
 *   link         Inline text action.
 *
 * Sizes (one scale, shared radius): xs 28 · sm 32 · default 36 · lg 40 · xl 48 px tall;
 * icon-sm 32 · icon 36 · icon-lg 40 px square.
 *
 * Icons: leading for the action itself (Sparkles Run AI Scan, Plus Add source);
 * trailing when the icon says where it goes (external link, download, filter menu).
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm shadow-primary/15 hover:bg-primary/85",
        success: "bg-emerald-700 text-white shadow-sm hover:bg-emerald-700/90",
        secondary:
          "border-primary/30 bg-secondary text-secondary-foreground hover:border-primary/50 hover:bg-primary/10 aria-expanded:border-primary/50 aria-expanded:bg-primary/10",
        outline:
          "border-input bg-card text-foreground hover:bg-muted aria-expanded:bg-muted dark:bg-input/20 dark:hover:bg-input/40",
        ghost:
          "text-foreground/80 hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        default: "h-9 gap-2 px-3.5",
        lg: "h-10 gap-2 px-4",
        xl: "h-12 gap-2 rounded-xl px-6 text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        "icon-sm": "size-8",
        icon: "size-9",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
