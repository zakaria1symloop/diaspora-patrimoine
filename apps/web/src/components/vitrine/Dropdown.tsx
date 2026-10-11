'use client';
// The choice list of the search bar, the sort and the filters (CAT-001, CAT-050): a button showing the chosen value
// and a chevron, and a list that opens under it — every option on its own line of 44 px (TRV-121), the chosen one
// ticked, groups titled. Replaces the browser's own list, which could neither be styled nor read at a glance.
// Keyboard: ↑ ↓ Home End move, Enter or Space choose, Escape closes, a letter jumps to the first option starting with it.
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '@dp/ui';
import s from './Dropdown.module.css';

export interface DropdownOption {
  value: string;
  label: string;
  /** A short note at the end of the line (a count). */
  note?: string;
  disabled?: boolean;
}

export interface DropdownGroup {
  /** Title of the group; none: the options come untitled. */
  label?: string;
  options: DropdownOption[];
}

export interface DropdownProps {
  id?: string;
  value: string;
  groups: DropdownGroup[];
  onChange: (value: string) => void;
  /** Accessible name of the button, when no visible <label> points at `id`. */
  label?: string;
  /** Id of the visible caption that names the button. */
  labelledBy?: string;
  /** `bare`: no frame, for a field that already has one (search bar); `field`: a framed form field. */
  variant?: 'bare' | 'field';
  /** Shown before the chosen value (« Trier : »). */
  prefix?: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

export function Dropdown({ id, value, groups, onChange, label, labelledBy, variant = 'field', prefix, align = 'start', className }: DropdownProps) {
  const auto = useId();
  const listId = `${id ?? auto}-list`;
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const options = groups.flatMap((g) => g.options);
  const selected = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selected);

  const close = (focus: boolean) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Opens upwards when there is no room under the button; the active option stays in view.
  useLayoutEffect(() => {
    if (!open || !list.current || !button.current) return;
    const b = button.current.getBoundingClientRect();
    const h = list.current.offsetHeight;
    setUp(b.bottom + h + 12 > window.innerHeight && b.top - h - 12 > 0);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const move = (from: number, step: number) => {
    for (let i = from + step; i >= 0 && i < options.length; i += step) if (!options[i]!.disabled) return i;
    return from;
  };
  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close(true);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(selected);
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => move(a, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => move(a, -1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(move(-1, 1));
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(move(options.length, -1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key.length === 1) {
      const letter = e.key.toLocaleLowerCase();
      const hit = options.findIndex((o) => !o.disabled && o.label.toLocaleLowerCase().startsWith(letter));
      if (hit >= 0) setActive(hit);
    }
  };

  let index = -1;
  return (
    <div ref={root} className={[s.root, s[variant], className].filter(Boolean).join(' ')}>
      <button
        ref={button}
        id={id}
        type="button"
        className={s.button}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => {
          setActive(selected);
          setOpen((v) => !v);
        }}
        onKeyDown={onKey}
      >
        <span className={s.value}>
          {prefix}
          {options[selected]?.label ?? ''}
        </span>
        <Icon name="chevron-down" size={16} className={s.chevron} />
      </button>
      {open ? (
        <ul ref={list} id={listId} role="listbox" className={[s.list, up && s.up, align === 'end' && s.end].filter(Boolean).join(' ')} tabIndex={-1}>
          {groups.map((g, gi) => (
            <li key={g.label ?? gi} role="presentation">
              {g.label ? <p className={s.group}>{g.label}</p> : null}
              <ul role="group" aria-label={g.label} className={s.options}>
                {g.options.map((o) => {
                  index += 1;
                  const i = index;
                  return (
                    <li
                      key={o.value}
                      id={`${listId}-${i}`}
                      role="option"
                      data-index={i}
                      aria-selected={o.value === value}
                      aria-disabled={o.disabled || undefined}
                      className={[s.option, i === active && s.active].filter(Boolean).join(' ')}
                      onPointerEnter={() => !o.disabled && setActive(i)}
                      onClick={() => choose(i)}
                    >
                      <span className={s.optionLabel}>{o.label}</span>
                      {o.note ? <span className={s.note}>{o.note}</span> : null}
                      <Icon name="check" size={16} className={s.tick} />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
