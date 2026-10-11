// TRV-145 — the advisor's photo, else his initials in a medallion; without advisor, the team's mark.
import type { AdvisorCard } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { initialsOf } from './texts';
import s from './dashboard/dashboard.module.css';

export function Avatar({ advisor, size = 'L' }: { advisor: AdvisorCard | null; size?: 'L' | 'M' }) {
  return (
    <span className={`${s.avatar} ${size === 'M' ? s.avatarM : ''}`} aria-hidden="true">
      {advisor?.photo ? <Picture image={advisor.photo} sizes="64px" alt="" className={s.avatarImg} /> : advisor ? initialsOf(advisor) : <Icon name="partners" size={24} />}
    </span>
  );
}

