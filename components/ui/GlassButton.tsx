import * as React from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";

function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}



const glassButtonVariants = cva(
  "relative isolate all-unset cursor-pointer rounded-full transition-all",
  {
    variants: {
      size: {
        default: "text-base font-medium",
        sm: "text-sm font-medium",
        xs: "text-[10px] font-bold uppercase tracking-widest",
        lg: "text-lg font-medium",
        iconSm: "h-8 w-8 flex items-center justify-center p-0",
        icon: "h-9 w-9 flex items-center justify-center p-0",
        iconLg: "h-14 w-14 flex items-center justify-center p-0",
        iconXl: "h-16 w-16 flex items-center justify-center p-0",
        icon2xl: "h-[72px] w-[72px] flex items-center justify-center p-0",
        none: "",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const glassButtonTextVariants = cva(
  "glass-button-text relative block select-none",
  {
    variants: {
      size: {
        default: "px-6 py-3.5 tracking-tighter",
        sm: "px-4 py-2",
        xs: "px-3 py-1",
        lg: "px-8 py-4",
        iconSm: "flex h-8 w-8 items-center justify-center p-0",
        icon: "flex h-9 w-9 items-center justify-center p-0",
        iconLg: "flex h-14 w-14 items-center justify-center p-0",
        iconXl: "flex h-16 w-16 items-center justify-center p-0",
        icon2xl: "flex h-[72px] w-[72px] items-center justify-center p-0",
        none: "",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export interface GlassButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string;
  buttonClassName?: string;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, buttonClassName, style, ...props }, ref) => {
    const wrapRef = React.useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Fast, responsive spring physics for snappy, liquid bubble feel
    const springX = useSpring(x, { damping: 18, stiffness: 450, mass: 0.15 });
    const springY = useSpring(y, { damping: 18, stiffness: 450, mass: 0.15 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      // Responsive magnetic pull
      const pullX = (e.clientX - centerX) * 0.38;
      const pullY = (e.clientY - centerY) * 0.38;
      x.set(pullX);
      y.set(pullY);
    };

    const handleMouseLeave = () => {
      x.set(0);
      y.set(0);
    };

    return (
      <>
        <motion.div
          ref={wrapRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ ...style, x: springX, y: springY }}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className={cn(
            "glass-button-wrap cursor-pointer rounded-full",
            className,
          )}
        >
          <button
            className={cn("glass-button w-full h-full", glassButtonVariants({ size }), buttonClassName)}
            ref={ref}
            type="button"
            aria-label={props['aria-label'] ?? props.title}
            {...props}
          >
            <span
              className={cn(
                glassButtonTextVariants({ size }),
                contentClassName,
              )}
            >
              {children}
            </span>
          </button>
          <div className="glass-button-shadow rounded-full"></div>
        </motion.div>
      </>
    );
  },
);
GlassButton.displayName = "GlassButton";

export { GlassButton, glassButtonVariants };

export default GlassButton;
