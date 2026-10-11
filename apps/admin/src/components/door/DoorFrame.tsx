// EA-00, D-091 … D-093 — the door of the back office: its own entrance, apart from the public site and the client
// space. A single-task page is never a bare white page: the form sits beside a drawn scene (DSN-076), on the night
// blue of the tool. The wordmark is the brand's only gold here (DSN: « L'or n'y sert qu'à la marque »).
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Scene } from '@dp/ui';
import wordmarkDark from '@dp/ui/assets/wordmark-dark.svg';
import logo from '@dp/ui/assets/logo.png';
import { t } from '@/lib/i18n';
import s from './door.module.css';

export function DoorFrame({ children }: { children: ReactNode }) {
  return (
    <div className={s.page}>
      <main className={s.main} id="contenu">
        <div className={s.card}>{children}</div>
        <p className={s.secure}>{t('ui.admin-shell.door.secure')}</p>
      </main>
      <aside className={s.aside} aria-hidden="true">
        <div className={s.brand}>
          <Image src={logo} alt="" className={s.logo} sizes="56px" priority />
          <Image src={wordmarkDark} alt="" className={s.wordmark} unoptimized priority />
        </div>
        <div className={s.sceneWrap}>
          <Scene name="acces" className={s.scene} />
        </div>
        <p className={s.asideTitle}>{t('ui.admin-shell.door.asideTitle')}</p>
        <p className={s.asideText}>{t('ui.admin-shell.door.asideText')}</p>
      </aside>
    </div>
  );
}

/** The visible title of a door page (TRV-124: every page says where one is). */
export function DoorHeading({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: ReactNode }) {
  return (
    <header className={s.heading}>
      {eyebrow ? <p className={s.eyebrow}>{eyebrow}</p> : null}
      <h1 className={s.title}>{title}</h1>
      {intro ? <p className={s.intro}>{intro}</p> : null}
    </header>
  );
}
