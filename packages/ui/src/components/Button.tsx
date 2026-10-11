// DSN-050 — Button: Primary (vitrine), Secondary, Tool, Tertiary, Danger; sizes L 52 / M 46 / S 36.
// A link that looks like a button is <ButtonLink>; a button acts, a link leads elsewhere.
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import s from './Button.module.css';

export type ButtonType = 'primary' | 'secondary' | 'tool' | 'tertiary' | 'danger';
export type ButtonSize = 'L' | 'M' | 'S';

interface Common {
  variant?: ButtonType;
  size?: ButtonSize;
  icon?: IconName;
  /** Chevron after the label (never on size S). */
  chevron?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function buttonClass(variant: ButtonType, size: ButtonSize, fullWidth?: boolean, pending?: boolean, extra?: string) {
  return [s.button, s[variant], s[size], fullWidth && s.full, pending && s.pending, extra].filter(Boolean).join(' ');
}

export function ButtonInner({ icon, chevron, size, children }: Pick<Common, 'icon' | 'chevron' | 'size' | 'children'>) {
  return (
    <>
      <span className={s.label}>
        {icon ? <Icon name={icon} size={20} /> : null}
        {children}
        {chevron && size !== 'S' ? <Icon name="chevron-right" size={16} className={s.chevron} /> : null}
      </span>
      <span className={s.spinner} aria-hidden="true" />
    </>
  );
}

export interface ButtonProps extends Common, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  pending?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'L',
  icon,
  chevron,
  fullWidth,
  pending,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, fullWidth, pending, className)}
      aria-busy={pending || undefined}
      {...rest}
    >
      <ButtonInner icon={icon} chevron={chevron} size={size}>
        {children}
      </ButtonInner>
    </button>
  );
}

/** Plain anchor styled as a button. Router links use buttonClass() + ButtonInner (the ui package does not depend on Next). */
export type ButtonLinkProps = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>;

export function ButtonLink({
  variant = 'primary',
  size = 'L',
  icon,
  chevron,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const props = { className: buttonClass(variant, size, fullWidth, false, className), ...rest };
  const inner = (
    <ButtonInner icon={icon} chevron={chevron} size={size}>
      {children}
    </ButtonInner>
  );
  return <a {...props}>{inner}</a>;
}
