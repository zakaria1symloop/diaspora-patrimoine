// DSN-050 Modal, Popover/Menu, DSN-055 HelpTip, TRV-081 Toast — what opens above the page. All close with Escape, give
// the focus back to where it came from (TRV-121) and are reachable with the keyboard and by touch, never by hover alone.
'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import s from './Overlays.module.css';

// ─── Modal ──────────────────────────────────────────────────────────────────

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  /** DSN-050 — 480, 720 or 800. */
  width?: 480 | 560 | 720 | 800;
  /** Buttons of the window, right-aligned under the content. */
  footer?: ReactNode;
  /** A window that must be answered (session expired): no close button, Escape does nothing. */
  locked?: boolean;
}

/** Native <dialog>: focus trapped and returned, Escape closes; centred on a computer, full screen on a phone. */
export function Modal({ open, onClose, title, closeLabel, children, width = 480, footer, locked }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      style={{ ['--w' as string]: `${width / 16}rem` }}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
    >
      {open ? (
        <div className={s.frame}>
          <header className={s.header}>
            <h2 id={titleId} className={s.title}>
              {title}
            </h2>
            {locked ? null : (
              <button type="button" className={s.close} onClick={onClose}>
                <Icon name="close" size={20} label={closeLabel} />
              </button>
            )}
          </header>
          <div className={s.body}>{children}</div>
          {footer ? <footer className={s.footer}>{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

// ─── Popover (shared by the menu, the help tip, the filter chip) ────────────

/** Closes on Escape (focus back to the trigger) and on a click or a focus elsewhere. */
export function useDismiss(open: boolean, close: (restoreFocus: boolean) => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) => refs.some((r) => r.current && target instanceof Node && r.current.contains(target));
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    const onFocus = (e: FocusEvent) => {
      if (!inside(e.target)) close(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, close]);
}

/** Keeps a floating panel inside the viewport: flips to the other side when it would overflow. */
export function usePlacement(open: boolean, panel: React.RefObject<HTMLElement | null>, align: 'start' | 'end') {
  const [flip, setFlip] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    setFlip({ x: false, y: false });
    const r = panel.current.getBoundingClientRect();
    const x = align === 'start' ? r.right > window.innerWidth - 8 : r.left < 8;
    const y = r.bottom > window.innerHeight - 8 && r.top - r.height > 8;
    if (x || y) setFlip({ x, y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align]);
  return flip;
}

// ─── Menu ───────────────────────────────────────────────────────────────────

export interface MenuItem {
  key: string;
  label: string;
  icon?: IconName;
  /** A link (the application gives its router link through `renderLink`). */
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
  /** BO-047 — impossible in the current state: greyed, and says why. */
  disabledReason?: string | null;
  /** A thin rule above this item. */
  separated?: boolean;
}

export interface MenuProps {
  /** Accessible name of the trigger (« Autres actions »), or its visible content with `trigger`. */
  label: string;
  trigger?: ReactNode;
  triggerClassName?: string;
  items: MenuItem[];
  align?: 'start' | 'end';
  header?: ReactNode;
  renderLink?: (item: MenuItem, props: { className: string; role: 'menuitem'; tabIndex: number; onClick: () => void; children: ReactNode }) => ReactNode;
}

/** A button that opens a list of actions: arrows, Home/End, Enter, Escape; also by touch (DSN-053 « ⋯ »). */
export function Menu({ label, trigger, triggerClassName, items, align = 'end', header, renderLink }: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback((restore: boolean) => {
    setOpen(false);
    if (restore) button.current?.focus();
  }, []);
  useDismiss(open, close, [wrap, panel]);
  const pos = useAnchoredPanel(open, button, panel, align);

  const focusItem = (index: number) => {
    const nodes = panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!nodes?.length) return;
    nodes[(index + nodes.length) % nodes.length]?.focus();
  };
  useEffect(() => {
    if (open) focusItem(0);
  }, [open]);

  const onKey = (e: ReactKeyboardEvent) => {
    const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const at = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(at + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem(at - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusItem(nodes.length - 1);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  if (!items.length && !header) return null;
  return (
    <span className={s.menuWrap} ref={wrap}>
      <button
        ref={button}
        type="button"
        className={triggerClassName ?? s.menuTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={trigger ? undefined : label}
        title={trigger ? undefined : label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger ?? <Icon name="more" size={20} />}
      </button>
      {open ? createPortal(
        <div
          ref={panel}
          className={[s.popover, s.menu, s.anchored].join(' ')}
          style={pos}
          role="menu"
          aria-label={label}
          onKeyDown={onKey}
          onClick={(e) => e.stopPropagation()}
        >
          {header ? <div className={s.menuHeader}>{header}</div> : null}
          {items.map((item) => {
            const className = [s.menuItem, item.danger && s.menuDanger, item.separated && s.menuSeparated].filter(Boolean).join(' ');
            const inner = (
              <>
                {item.icon ? <Icon name={item.icon} size={20} /> : null}
                <span className={s.menuLabel}>
                  {item.label}
                  {item.disabledReason ? <span className={s.menuReason}>{item.disabledReason}</span> : null}
                </span>
              </>
            );
            if (item.disabledReason) {
              return (
                <button key={item.key} type="button" role="menuitem" tabIndex={-1} className={`${className} ${s.menuDisabled}`} aria-disabled="true" onClick={(e) => e.preventDefault()}>
                  {inner}
                </button>
              );
            }
            const select = () => {
              setOpen(false);
              item.onSelect?.();
            };
            if (item.href) {
              return renderLink ? (
                <span key={item.key} className={s.menuLinkWrap}>
                  {renderLink(item, { className, role: 'menuitem', tabIndex: -1, onClick: select, children: inner })}
                </span>
              ) : (
                <a key={item.key} href={item.href} role="menuitem" tabIndex={-1} className={className} onClick={select}>
                  {inner}
                </a>
              );
            }
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={className}
                onClick={() => {
                  close(true);
                  item.onSelect?.();
                }}
              >
                {inner}
              </button>
            );
          })}
        </div>,
        portalHost(wrap.current),
      ) : null}
    </span>
  );
}

/**
 * D-107 — where a floating panel lives: the open window it was opened from (a window is drawn above the page), else
 * the page itself. Out of its row, a card or a list with hidden overflow can no longer cut it.
 */
function portalHost(from: HTMLElement | null): HTMLElement {
  return (from?.closest('dialog[open]') as HTMLElement | null) ?? document.body;
}

/**
 * D-107 — the panel's place on the screen, from its trigger: under it (above when the space below is short), aligned
 * on its start or end, kept 8 px inside the viewport; followed on scroll and resize. Hidden until measured.
 */
function useAnchoredPanel(open: boolean, trigger: React.RefObject<HTMLElement | null>, panel: React.RefObject<HTMLElement | null>, align: 'start' | 'end'): CSSProperties {
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden', top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = trigger.current?.getBoundingClientRect();
      const p = panel.current;
      if (!b || !p) return;
      const gap = 4;
      const h = p.offsetHeight;
      const w = p.offsetWidth;
      const fitsBelow = b.bottom + gap + h <= window.innerHeight - 8;
      const top = fitsBelow || b.top - gap - h < 8 ? b.bottom + gap : b.top - gap - h;
      const left = Math.max(8, Math.min(align === 'end' ? b.right - w : b.left, window.innerWidth - w - 8));
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      setPos({ visibility: 'hidden', top: 0, left: 0 });
    };
  }, [open, align, trigger, panel]);
  return pos;
}

// ─── HelpTip (DSN-055, TRV-126) ─────────────────────────────────────────────

/** The « ? » next to a term: opens on click, touch or focus+Enter; closes with Escape or a click elsewhere. */
export function HelpTip({ label, title, children, align = 'start' }: { label: string; title?: string; children: ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const id = useId();
  const close = useCallback((restore: boolean) => {
    setOpen(false);
    if (restore) button.current?.focus();
  }, []);
  useDismiss(open, close, [wrap]);
  const flip = usePlacement(open, panel, align);
  return (
    <span className={s.helpWrap} ref={wrap}>
      <button
        ref={button}
        type="button"
        className={s.helpButton}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open ? (
        <span ref={panel} id={id} role="note" className={[s.popover, s.help, align === 'end' ? s.alignEnd : s.alignStart, flip.x && s.flipX, flip.y && s.flipY].filter(Boolean).join(' ')}>
          {title ? <strong className={s.helpTitle}>{title}</strong> : null}
          <span className={s.helpText}>{children}</span>
        </span>
      ) : null}
    </span>
  );
}

// ─── Toast (TRV-081, TRV-114) ───────────────────────────────────────────────

export interface ToastInput {
  tone?: 'success' | 'info' | 'error';
  text: string;
  /** « Annuler » for a reversible action, « Réessayer » for a quick action that failed. */
  action?: { label: string; run: () => void };
}
interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(toast: ToastInput) => void>(() => undefined);

/** `const toast = useToast(); toast({ text })`. */
export function useToast(): (toast: ToastInput) => void {
  return useContext(ToastContext);
}

/**
 * At the bottom of the screen. A success stays `duration` ms (5 s in the back office, 8 s on the site) and the count
 * stops while the pointer or the focus is on it; an error stays until it is closed (TRV-114).
 */
export function ToastProvider({ children, duration = 5000, closeLabel }: { children: ReactNode; duration?: number; closeLabel: string }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = useCallback((toast: ToastInput) => {
    seq.current += 1;
    const id = seq.current;
    setItems((list) => [...list.slice(-2), { id, ...toast }]);
  }, []);
  const remove = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className={s.toasts}>
        {items.map((t) => (
          <ToastView key={t.id} item={t} duration={duration} closeLabel={closeLabel} onDone={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, duration, closeLabel, onDone }: { item: ToastItem; duration: number; closeLabel: string; onDone: () => void }) {
  const tone = item.tone ?? 'success';
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (tone === 'error' || held) return;
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [tone, held, duration, onDone]);
  return (
    <div
      className={`${s.toast} ${s[`toast-${tone}`]}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <Icon name={tone === 'error' ? 'status-error' : tone === 'info' ? 'status-info' : 'status-success'} size={20} />
      <span className={s.toastText}>{item.text}</span>
      {item.action ? (
        <button
          type="button"
          className={s.toastAction}
          onClick={() => {
            item.action?.run();
            onDone();
          }}
        >
          {item.action.label}
        </button>
      ) : null}
      <button type="button" className={s.toastClose} onClick={onDone}>
        <Icon name="close" size={16} label={closeLabel} />
      </button>
    </div>
  );
}
