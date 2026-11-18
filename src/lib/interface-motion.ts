import {gsap} from 'gsap';

/** Imported only after an interface action. matchMedia owns and reverts its context. */
export function animateInterface(scope: HTMLElement, targets: HTMLElement[]) {
  const media = gsap.matchMedia();
  media.add('(prefers-reduced-motion: no-preference)', () => {
    if (!targets.length) return;
    gsap.fromTo(targets, {y: 6, opacity: 0.82}, {
      y: 0, opacity: 1, duration: 0.2, ease: 'power2.out',
      overwrite: 'auto', clearProps: 'transform,opacity',
    });
  }, scope);
  return () => media.revert();
}
