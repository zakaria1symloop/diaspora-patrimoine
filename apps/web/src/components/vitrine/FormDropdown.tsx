'use client';
// The site's choice list (Dropdown) inside an ordinary form sent by its button: the chosen value travels in a hidden
// field named `name`, so the page reads it from its address like any other field (promoter filters, EDI-030).
import { useState } from 'react';
import { Dropdown, type DropdownGroup } from './Dropdown';

export function FormDropdown({
  id,
  name,
  defaultValue,
  groups,
  labelledBy,
  className,
}: {
  id: string;
  name: string;
  defaultValue: string;
  groups: DropdownGroup[];
  labelledBy: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <Dropdown id={id} value={value} groups={groups} onChange={setValue} labelledBy={labelledBy} className={className} />
      {value ? <input type="hidden" name={name} value={value} /> : null}
    </>
  );
}
