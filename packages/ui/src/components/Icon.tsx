// DSN-040 — two-tone icons from the Figma library; colour follows the container (currentColor, --icon-accent).
import { icons, type IconName } from '../icons/icons.generated';

export interface IconProps {
  name: IconName;
  size?: 16 | 20 | 24 | 32;
  /** Accessible name. Without it the icon is decorative (aria-hidden). */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 24, label, className }: IconProps) {
  const icon = icons[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill="none"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}

export type { IconName };
