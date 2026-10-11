// EP-29 — global error pages share one layout: the « Perdu » or « Attente » scene, a title, what to do next.
import type { ReactNode } from 'react';
import { Scene, type SceneName } from '@dp/ui';
import s from './ErrorPage.module.css';

export function ErrorPage({ title, scene = 'perdu', children }: { title: string; scene?: SceneName; children?: ReactNode }) {
  return (
    <section className={s.wrap}>
      <div className={`container ${s.grid}`}>
        <div className={s.content}>
          <h1 className={s.title}>{title}</h1>
          {children}
        </div>
        <Scene name={scene} className={s.scene} />
      </div>
    </section>
  );
}
