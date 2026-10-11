'use client';
// EA-45 — the lot import of a programme (CTL-100 … CTL-102), in four steps that read as a path: 1. the programme and the
// file (with the two templates), 2. the mapping of the file's columns (proposed, modifiable), 3. the dry run — nothing
// written: « {n} lots à créer · {m} à mettre à jour · {k} typologies à créer · {s} lignes signalées · {e} lignes en
// erreur », the lots absent from the file, the detail by line and its CSV — then « Confirmer l'import », 4. the result:
// the import replays every check on the state of the moment and its report is authoritative. Below: the last imports.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { IMPORT_COLUMNS, type ImportColumn, type ImportIssue, type ImportJobList, type ImportJobView } from '@dp/contracts';
import { type MessageKey } from '@dp/i18n';
import { Button, DataTable, EmptyState, Icon, SkeletonRows, StatusTag, sha256Hex } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { shortDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { PageHeader, Surface } from '../shell/Page';
import { SelectInput } from '../shell/forms';
import { useShell } from '../shell/ShellContext';
import { useCatalogueReference } from '../catalogue/reference';
import { catalogueStyles as cs, FailureBanner, LinkButton, tableLabels, useCall } from '../catalogue/parts';
import s from './import.module.css';

const STEPS = ['file', 'mapping', 'check', 'done'] as const;

export function issueText(i: ImportIssue): string {
  const raison = i.params.raison ? t(`ui.admin-media.import.issue.${i.params.raison}` as MessageKey) : '';
  return t(`ui.admin-media.import.issue.${i.code}` as MessageKey, { ...i.params, raison });
}

export function LotImport() {
  const router = useRouter();
  const search = useSearchParams();
  const { timeZone } = useShell();
  const ref = useCatalogueReference();
  const [programId, setProgramId] = useState(search.get('programme') ?? '');
  const [job, setJob] = useState<ImportJobView | null>(null);
  const [mapping, setMapping] = useState<Record<string, ImportColumn | null>>({});
  const [history, setHistory] = useState<ImportJobList['data'] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const call = useCall();

  const loadHistory = useCallback(() => adminCall<ImportJobList>('/admin/imports', { query: programId ? { programId } : {} }).then((r) => r.ok && setHistory(r.data.data)), [programId]);
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);
  // A job asked by the address (the notification « Import terminé » leads here).
  useEffect(() => {
    const asked = search.get('import');
    if (asked) void adminCall<ImportJobView>(`/admin/imports/${asked}`).then((r) => r.ok && (setJob(r.data), setMapping(r.data.mapping), setProgramId(r.data.programId)));
  }, [search]);
  // While the import runs, its state is read again.
  useEffect(() => {
    if (job?.status !== 'RUNNING') return;
    const timer = setInterval(() => {
      void adminCall<ImportJobView>(`/admin/imports/${job.id}`).then((r) => {
        if (r.ok && r.data.status !== 'RUNNING') {
          setJob(r.data);
          void loadHistory();
        }
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [job, loadHistory]);

  const step = !job ? 'file' : job.status === 'PENDING' && job.dryRun ? (job.counters ? 'check' : 'mapping') : 'done';
  const programs = (ref?.programs ?? []).filter((p) => p.publication !== 'ARCHIVED');

  async function send(file: File) {
    setUploadError(null);
    setUploading(true);
    const sha256 = await sha256Hex(await file.arrayBuffer());
    const announced = await adminCall<{ id: string; uploadUrl: string }>('/admin/imports/uploads', { body: { fileName: file.name, contentType: file.type || 'text/csv', size: file.size, sha256 } });
    if (!announced.ok) {
      setUploading(false);
      return setUploadError(errorText(announced));
    }
    const put = await fetch(announced.data.uploadUrl, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/octet-stream', 'X-CSRF-Token': document.cookie.match(/(?:^|; )dp_admin_csrf=([^;]*)/)?.[1] ?? '' },
      body: file,
    }).catch(() => null);
    if (!put || !put.ok) {
      setUploading(false);
      return setUploadError(errorText({ status: put?.status ?? 0, offline: !put }));
    }
    const created = await adminCall<ImportJobView>('/admin/imports', { body: { uploadId: announced.data.id, programId } });
    setUploading(false);
    if (!created.ok) return setUploadError(errorText(created));
    setJob(created.data);
    setMapping(created.data.mapping);
  }

  async function dryRun() {
    const r = await call.run(() => adminCall<ImportJobView>(`/admin/imports/${job!.id}/dry-run`, { body: { mapping } }), t('ui.admin-media.import.toast.checked'));
    if (r) setJob(r);
  }
  async function confirm() {
    const r = await call.run(() => adminCall<ImportJobView>(`/admin/imports/${job!.id}/confirm`, { method: 'POST' }), t('ui.admin-media.import.toast.confirmed'));
    if (r) setJob(r);
  }
  const again = () => {
    setJob(null);
    setMapping({});
    router.replace(programId ? `/catalogue/import?programme=${programId}` : '/catalogue/import');
  };

  const fed = new Set(Object.values(mapping).filter(Boolean));
  const mappingOk = (['lot', 'surface', 'prix'] as const).every((c) => fed.has(c)) && (fed.has('bien') || fed.has('type'));
  const c = job?.counters;

  return (
    <div className={cs.createPage}>
      <PageHeader title={t('ui.admin-media.import.title')} crumbs={[{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-media.import.title') }]} intro={t('ui.admin-media.import.intro')} />

      <ol className={s.steps} aria-label={t('ui.admin-media.import.title')}>
        {STEPS.map((x, i) => (
          <li key={x} data-state={x === step ? 'current' : STEPS.indexOf(step) > i ? 'done' : 'todo'} aria-current={x === step ? 'step' : undefined}>
            <span className={s.stepDot}>{STEPS.indexOf(step) > i ? <Icon name="check" size={16} /> : i + 1}</span>
            {t(`ui.admin-media.import.steps.${x}`)}
          </li>
        ))}
      </ol>

      <FailureBanner failure={call.failure} />

      {step === 'file' ? (
        <Surface title={t('ui.admin-media.import.steps.file')}>
          <div className={s.fileStep}>
            <SelectInput label={t('ui.admin-media.import.program')} value={programId} onChange={(e) => setProgramId(e.target.value)}>
              <option value="" disabled>
                {t('ui.admin-media.import.programPlaceholder')}
              </option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectInput>
            <div className={s.drop} data-disabled={!programId ? '1' : undefined}>
              <Icon name={uploading ? 'spinner' : 'upload'} size={24} />
              <div className={cs.nameText}>
                <strong>{t('ui.admin-media.import.file')}</strong>
                <span className={cs.sub}>{t('ui.admin-media.import.fileHint')}</span>
                {uploadError ? <span className={s.error}>{uploadError}</span> : null}
              </div>
              <Button variant="tool" size="M" icon="upload" disabled={!programId || uploading} pending={uploading} onClick={() => input.current?.click()}>
                {t('ui.admin-media.import.choose')}
              </Button>
              <input ref={input} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => e.target.files?.[0] && void send(e.target.files[0]).then(() => (e.target.value = ''))} />
            </div>
            <div className={s.templates}>
              <span className={cs.muted}>{t('ui.admin-media.import.templates')}</span>
              <a className={s.templateLink} href="/api/v1/admin/imports/template.xlsx" download>
                <Icon name="download" size={16} />
                {t('ui.admin-media.import.templateXlsx')}
              </a>
              <a className={s.templateLink} href="/api/v1/admin/imports/template.csv" download>
                <Icon name="download" size={16} />
                {t('ui.admin-media.import.templateCsv')}
              </a>
            </div>
          </div>
        </Surface>
      ) : null}

      {step === 'mapping' && job ? (
        <Surface title={t('ui.admin-media.import.mapping.title')}>
          <div className={s.fileStep}>
            <p className={cs.muted}>
              {job.programName} · {job.fileName} — {t('ui.admin-media.import.mapping.intro')}
            </p>
            <table className={cs.miniTable}>
              <thead>
                <tr>
                  <th>{t('ui.admin-media.import.mapping.header')}</th>
                  <th>{t('ui.admin-media.import.mapping.field')}</th>
                </tr>
              </thead>
              <tbody>
                {job.headers.filter(Boolean).map((h) => (
                  <tr key={h}>
                    <td>
                      <code>{h}</code>
                    </td>
                    <td>
                      <select className={cs.cellInput} style={{ maxWidth: '18rem' }} value={mapping[h] ?? ''} aria-label={h} onChange={(e) => setMapping((m) => ({ ...m, [h]: (e.target.value || null) as ImportColumn | null }))}>
                        <option value="">{t('ui.admin-media.import.mapping.ignore')}</option>
                        {IMPORT_COLUMNS.map((col) => (
                          <option key={col} value={col} disabled={fed.has(col) && mapping[h] !== col}>
                            {t(`ui.admin-media.import.field.${col}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!mappingOk ? <p className={`${cs.notice} ${cs.noticeWarn}`}>{t('ui.admin-media.import.mapping.required')}</p> : null}
            <div className={cs.toolbar}>
              <Button variant="tool" size="M" icon="search" disabled={!mappingOk} pending={call.pending} onClick={() => void dryRun()}>
                {t('ui.admin-media.import.mapping.submit')}
              </Button>
              <Button variant="secondary" size="M" onClick={again}>
                {t('ui.common.cancel')}
              </Button>
            </div>
          </div>
        </Surface>
      ) : null}

      {(step === 'check' || step === 'done') && job && c ? (
        <Surface title={step === 'check' ? t('ui.admin-media.import.check.title') : job.status === 'RUNNING' ? t('ui.admin-media.import.done.running') : job.status === 'FAILED' ? t('ui.admin-media.import.done.failed') : t('ui.admin-media.import.done.title')}>
          <div className={s.fileStep}>
            <div className={s.figures}>
              {[
                [c.toCreate, step === 'check' ? 'toCreate' : 'created'],
                [c.toUpdate, step === 'check' ? 'toUpdate' : 'updated'],
                [c.typologiesToCreate, 'typologies'],
                [c.flagged, 'flagged'],
                [c.errors, 'errors'],
              ].map(([n, k]) => (
                <div key={k as string} className={s.figure} data-tone={k === 'errors' && Number(n) > 0 ? 'error' : k === 'flagged' && Number(n) > 0 ? 'warn' : undefined}>
                  <strong>{n}</strong>
                  <span>{t(`ui.admin-media.import.figure.${k as 'created'}`)}</span>
                </div>
              ))}
            </div>
            <p className={cs.muted}>
              {job.programName} · {job.fileName} · {t('ui.admin-media.import.check.absent', { a: c.absent })}
            </p>
            {step === 'check' ? (
              <div className={cs.toolbar}>
                <Button variant="tool" size="M" icon="check" disabled={!job.canConfirm} pending={call.pending} onClick={() => void confirm()}>
                  {t('ui.admin-media.import.check.confirm')}
                </Button>
                <Button variant="secondary" size="M" onClick={() => setJob({ ...job, counters: null })}>
                  {t('ui.admin-media.import.check.back')}
                </Button>
                <span className={cs.sub}>{job.canConfirm ? t('ui.admin-media.import.check.confirmHint') : t('ui.admin-media.import.check.nothing')}</span>
              </div>
            ) : job.status !== 'RUNNING' ? (
              <div className={cs.toolbar}>
                <LinkButton href={`/catalogue/programmes/${job.programId}?onglet=lots`} icon="arrow-right">
                  {t('ui.admin-media.import.done.openProgram')}
                </LinkButton>
                <Button variant="secondary" size="M" onClick={again}>
                  {t('ui.admin-media.import.done.again')}
                </Button>
              </div>
            ) : (
              <SkeletonRows rows={2} label={t('ui.admin-media.import.done.running')} />
            )}
            <div className={cs.tableHead}>
              <h3 className={cs.subTitle}>{t('ui.admin-media.import.check.issues')}</h3>
              {job.issues.length ? (
                <a className={s.templateLink} href={`/api/v1/admin/imports/${job.id}/issues.csv`} download>
                  <Icon name="download" size={16} />
                  {t('ui.admin-media.import.check.download')}
                </a>
              ) : null}
            </div>
            {job.issues.length === 0 ? (
              <p className={cs.ok}>
                <Icon name="status-success" size={16} />
                {t('ui.admin-media.import.check.noIssue')}
              </p>
            ) : (
              <DataTable<ImportIssue & { key: string }>
                rows={job.issues.map((i, n) => ({ ...i, key: `${i.line}-${i.column}-${n}` }))}
                rowId={(i) => i.key}
                rowLabel={(i) => String(i.line)}
                labels={tableLabels(t('ui.admin-media.import.check.issues'))}
                columns={[
                  { key: 'line', header: t('ui.admin-media.import.check.line'), width: '6rem', align: 'end', cell: (i) => <span className={cs.num}>{i.line}</span> },
                  { key: 'column', header: t('ui.admin-media.import.check.column'), width: '9rem', cell: (i) => (i.column ? <code>{i.column}</code> : '—') },
                  { key: 'level', header: t('ui.admin-media.import.check.level'), width: '9rem', cell: (i) => <StatusTag tone={i.level === 'ERROR' ? 'error' : 'warning'}>{t(`ui.admin-media.import.check.${i.level}`)}</StatusTag> },
                  { key: 'message', header: t('ui.admin-media.import.check.message'), cell: (i) => issueText(i), text: (i) => issueText(i) },
                ]}
              />
            )}
          </div>
        </Surface>
      ) : null}

      <Surface title={t('ui.admin-media.import.history.title')}>
        {!history ? (
          <SkeletonRows rows={2} label={t('ui.common.loading')} />
        ) : history.length === 0 ? (
          <EmptyState icon="upload" title={t('ui.admin-media.import.history.empty')} compact />
        ) : (
          <ul className={s.history}>
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/catalogue/import?import=${h.id}`} className={cs.nameLink}>
                  {h.fileName}
                </Link>
                <span className={cs.sub}>
                  {h.programName} · {shortDateTime(h.createdAt, timeZone)}
                  {h.author ? ` · ${h.author}` : ''}
                </span>
                <StatusTag tone={h.status === 'DONE' ? 'success' : h.status === 'FAILED' ? 'error' : 'neutral'}>{h.dryRun ? t('ui.admin-media.import.history.dryRun') : t('ui.admin-media.import.history.executed')}</StatusTag>
                {h.counters ? <span className={cs.sub}>{t(h.dryRun ? 'ui.admin-media.import.check.summary' : 'ui.admin-media.import.done.summary', { c: h.counters.toCreate, u: h.counters.toUpdate, k: h.counters.typologiesToCreate, s: h.counters.flagged, e: h.counters.errors })}</span> : <span />}
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}
