import React from "react";

interface PageTransitionProps {
  children: React.ReactNode;
  location?: string;
  type?: "default" | "fade-up" | "fade-side";
  delay?: number;
  showLoader?: boolean;
  loaderDuration?: number;
}

/**
 * Route content must be visible and interactive as soon as it mounts.
 * An old delay/hidden-state implementation briefly hid new pages on
 * navigation (and could strand one invisible after rapid back/forward).
 *
 * CSS now handles a short, non-blocking entrance animation; the page
 * itself is never retained or hidden while the URL has already changed.
 * Keep the old props so existing routes do not need to be rewritten.
 */
export function PageTransition({
  children,
  type = "default",
}: PageTransitionProps) {
  const transitionClasses = {
    default: ["page-transition", "page-visible"],
    "fade-up": ["fade-up-transition", "fade-up-visible"],
    "fade-side": ["fade-side-transition", "fade-side-visible"],
  } as const;
  const classes = transitionClasses[type];

  return (
    <div className={`${classes.join(" ")} navigation-safe demos-route-enter`}>
      {children}
    </div>
  );
}
