import * as React from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";

function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}

const glassButtonStyles = `@property --angle-1 { syntax: "<angle>"; inherits: false; initial-value: -75deg; }

@property --angle-2 { syntax: "<angle>"; inherits: false; initial-value: -45deg; }

.glass-button-wrap {
  --anim-time:.2s;
  --anim-ease:cubic-bezier(.16,1,.3,1);
  --border-width:clamp(1px,.0625em,4px);
  --foreground:#ffffff;
  --background:#ffffff;
  z-index:2;
  transform-style:preserve-3d;
  position:relative;
  display:inline-block;
}

.glass-button-shadow {
  --shadow-cutoff-fix:2em;
  width:calc(100% + var(--shadow-cutoff-fix));
  height:calc(100% + var(--shadow-cutoff-fix));
  top:calc(0% - var(--shadow-cutoff-fix)/2);
  left:calc(0% - var(--shadow-cutoff-fix)/2);
  filter:blur(clamp(2px,.125em,12px));
  transition:filter var(--anim-time)var(--anim-ease);
  pointer-events:none;
  position:absolute
}

.glass-button-shadow:after {
  content:"";
  background:linear-gradient(180deg,oklch(from var(--foreground, #fff)l c h/20%),oklch(from var(--foreground, #fff)l c h/10%));
  width:calc(100% - var(--shadow-cutoff-fix) - .25em);
  height:calc(100% - var(--shadow-cutoff-fix) - .25em);
  top:0;
  right:0;
  bottom:0;
  left:0;
  top:calc(var(--shadow-cutoff-fix) - .5em);
  left:calc(var(--shadow-cutoff-fix) - .875em);
  box-sizing:border-box;
  transition:all var(--anim-time)var(--anim-ease);
  opacity:1;
  border-radius:9999px;
  padding:.125em;
  position:absolute;
  -webkit-mask-image:linear-gradient(#000 0 0),linear-gradient(#000 0 0);
  mask-image:linear-gradient(#000 0,#000 0),linear-gradient(#000 0,#000 0);
  -webkit-mask-position:0 0,0 0;
  mask-position:0 0,0 0;
  -webkit-mask-size:auto,auto;
  mask-size:auto,auto;
  -webkit-mask-repeat:repeat,repeat;
  mask-repeat:repeat,repeat;
  -webkit-mask-clip:content-box,border-box;
  mask-clip:content-box,border-box;
  -webkit-mask-origin:content-box,border-box;
  mask-origin:content-box,border-box;
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  -webkit-mask-source-type:auto,auto;
  mask-mode:match-source,match-source
}

.glass-button {
  -webkit-tap-highlight-color:transparent;
  -webkit-backdrop-filter:blur(16px);
  backdrop-filter:blur(16px);
  transition:all var(--anim-time)var(--anim-ease);
  background:linear-gradient(-75deg,oklch(from var(--background, #fff)l c h/8%),oklch(from var(--background, #fff)l c h/24%),oklch(from var(--background, #fff)l c h/8%));
  box-shadow:inset 0 .125em .125em oklch(from var(--foreground, #fff)l c h/30%),inset 0 -.125em .125em oklch(from var(--background, #fff)l c h/30%),0 .25em .125em -.125em oklch(from var(--foreground, #fff)l c h/20%),0 0 .1em .25em inset oklch(from var(--background, #fff)l c h/20%),0 0 oklch(from var(--background, #fff)l c h)
}

.glass-button:hover {
  -webkit-backdrop-filter:blur(16px);
  backdrop-filter:blur(16px);
  background:linear-gradient(-75deg,oklch(from var(--background, #fff)l c h/16%),oklch(from var(--background, #fff)l c h/36%),oklch(from var(--background, #fff)l c h/16%));
  box-shadow:
    inset 0 .125em .125em oklch(from var(--foreground, #fff)l c h/50%),
    inset 0 -.125em .125em oklch(from var(--background, #fff)l c h/40%),
    0 0 22px rgba(255, 255, 255, 0.45),
    0 0 42px rgba(255, 255, 255, 0.2),
    0 .25em .15em -.1em rgba(0, 0, 0, 0.25),
    0 0 .05em .1em inset oklch(from var(--background, #fff)l c h/50%);
}

.glass-button-text {
  color:oklch(from var(--foreground, #fff)l c h/95%);
  text-shadow:0em .1em .15em rgba(0,0,0,0.3);
  transition:all var(--anim-time)var(--anim-ease)
}

.glass-button:hover .glass-button-text {
  text-shadow:.025em .025em .025em oklch(from var(--foreground, #fff)l c h/25%)
}

.glass-button-text:after {
  content:"";
  width:calc(100% - var(--border-width));
  height:calc(100% - var(--border-width));
  top:calc(0% + var(--border-width)/2);
  left:calc(0% + var(--border-width)/2);
  box-sizing:border-box;
  background:linear-gradient(var(--angle-2),transparent 0%,oklch(from var(--background, #fff)l c h/50%)40% 50%,transparent 55%);
  z-index:3;
  mix-blend-mode:screen;
  pointer-events:none;
  transition:background-position calc(var(--anim-time)*1.25)var(--anim-ease),--angle-2 calc(var(--anim-time)*1.25)var(--anim-ease);
  background-position:0%;
  background-size:200% 200%;
  border-radius:9999px;
  display:block;
  position:absolute;
  overflow:clip
}

.glass-button:hover .glass-button-text:after {
  background-position:25%
}

.glass-button:active .glass-button-text:after {
  --angle-2:-15deg;
  background-position:50% 15%
}

.glass-button:after {
  content:"";
  z-index:1;
  width:calc(100% + var(--border-width));
  height:calc(100% + var(--border-width));
  top:0;
  right:0;
  bottom:0;
  left:0;
  top:calc(0% - var(--border-width)/2);
  left:calc(0% - var(--border-width)/2);
  padding:var(--border-width);
  box-sizing:border-box;
  background:conic-gradient(from var(--angle-1)at 50% 50%,oklch(from var(--foreground, #fff)l c h/50%)0%,transparent 5% 40%,oklch(from var(--foreground, #fff)l c h/50%)50%,transparent 60% 95%,oklch(from var(--foreground, #fff)l c h/50%)100%),linear-gradient(180deg,oklch(from var(--background, #fff)l c h/25%),oklch(from var(--background, #fff)l c h/25%));
  transition:all var(--anim-time)var(--anim-ease),--angle-1 .5s ease;
  box-shadow:inset 0 0 0 calc(var(--border-width)/2) oklch(from var(--background, #fff)l c h/50%);
  border-radius:9999px;
  position:absolute;
  -webkit-mask-image:linear-gradient(#000 0 0),linear-gradient(#000 0 0);
  mask-image:linear-gradient(#000 0,#000 0),linear-gradient(#000 0,#000 0);
  -webkit-mask-position:0 0,0 0;
  mask-position:0 0,0 0;
  -webkit-mask-size:auto,auto;
  mask-size:auto,auto;
  -webkit-mask-repeat:repeat,repeat;
  mask-repeat:repeat,repeat;
  -webkit-mask-clip:content-box,border-box;
  mask-clip:content-box,border-box;
  -webkit-mask-origin:content-box,border-box;
  mask-origin:content-box,border-box;
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  -webkit-mask-source-type:auto,auto;
  mask-mode:match-source,match-source
}

.glass-button:hover:after {
  --angle-1:-125deg
}

.glass-button:active:after {
  --angle-1:-75deg
}

.glass-button-wrap:has(.glass-button:hover) .glass-button-shadow {
  filter:blur(clamp(2px,.0625em,6px))
}

.glass-button-wrap:has(.glass-button:hover) .glass-button-shadow:after {
  top:calc(var(--shadow-cutoff-fix) - .875em);
  opacity:1
}

.glass-button-wrap:has(.glass-button:active) .glass-button-shadow {
  filter:blur(clamp(2px,.125em,12px))
}

.glass-button-wrap:has(.glass-button:active) .glass-button-shadow:after {
  top:calc(var(--shadow-cutoff-fix) - .5em);
  opacity:.75
}

.glass-button-wrap:has(.glass-button:active) .glass-button-text {
  text-shadow:.025em .25em .05em oklch(from var(--foreground)l c h/12%)
}

.glass-button-wrap:has(.glass-button:active) .glass-button {
  box-shadow:inset 0 .125em .125em oklch(from var(--foreground)l c h/5%),inset 0 -.125em .125em oklch(from var(--background)l c h/50%),0 .125em .125em -.125em oklch(from var(--foreground)l c h/20%),0 0 .1em .25em inset oklch(from var(--background)l c h/20%),0 .225em .05em oklch(from var(--foreground)l c h/5%),0 .25em oklch(from var(--background)l c h/75%),inset 0 .25em .05em oklch(from var(--foreground)l c h/15%)
}

@media (hover: none) and (pointer: coarse) {
  .glass-button:after,
  .glass-button:hover:after,
  .glass-button:active:after {
    --angle-1: -75deg;
  }

  .glass-button .glass-button-text:after,
  .glass-button:active .glass-button-text:after {
    --angle-2: -45deg;
  }
}
`;

const glassButtonVariants = cva(
  "relative isolate all-unset cursor-pointer rounded-full transition-all",
  {
    variants: {
      size: {
        default: "text-base font-medium",
        sm: "text-sm font-medium",
        lg: "text-lg font-medium",
        iconSm: "h-8 w-8 flex items-center justify-center p-0",
        icon: "h-9 w-9 flex items-center justify-center p-0",
        iconLg: "h-14 w-14 flex items-center justify-center p-0",
        iconXl: "h-16 w-16 flex items-center justify-center p-0",
        icon2xl: "h-[72px] w-[72px] flex items-center justify-center p-0",
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
        lg: "px-8 py-4",
        iconSm: "flex h-8 w-8 items-center justify-center p-0",
        icon: "flex h-9 w-9 items-center justify-center p-0",
        iconLg: "flex h-14 w-14 items-center justify-center p-0",
        iconXl: "flex h-16 w-16 items-center justify-center p-0",
        icon2xl: "flex h-[72px] w-[72px] items-center justify-center p-0",
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
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, ...props }, ref) => {
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
        <style>{glassButtonStyles}</style>
        <motion.div
          ref={wrapRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ x: springX, y: springY }}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className={cn(
            "glass-button-wrap cursor-pointer rounded-full",
            className,
          )}
        >
          <button
            className={cn("glass-button", glassButtonVariants({ size }))}
            ref={ref}
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
