// MED-016, MED-022, TRV-133 — responsive images from the media renditions: AVIF › WebP › JPEG, place reserved,
// blurred preview while loading, lazy below the first screen.
import type { PublicImage } from '@dp/contracts';

const WIDTHS: Record<string, number> = { thumb: 320, card: 640, large: 1280, xl: 1920 };
const MIME: Record<string, string> = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg' };

export interface PictureProps {
  image: PublicImage;
  sizes: string;
  className?: string;
  priority?: boolean;
  /** Override the alt (decorative image: ''). */
  alt?: string;
}

export function Picture({ image, sizes, className, priority, alt }: PictureProps) {
  const names = image.renditions.filter((r) => r in WIDTHS).sort((a, b) => WIDTHS[a]! - WIDTHS[b]!);
  const srcset = (format: string) => names.map((n) => `${image.base}/${n}.${format} ${WIDTHS[n]}w`).join(', ');
  const formats = ['avif', 'webp', 'jpg'].filter((f) => image.formats.includes(f));
  const fallback = formats.includes('jpg') ? 'jpg' : formats[formats.length - 1] ?? 'jpg';
  const largest = names[names.length - 1] ?? 'card';
  return (
    <picture>
      {formats
        .filter((f) => f !== fallback)
        .map((f) => (
          <source key={f} type={MIME[f]} srcSet={srcset(f)} sizes={sizes} />
        ))}
      <img
        src={`${image.base}/${largest}.${fallback}`}
        srcSet={srcset(fallback)}
        sizes={sizes}
        alt={alt ?? image.alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        className={className}
        style={image.blur ? { backgroundImage: `url(${image.blur})`, backgroundSize: 'cover' } : undefined}
      />
    </picture>
  );
}
