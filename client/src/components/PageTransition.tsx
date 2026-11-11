import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface PageTransitionProps {
  children: React.ReactNode;
  location?: string;
  type?: "default" | "fade-up" | "fade-side";
  delay?: number;
  showLoader?: boolean;
  loaderDuration?: number;
}

/**
 * Keep only the current route mounted during page transitions.
 *
 * Previously the exiting route was cached as a React element and rendered
 * briefly after the URL changed. An old /governo/:slug element could then run
 * useParams() under /profilo, fail to find its ministry and redirect to
 * /governo. In rapid navigation, cancelled timers could also leave the next
 * page permanently transparent.
 *
 * The new route always mounts immediately (including its correct route params).
 * Only its visual entrance is delayed; each route change cancels the prior timer.
 */
export function PageTransition({
  children,
  location,
  type = "default",
  delay = 80,
  showLoader = false,
  loaderDuration = 400
}: PageTransitionProps) {
  const [currentLocation] = useLocation();
  const actualLocation = location ?? currentLocation;
  const [visibleLocation, setVisibleLocation] = useState(actualLocation);
  const isVisible = visibleLocation === actualLocation;

  useEffect(() => {
    if (isVisible) return;

    const timer = window.setTimeout(
      () => setVisibleLocation(actualLocation),
      Math.max(0, delay + (showLoader ? loaderDuration : 30))
    );
    return () => window.clearTimeout(timer);
  }, [actualLocation, isVisible, delay, showLoader, loaderDuration]);

  // Existing consumers can request that an interrupted animation be revealed.
  useEffect(() => {
    const handleForceRerender = () => setVisibleLocation(actualLocation);
    window.addEventListener("force-rerender", handleForceRerender);
    return () => window.removeEventListener("force-rerender", handleForceRerender);
  }, [actualLocation]);

  const transitionClasses = {
    default: { base: "page-transition", visible: "page-visible", hidden: "page-hidden" },
    "fade-up": { base: "fade-up-transition", visible: "fade-up-visible", hidden: "" },
    "fade-side": { base: "fade-side-transition", visible: "fade-side-visible", hidden: "fade-side-hidden" }
  } as const;
  const classes = transitionClasses[type];

  return (
    <>
      {showLoader && !isVisible && (
        <div className="page-loader">
          <div className="loader-content">
            <div className="loader-spinner" />
            <div className="loader-text">Caricamento...</div>
          </div>
        </div>
      )}
      <div
        className={`${classes.base} ${isVisible ? classes.visible : classes.hidden} navigation-safe`}
        aria-live="polite"
      >
        {children}
      </div>
    </>
  );
}
