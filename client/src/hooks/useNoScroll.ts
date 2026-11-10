import { useEffect } from 'react';

/**
 * Freeze the document scroll only while enabled. Do not globally cancel
 * touchmove/wheel events: the app and its dialogs own inner scroll regions.
 */
export function useNoScroll(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const body = document.body.style;
    const html = document.documentElement.style;
    const previous = {
      bodyOverflow: body.overflow,
      bodyHeight: body.height,
      htmlOverflow: html.overflow,
      htmlHeight: html.height,
    };

    body.overflow = 'hidden';
    html.overflow = 'hidden';

    return () => {
      body.overflow = previous.bodyOverflow;
      body.height = previous.bodyHeight;
      html.overflow = previous.htmlOverflow;
      html.height = previous.htmlHeight;
    };
  }, [enabled]);
}
