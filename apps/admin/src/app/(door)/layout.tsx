import type { ReactNode } from 'react';
import { DoorFrame } from '@/components/door/DoorFrame';

export default function DoorLayout({ children }: { children: ReactNode }) {
  return <DoorFrame>{children}</DoorFrame>;
}
