'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Box, ChevronRight, Edit3, FolderTree, MapPin, Plus, Trash2, X } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import ConfirmModal from '@/components/ConfirmModal';
import type { ComponentRecord, LocationRecord, LocationType } from '@/lib/types';
import { LOCATION_TYPES } from '@/lib/types';
import Link from 'next/link';

const blank = { name: '', type: 'cabinet' as LocationType, code: '', parentId: '', notes: '', sortOrder: 0 };

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [components, setComponents] = useState<ComponentRecord[]>([]);
  const [selected, setSelected] = useState<LocationRecord | null>(null);
  const [editing, setEditing] = useState<LocationRecord | null>(null);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LocationRecord | null>(null);

  const modalRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const load = useCallback(() => {
    return Promise.all([
      fetch('/api/locations').then(async r => {
        if (!r.ok) throw new Error('Failed to load locations.');
        return r.json() as Promise<LocationRecord[]>;
      }),
      fetch('/api/components').then(async r => {
        if (!r.ok) throw new Error('Failed to load components.');
        return r.json() as Promise<ComponentRecord[]>;
      }),
    ])
      .then(([l, c]) => {
        setLocations(l);
        setComponents(c);
        setLoading(false);
        setError(null);
        setSelected(prev => (prev ? l.find(x => x.id === prev.id) || null : null));
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Unable to load location data.');
        setLoading(false);
      });
  }, []);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    load();
  }, [load]);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      fetch('/api/locations').then(async r => {
        if (!r.ok) throw new Error('Failed to load locations.');
        return r.json() as Promise<LocationRecord[]>;
      }),
      fetch('/api/components').then(async r => {
        if (!r.ok) throw new Error('Failed to load components.');
        return r.json() as Promise<ComponentRecord[]>;
      }),
    ])
      .then(([l, c]) => {
        if (!ignore) {
          setLocations(l);
          setComponents(c);
          setLoading(false);
          setError(null);
          setSelected(prev => (prev ? l.find(x => x.id === prev.id) || null : null));
        }
      })
      .catch(err => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Unable to load location data.');
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [open]);

  const ordered = useMemo(() => [...locations].sort((a, b) => a.path.localeCompare(b.path)), [locations]);
  const contents = selected ? components.filter(c => c.placements.some(p => p.locationId === selected.id)) : [];

  function start(parentId = '') {
    setEditing(null);
    setForm({ ...blank, parentId });
    setMessage('');
    setOpen(true);
  }

  function edit(l: LocationRecord) {
    setEditing(l);
    setForm({ name: l.name, type: l.type, code: l.code, parentId: l.parentId || '', notes: l.notes, sortOrder: l.sortOrder });
    setMessage('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/locations/${editing.id}` : '/api/locations';
    try {
      const r = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, parentId: form.parentId || null, sortOrder: Number(form.sortOrder) }),
      });
      const data = (await r.json()) as LocationRecord & { error?: string };
      if (!r.ok) {
        setMessage(data.error || 'Unable to save location.');
        return;
      }
      setOpen(false);
      await load();
      setSelected(data);
    } catch {
      setMessage('Network error while saving location.');
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    const l = confirmDelete;
    setConfirmDelete(null);
    try {
      const r = await fetch(`/api/locations/${l.id}`, { method: 'DELETE' });
      if (!r.ok) {
        setMessage(((await r.json()) as { error: string }).error);
        return;
      }
      if (selected?.id === l.id) setSelected(null);
      await load();
    } catch {
      setMessage('Network error while deleting location.');
    }
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <div className="page-wrap">
        <div className="page-title-row">
          <div>
            <p className="kicker">PHYSICAL STORAGE</p>
            <h1>Locations</h1>
            <p>Map rooms, cabinets, drawers, and bins into one clear hierarchy.</p>
          </div>
          <button className="button primary" aria-label="Add location" onClick={() => start()}>
            <Plus size={17} />
            <span className="button-text">Add location</span>
          </button>
        </div>

        {error && (
          <div
            className="notice"
            role="alert"
            aria-live="polite"
            style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
            <button type="button" className="button" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleRetry}>
              Retry
            </button>
          </div>
        )}

        {message && (
          <div className="notice" role="status" aria-live="polite" style={{ marginBottom: '20px' }}>
            {message}
          </div>
        )}

        <div className="location-layout">
          <section className="panel tree-panel">
            <div className="panel-heading">
              <div>
                <h2>Storage map</h2>
                <span>{loading ? 'Loading…' : `${locations.length} locations`}</span>
              </div>
            </div>
            {ordered.length === 0 ? (
              <div className="empty-state compact">
                <span><FolderTree size={26} /></span>
                <h3>{loading ? 'Loading locations…' : 'No locations yet'}</h3>
                <p>{loading ? 'Please wait while storage data loads.' : 'Create a room, cabinet, drawer, or bin to get started.'}</p>
                {!loading && (
                  <button className="button" onClick={() => start()}>
                    <Plus size={15} /> Create location
                  </button>
                )}
              </div>
            ) : (
              <div className="tree-list">
                {ordered.map(l => {
                  const depth = Math.max(0, l.path.split(' → ').length - 1);
                  return (
                    <button
                      className={`tree-row ${selected?.id === l.id ? 'selected' : ''}`}
                      style={{ paddingLeft: 14 + depth * 22 }}
                      onClick={() => setSelected(l)}
                      key={l.id}
                    >
                      <span className={`type-icon ${l.type}`}><Box size={16} /></span>
                      <span>
                        <strong>{l.name}</strong>
                        <small>{l.type}{l.code ? ` · ${l.code}` : ''}</small>
                      </span>
                      <em>{l.componentCount}</em>
                      <ChevronRight size={16} />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel location-detail">
            {selected ? (
              <>
                <div className="detail-header">
                  <div>
                    <span className="type-pill">{selected.type}</span>
                    <h2>{selected.name}</h2>
                    <p><MapPin size={14} />{selected.path}</p>
                  </div>
                  <div>
                    <button className="icon-button" aria-label="Edit location" onClick={() => edit(selected)}>
                      <Edit3 size={17} />
                    </button>
                    <button className="icon-button danger-icon" aria-label="Delete location" onClick={() => setConfirmDelete(selected)}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                {selected.notes && <p className="detail-notes">{selected.notes}</p>}
                <div className="detail-metrics">
                  <div>
                    <strong>{selected.childCount}</strong>
                    <span>child locations</span>
                  </div>
                  <div>
                    <strong>{selected.componentCount}</strong>
                    <span>components here</span>
                  </div>
                </div>
                <div className="contents-head">
                  <h3>Contents</h3>
                  <button className="button" onClick={() => start(selected.id)}>
                    <Plus size={15} /> Add child
                  </button>
                </div>
                {contents.length ? (
                  <div className="contents-list">
                    {contents.map(c => {
                      const p = c.placements.find(x => x.locationId === selected.id)!;
                      return (
                        <Link href={`/components/${c.id}`} key={c.id}>
                          <span className="mini-thumb">
                            {c.imageUrl ? (
                              <img src={c.imageUrl} alt={`Photo of ${c.name}`} />
                            ) : (
                              <Box size={18} />
                            )}
                          </span>
                          <span>
                            <strong>{c.name}</strong>
                            <small>{c.category || 'Uncategorized'}</small>
                          </span>
                          <em>{p.quantity} {p.unit}</em>
                          <ChevronRight size={16} />
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="inline-empty large">No components are stored directly in this location.</div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <span><MapPin size={27} /></span>
                <h3>Select a location</h3>
                <p>Choose a location to see its contents and child locations.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <form
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-modal-title"
            onSubmit={save}
          >
            <div className="modal-head">
              <div>
                <p className="kicker">{editing ? 'EDIT LOCATION' : 'NEW LOCATION'}</p>
                <h2 id="location-modal-title">{editing ? editing.name : 'Add storage location'}</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setOpen(false)}>
                <X size={19} />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Name<span>*</span>
                <input
                  autoFocus
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Cabinet A"
                />
              </label>
              <label>
                Type
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as LocationType })}
                >
                  {LOCATION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>
                Parent
                <select
                  value={form.parentId}
                  onChange={e => setForm({ ...form, parentId: e.target.value })}
                >
                  <option value="">Top level</option>
                  {locations.filter(l => l.id !== editing?.id).map(l => (
                    <option value={l.id} key={l.id}>{l.path}</option>
                  ))}
                </select>
              </label>
              <label>
                Code
                <input
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="A-01"
                />
              </label>
              <label className="span-2">
                Notes
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional description…"
                />
              </label>
            </div>
            {message && <div className="notice" role="status" aria-live="polite">{message}</div>}
            <div className="form-actions">
              <button type="button" className="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary">
                {editing ? 'Save changes' : 'Create location'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        title="Delete Location"
        message={`Delete "${confirmDelete?.path}"? Locations cannot be deleted while they contain stored components or child locations.`}
        confirmText="Delete location"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </main>
  );
}

