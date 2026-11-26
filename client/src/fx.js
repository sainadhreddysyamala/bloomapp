import { useEffect } from 'react';

/**
 * Visual effects layer (no business logic):
 *  1. Pointer-driven 3D tilt + glare on any element with [data-tilt="<maxDegrees>"]
 *  2. Adds data-label to table cells so tables can collapse into cards on phones
 *  3. Toggles data-scrolled on <html> so the top bar can gain depth when scrolling
 */
export function useFx() {
  // 1 + 3 — set up once
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const onScroll = () => {
      document.documentElement.toggleAttribute('data-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    let cleanupTilt = () => {};
    if (!reduce && finePointer) {
      let raf = 0;
      let active = null;
      let lastEvent = null;

      const reset = (node) => {
        node.style.setProperty('--rx', '0deg');
        node.style.setProperty('--ry', '0deg');
        node.classList.remove('is-tilting');
      };

      const apply = () => {
        raf = 0;
        if (!active || !lastEvent) return;
        const r = active.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (lastEvent.clientX - r.left) / r.width));
        const py = Math.min(1, Math.max(0, (lastEvent.clientY - r.top) / r.height));
        const max = parseFloat(active.dataset.tilt) || 6;
        active.style.setProperty('--ry', ((px - 0.5) * max * 2).toFixed(2) + 'deg');
        active.style.setProperty('--rx', ((0.5 - py) * max * 2).toFixed(2) + 'deg');
        active.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        active.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        active.classList.add('is-tilting');
      };

      const onMove = (e) => {
        const target = e.target.closest ? e.target.closest('[data-tilt]') : null;
        if (active && active !== target) reset(active);
        active = target;
        lastEvent = e;
        if (target && !raf) raf = requestAnimationFrame(apply);
      };
      const onLeaveWindow = () => {
        if (active) reset(active);
        active = null;
      };

      document.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('mouseleave', onLeaveWindow);
      cleanupTilt = () => {
        document.removeEventListener('pointermove', onMove);
        document.documentElement.removeEventListener('mouseleave', onLeaveWindow);
        if (raf) cancelAnimationFrame(raf);
      };
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      cleanupTilt();
    };
  }, []);

  // 2 — runs after every render (cheap) so new rows are labelled too
  useEffect(() => {
    document.querySelectorAll('table').forEach((table) => {
      const heads = [...table.querySelectorAll('thead th')].map((th) =>
        (th.childNodes[0]?.textContent || th.textContent || '').trim()
      );
      table.querySelectorAll('tbody tr').forEach((tr) => {
        [...tr.children].forEach((td, i) => {
          if (td.colSpan > 1) return;
          const label = heads[i];
          if (label && td.dataset.label !== label) td.dataset.label = label;
        });
      });
    });
  });
}
