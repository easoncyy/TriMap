'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import {ArrowLeft, ArrowUpRight, X} from 'lucide-react';
import {useInterfaceMotion} from '@/hooks/useInterfaceMotion';

type Props = {
  open: boolean;
  reading: boolean;
  title: string;
  selectionKey: string;
  summary: string;
  category: string;
  overlayOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Presentation only: selection, evidence and editing remain owned by Atlas. */
export default function ReadingPanel({open, reading, title, selectionKey, summary, category, overlayOpen, onClose, children}: Props) {
  const [mobile, setMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const expand = useRef<HTMLButtonElement>(null);
  const overlay = useRef(overlayOpen);
  overlay.current = overlayOpen;
  const full = mobile && open && (expanded || !reading);
  useInterfaceMotion(panel, `${open}:${full}`, open);

  useEffect(() => {
    const media = matchMedia('(max-width: 767px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (!open) setExpanded(false); }, [open]);
  useEffect(() => {
    panel.current?.querySelector('.detail-scroll')?.scrollTo(0, 0);
  }, [selectionKey, open]);

  useEffect(() => {
    if (!full || overlayOpen || !panel.current) return;
    const current = panel.current;
    const previous = document.activeElement as HTMLElement | null;
    const background = Array.from(current.closest('.app-shell')!.querySelectorAll<HTMLElement>(
      '.topbar, .atlas-banner, .lens-bar, .sidebar, .canvas-section, .spectrum-tools, .site-footer'
    )).map(element => ({element, inert: element.inert}));
    background.forEach(({element}) => { element.inert = true; });
    back.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (reading) setExpanded(false); else onClose();
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'))
        .filter(element => element.getClientRects().length > 0);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || !current.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !current.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      background.forEach(({element, inert}) => { element.inert = inert; });
      if (!overlay.current) requestAnimationFrame(() => {
        if (expand.current) expand.current.focus();
        else if (previous?.isConnected) previous.focus();
        else document.querySelector<HTMLButtonElement>('[aria-controls="knowledge-reading"]')?.focus();
      });
    };
  }, [full, overlayOpen, reading, onClose]);

  if (!open) return null;
  return <aside ref={panel} id="knowledge-reading" className={`detail-panel reading-panel ${full ? 'reading-full' : ''}`}
    role={full ? 'dialog' : undefined} aria-modal={full && !overlayOpen ? true : undefined} aria-label="知识详情侧栏">
    {mobile && !full ? <div className="reading-summary">
      <div className="reading-summary-head"><span>{category}</span><button aria-label="关闭详情" onClick={onClose}><X size={18}/></button></div>
      <h2>{title}</h2><p>{summary}</p>
      <button ref={expand} className="reading-expand" onClick={() => setExpanded(true)}>展开全文与依据 <ArrowUpRight size={16}/></button>
    </div> : <>
      {mobile && <div className="reading-return"><button ref={back} onClick={() => reading ? setExpanded(false) : onClose()}><ArrowLeft size={18}/>{reading ? '返回摘要' : '返回图谱'}</button><span>知识阅读</span></div>}
      {children}
    </>}
  </aside>;
}
