'use client';

import {useEffect, type RefObject} from 'react';

/** UI-only motion. Never pass the canvas, its ancestors, nodes, or viewport as targets. */
export function useInterfaceMotion(
  scope: RefObject<HTMLElement | null>,
  trigger: string | boolean,
  enabled = true,
  selector?: string,
) {
  useEffect(() => {
    const element = scope.current;
    if (!enabled || !element || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    let revert: (() => void) | undefined;
    // Keep GSAP out of the initial route payload; functionality never waits for motion.
    void import('@/lib/interface-motion').then(({animateInterface}) => {
      if (cancelled || !element.isConnected) return;
      const targets = selector ? Array.from(element.querySelectorAll<HTMLElement>(selector)) : [element];
      revert = animateInterface(element, targets.filter(target => target.getClientRects().length > 0));
    }).catch(() => {
      // A failed optional chunk leaves the already-visible, interactive UI at rest.
    });
    return () => { cancelled = true; revert?.(); };
  }, [scope, trigger, enabled, selector]);
}
