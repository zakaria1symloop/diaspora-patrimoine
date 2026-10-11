'use client';
// TRV-123 — « Taille du texte »: Normale 100 %, Grande 115 %, Très grande 130 %; changes the root size.
import { useEffect, useId, useState } from 'react';
import s from './TextSizeControl.module.css';

export type TextSize = 'normal' | 'large' | 'xlarge';
const KEY = 'dp_text_size';

export function readTextSize(): TextSize {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'large' || v === 'xlarge' ? v : 'normal';
  } catch {
    return 'normal';
  }
}

export function applyTextSize(size: TextSize): void {
  const html = document.documentElement;
  if (size === 'normal') html.removeAttribute('data-text-size');
  else html.setAttribute('data-text-size', size);
}

/** Inline script for <head>: applies the stored size before the first paint (no jump). */
export const textSizeBootScript = `try{var v=localStorage.getItem('${KEY}');if(v==='large'||v==='xlarge')document.documentElement.setAttribute('data-text-size',v)}catch(e){}`;

export interface TextSizeControlProps {
  labels: { title: string; normal: string; large: string; xlarge: string; sample: string };
  tone?: 'light' | 'dark';
}

export function TextSizeControl({ labels, tone = 'light' }: TextSizeControlProps) {
  const name = useId();
  const [size, setSize] = useState<TextSize>('normal');

  useEffect(() => {
    setSize(readTextSize());
    const onChange = () => setSize(readTextSize());
    window.addEventListener('dp:text-size', onChange);
    return () => window.removeEventListener('dp:text-size', onChange);
  }, []);

  const choose = (value: TextSize) => {
    setSize(value);
    applyTextSize(value);
    try {
      if (value === 'normal') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {
      /* storage unavailable: the choice lasts for the page */
    }
    window.dispatchEvent(new Event('dp:text-size'));
  };

  const options: { value: TextSize; label: string; scale: string }[] = [
    { value: 'normal', label: labels.normal, scale: '0.875rem' },
    { value: 'large', label: labels.large, scale: '1rem' },
    { value: 'xlarge', label: labels.xlarge, scale: '1.125rem' },
  ];

  return (
    <fieldset className={[s.group, tone === 'dark' && s.onDark].filter(Boolean).join(' ')}>
      <legend className={s.legend}>{labels.title}</legend>
      <span className={s.options}>
        {options.map((o) => (
          <label key={o.value} className={s.option}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={size === o.value}
              onChange={() => choose(o.value)}
            />
            <span className={s.chip}>
              <span className={s.aa} style={{ fontSize: o.scale }} aria-hidden="true">
                {labels.sample}
              </span>
              {o.label}
            </span>
          </label>
        ))}
      </span>
    </fieldset>
  );
}
