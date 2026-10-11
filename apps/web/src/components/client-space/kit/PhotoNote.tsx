'use client';
// FIC-012 — « Image d'illustration » / « Image 3D non contractuelle » on every photo that is one, on the cards of the
// space as on the pages of the site; the texts are the parameters `legal.illustrationNote` and `legal.render3dNote`.
import type { PublicImage } from '@dp/contracts';
import { useOptionalSpace } from '../SpaceContext';
import s from './kit.module.css';

export function PhotoNote({ image }: { image: PublicImage | null | undefined }) {
  const settings = useOptionalSpace()?.settings;
  if (!image || !settings) return null;
  const text = image.isIllustration ? settings.illustrationNote : image.isRender3d ? settings.render3dNote : '';
  return text ? <span className={s.photoNote}>{text}</span> : null;
}
