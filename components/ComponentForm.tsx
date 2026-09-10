'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Camera, Plus, Save, Trash2, X } from 'lucide-react';
import type { ComponentRecord, LocationRecord, Specification } from '@/lib/types';
import AppHeader from './AppHeader';
import ConfirmModal from './ConfirmModal';
import Link from 'next/link';

const empty = {
  name: '',
  category: '',
  aliases: '',
  manufacturer: '',
  partNumber: '',
  specifications: [] as Specification[],
  notes: '',
};

export default function ComponentForm({ id }: { id?: string }) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [item, setItem] = useState<ComponentRecord | null>(null);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [place, setPlace] = useState({ locationId: '', quantity: '0', unit: 'pcs' });
  const [confirmDeleteComponent, setConfirmDeleteComponent] = useState(false);
  const [placementToDelete, setPlacementToDelete] = useState<string | null>(null);

  const loadData = useCallback(() => {
    let ignore = false;
    const promises: Promise<unknown>[] = [
      fetch('/api/locations')
        .then(async r => {
          if (!r.ok) throw new Error('Failed to load locations.');
          return r.json() as Promise<LocationRecord[]>;
        })
        .then(data => {
          if (!ignore) setLocations(data);
        }),
    ];

    if (id) {
      promises.push(
        fetch(`/api/components/${id}`)
          .then(async r => {
            if (!r.ok) throw new Error('Failed to load component details.');
            return r.json() as Promise<ComponentRecord>;
          })
          .then(data => {
            if (!ignore) {
              setItem(data);
              setForm({
                name: data.name,
                category: data.category,
                aliases: data.aliases.join(', '),
                manufacturer: data.manufacturer,
                partNumber: data.partNumber,
                specifications: data.specifications,
                notes: data.notes,
              });
              setLoading(false);
              setLoadError(null);
            }
          })
      );
    }

    Promise.all(promises).catch(err => {
      if (!ignore) {
        setLoadError(err instanceof Error ? err.message : 'Unable to load component data.');
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [id]);

  const handleRetry = useCallback(() => {
    setLoadError(null);
    if (id) setLoading(true);
    loadData();
  }, [id, loadData]);

  useEffect(() => {
    return loadData();
  }, [loadData]);

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const payload = {
      ...form,
      aliases: form.aliases.split(',').map(x => x.trim()).filter(Boolean),
      specifications: form.specifications.filter(x => x.key.trim()),
    };
    try {
      const r = await fetch(id ? `/api/components/${id}` : '/api/components', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await r.json()) as ComponentRecord & { error?: string };
      setSaving(false);
      if (!r.ok) {
        setMessage(data.error || 'Unable to save component.');
        return;
      }
      if (!id) router.push(`/components/${data.id}`);
      else {
        setItem(data);
        setMessage('Changes saved.');
      }
    } catch {
      setSaving(false);
      setMessage('Network error while saving component.');
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!id || !e.target.files?.[0]) return;
    const fd = new FormData();
    fd.append('image', e.target.files[0]);
    try {
      const r = await fetch(`/api/upload/${id}`, { method: 'POST', body: fd });
      const data = (await r.json()) as ComponentRecord & { error?: string };
      if (r.ok) setItem(data);
      else setMessage(data.error || 'Upload failed.');
    } catch {
      setMessage('Network error while uploading photo.');
    }
  }

  async function addPlacement(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      const r = await fetch('/api/placements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: id,
          locationId: place.locationId,
          quantity: Number(place.quantity),
          unit: place.unit,
        }),
      });
      const data = (await r.json()) as { error?: string };
      if (r.ok) {
        const fresh = await fetch(`/api/components/${id}`).then(x => x.json() as Promise<ComponentRecord>);
        setItem(fresh);
        setPlace({ locationId: '', quantity: '0', unit: 'pcs' });
      } else setMessage(data.error || 'Unable to update placement.');
    } catch {
      setMessage('Network error while updating placement.');
    }
  }

  async function handleConfirmDeletePlacement() {
    if (!placementToDelete || !id) return;
    const pid = placementToDelete;
    setPlacementToDelete(null);
    try {
      const r = await fetch(`/api/placements/${pid}`, { method: 'DELETE' });
      if (!r.ok) {
        setMessage('Failed to remove placement.');
        return;
      }
      const fresh = await fetch(`/api/components/${id}`).then(x => x.json() as Promise<ComponentRecord>);
      setItem(fresh);
    } catch {
      setMessage('Network error while removing placement.');
    }
  }

  async function handleConfirmDeleteComponent() {
    setConfirmDeleteComponent(false);
    if (!id) return;
    try {
      const r = await fetch(`/api/components/${id}`, { method: 'DELETE' });
      if (r.ok) router.push('/');
      else setMessage(((await r.json()) as { error: string }).error || 'Failed to delete component.');
    } catch {
      setMessage('Network error while deleting component.');
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <AppHeader />
        <div className="loading-state" style={{ flexDirection: 'column', gap: '14px' }}>
          {loadError ? (
            <div
              className="notice"
              role="alert"
              aria-live="polite"
              style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <AlertCircle size={18} />
              <span>{loadError}</span>
              <button type="button" className="button" onClick={handleRetry}>
                Retry
              </button>
            </div>
          ) : (
            'Loading component…'
          )}
        </div>
      </main>
    );
  }

  if (id && !item && loadError) {
    return (
      <main className="app-shell">
        <AppHeader />
        <div className="page-wrap narrow">
          <Link className="back-link" href="/">
            <ArrowLeft size={16} /> Inventory
          </Link>
          <div className="empty-state">
            <span><AlertCircle size={28} /></span>
            <h3>Unable to load component</h3>
            <p>{loadError}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="button primary" onClick={handleRetry}>
                Retry
              </button>
              <Link className="button" href="/">
                Back to Inventory
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <div className="page-wrap narrow">
        <Link className="back-link" href="/">
          <ArrowLeft size={16} /> Inventory
        </Link>
        <div className="page-title-row">
          <div>
            <p className="kicker">{id ? 'COMPONENT RECORD' : 'NEW COMPONENT'}</p>
            <h1>{id ? item?.name : 'Add a component'}</h1>
            <p>{id ? 'Edit its identity, photo, and physical locations.' : 'Create a searchable record for any part or supply.'}</p>
          </div>
          {id && (
            <button
              type="button"
              className="button danger"
              onClick={() => setConfirmDeleteComponent(true)}
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>

        {loadError && (
          <div
            className="notice"
            role="alert"
            aria-live="polite"
            style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={17} />
              <span>{loadError}</span>
            </div>
            <button type="button" className="button" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleRetry}>
              Retry
            </button>
          </div>
        )}

        <div className="editor-grid">
          <form className="panel form-panel" onSubmit={save}>
            <div className="form-grid">
              <label className="span-2">
                Name<span>*</span>
                <input
                  required
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. ESP32 DevKit V1"
                />
              </label>
              <label>
                Category
                <input
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  placeholder="Electronics"
                />
              </label>
              <label>
                Part number
                <input
                  value={form.partNumber}
                  onChange={e => set('partNumber', e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label>
                Manufacturer
                <input
                  value={form.manufacturer}
                  onChange={e => set('manufacturer', e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label>
                Aliases
                <input
                  value={form.aliases}
                  onChange={e => set('aliases', e.target.value)}
                  placeholder="esp, dev board"
                />
                <small>Separate aliases with commas.</small>
              </label>
            </div>

            <div className="form-section-head">
              <div>
                <h3>Specifications</h3>
                <p>Add any details people might search for.</p>
              </div>
              <button
                type="button"
                className="button"
                onClick={() => set('specifications', [...form.specifications, { key: '', value: '' }])}
              >
                <Plus size={15} /> Add field
              </button>
            </div>

            <div className="spec-list">
              {form.specifications.length === 0 && (
                <div className="inline-empty">No specifications yet.</div>
              )}
              {form.specifications.map((spec, i) => (
                <div className="spec-row" key={i}>
                  <input
                    aria-label="Specification name"
                    value={spec.key}
                    placeholder="Voltage"
                    onChange={e => {
                      const next = [...form.specifications];
                      next[i] = { ...spec, key: e.target.value };
                      set('specifications', next);
                    }}
                  />
                  <input
                    aria-label="Specification value"
                    value={spec.value}
                    placeholder="3.3V"
                    onChange={e => {
                      const next = [...form.specifications];
                      next[i] = { ...spec, value: e.target.value };
                      set('specifications', next);
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Remove specification"
                    onClick={() => set('specifications', form.specifications.filter((_, j) => j !== i))}
                  >
                    <X size={17} />
                  </button>
                </div>
              ))}
            </div>

            <label className="notes-label">
              Notes
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Package, condition, compatibility, or anything useful…"
                rows={4}
              />
            </label>

            {message && (
              <div
                className={message.includes('saved') ? 'notice success' : 'notice'}
                role="status"
                aria-live="polite"
              >
                {message}
              </div>
            )}

            <div className="form-actions">
              <button className="button primary" disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving…' : 'Save component'}
              </button>
            </div>
          </form>

          <aside className="editor-side">
            {id && (
              <section className="panel photo-panel">
                <h3>Component photo</h3>
                <div className="photo-box">
                  {item?.imageUrl ? (
                    <img src={item.imageUrl} alt={`Photo of ${item?.name || 'component'}`} />
                  ) : (
                    <Camera size={34} />
                  )}
                </div>
                <label className="button upload-button">
                  <Camera size={16} />
                  {item?.imageUrl ? 'Replace photo' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    aria-label="Upload component photo"
                    onChange={upload}
                  />
                </label>
                <small>JPG, PNG, WebP or GIF. Max 5 MB.</small>
              </section>
            )}

            {id && (
              <section className="panel placement-panel">
                <div className="placement-title">
                  <div>
                    <h3>Stored in</h3>
                    <p><strong>{item?.totalQuantity || 0}</strong> total</p>
                  </div>
                </div>
                {item?.placements.length === 0 && (
                  <div className="inline-empty">Not assigned to a location yet.</div>
                )}
                {item?.placements.map(p => (
                  <div className="placement" key={p.id}>
                    <div>
                      <strong>{p.quantity} {p.unit}</strong>
                      <span>{p.locationPath}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove placement"
                      onClick={() => setPlacementToDelete(p.id)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <form className="add-placement" onSubmit={addPlacement}>
                  <select
                    aria-label="Location"
                    required
                    value={place.locationId}
                    onChange={e => setPlace({ ...place, locationId: e.target.value })}
                  >
                    <option value="">Choose location…</option>
                    {locations.map(l => (
                      <option value={l.id} key={l.id}>{l.path}</option>
                    ))}
                  </select>
                  <div>
                    <input
                      aria-label="Quantity"
                      type="number"
                      min="0"
                      step="any"
                      value={place.quantity}
                      onChange={e => setPlace({ ...place, quantity: e.target.value })}
                    />
                    <input
                      aria-label="Unit"
                      value={place.unit}
                      onChange={e => setPlace({ ...place, unit: e.target.value })}
                    />
                  </div>
                  <button className="button" disabled={!locations.length}>
                    <Plus size={15} /> Add / update
                  </button>
                  {!locations.length && (
                    <small>
                      <Link href="/locations">Create a location first →</Link>
                    </small>
                  )}
                </form>
              </section>
            )}
          </aside>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDeleteComponent}
        title="Delete Component"
        message={`Are you sure you want to permanently delete "${item?.name || 'this component'}"? This action cannot be undone.`}
        confirmText="Delete component"
        onConfirm={handleConfirmDeleteComponent}
        onCancel={() => setConfirmDeleteComponent(false)}
      />

      <ConfirmModal
        isOpen={Boolean(placementToDelete)}
        title="Remove Placement"
        message="Remove this component from that location?"
        confirmText="Remove placement"
        onConfirm={handleConfirmDeletePlacement}
        onCancel={() => setPlacementToDelete(null)}
      />
    </main>
  );
}

