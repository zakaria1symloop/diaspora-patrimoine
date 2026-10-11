// BO-015 — an address that does not exist keeps the frame of the back office: « Cet élément est introuvable. »
import { notFound } from 'next/navigation';

export default function Page() {
  notFound();
}
