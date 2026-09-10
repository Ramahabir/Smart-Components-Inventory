'use client';
import { useCallback, useEffect, useState } from 'react';
import { Boxes, MapPin, PackagePlus, Search, Warehouse, ChevronRight, SlidersHorizontal, AlertCircle } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import type { ComponentRecord, LocationRecord } from '@/lib/types';
import Link from 'next/link';

type Dashboard = {
  stats: { components: number; locations: number; placements: number };
  recent: ComponentRecord[];
  categories: string[]
};

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ComponentRecord[]>([]);
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let ignore = false;
    Promise.all([
      fetch('/api/dashboard').then(async r => {
        if (!r.ok) throw new Error('Failed to load dashboard data.');
        return r.json() as Promise<Dashboard>;
      }),
      fetch('/api/locations').then(async r => {
        if (!r.ok) throw new Error('Failed to load locations.');
        return r.json() as Promise<LocationRecord[]>;
      }),
    ])
      .then(([d, l]) => {
        if (!ignore) {
          setDashboard(d);
          setLocations(l);
          setLoading(false);
          setError(null);
        }
      })
      .catch(err => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Unable to connect to the server.');
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    load();
  }, [load]);

  useEffect(() => {
    return load();
  }, [load]);

  useEffect(() => {
    if (!query && !category && !location) return;
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&location=${encodeURIComponent(location)}`)
        .then(async r => {
          if (!r.ok) throw new Error('Search failed');
          return r.json() as Promise<ComponentRecord[]>;
        })
        .then(d => {
          setResults(d);
          setSearching(false);
        })
        .catch(() => {
          setSearching(false);
        });
    }, 180);
    return () => clearTimeout(timer);
  }, [query, category, location]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('#inventory-search')?.focus();
      }
    };
    addEventListener('keydown', handler);
    return () => removeEventListener('keydown', handler);
  }, []);

  const all = dashboard?.recent || [];
  const categories = dashboard?.categories || [];
  const active = Boolean(query || category || location);
  const shown = active ? results : all;

  return (
    <main className="app-shell">
      <AppHeader />
      <section className="hero">
        <div className="eyebrow"><span /> WORKSHOP INVENTORY</div>
        <h1>Everything has<br />a place.</h1>
        <p>Search your parts, see the quantity, and know the exact drawer before you leave the bench.</p>
        <div className="search-box">
          <Search size={23} />
          <input
            id="inventory-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search inventory"
            placeholder="Search parts, values, aliases…"
          />
          <kbd>Ctrl K</kbd>
        </div>
        <div className="filter-row">
          <SlidersHorizontal size={15} />
          <select aria-label="Filter by category" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select aria-label="Filter by location" value={location} onChange={e => setLocation(e.target.value)}>
            <option value="">All locations</option>
            {locations.map(l => <option value={l.id} key={l.id}>{l.path}</option>)}
          </select>
        </div>
      </section>

      {error && (
        <div
          className="notice"
          role="alert"
          aria-live="polite"
          style={{ maxWidth: '1180px', margin: '24px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}
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

      <section className="dashboard">
        <div className="section-heading">
          <div>
            <p>{active ? 'SEARCH RESULTS' : 'AT A GLANCE'}</p>
            <h2 aria-live="polite">
              {active
                ? (searching ? 'Searching…' : `${shown.length} component${shown.length === 1 ? '' : 's'} found`)
                : (loading ? 'Loading workshop…' : 'Your workshop')}
            </h2>
          </div>
          <Link className="button primary" href="/components/new" aria-label="Add component">
            <PackagePlus size={17} />
            <span className="button-text">Add component</span>
          </Link>
        </div>

        {!active && (
          <div className="stats-grid">
            <article className="stat-card">
              <span className="stat-icon amber"><Boxes /></span>
              <p>COMPONENTS</p>
              <strong>{dashboard?.stats.components ?? '—'}</strong>
              <small>Searchable component records</small>
            </article>
            <article className="stat-card">
              <span className="stat-icon green"><Warehouse /></span>
              <p>STORAGE LOCATIONS</p>
              <strong>{dashboard?.stats.locations ?? '—'}</strong>
              <small>Cabinets, drawers & bins</small>
            </article>
            <article className="stat-card wide">
              <span className="stat-icon blue"><MapPin /></span>
              <p>PLACEMENTS</p>
              <strong>{dashboard?.stats.placements ?? '—'}</strong>
              <small>Component-to-location assignments</small>
              <Link href="/locations">Browse storage →</Link>
            </article>
          </div>
        )}

        <div className="results-head">
          <h3>{active ? 'Matches' : 'Recently updated'}</h3>
          {!active && dashboard?.stats.components === 0 && (
            <span>Start by adding a component or importing a backup.</span>
          )}
        </div>

        {shown.length > 0 ? (
          <div className="component-grid">
            {shown.map(item => (
              <Link className="component-card" href={`/components/${item.id}`} key={item.id}>
                <div className="component-thumb">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={`Photo of ${item.name}`} />
                  ) : (
                    <Boxes size={25} />
                  )}
                </div>
                <div className="component-info">
                  <div className="component-meta">
                    <span>{item.category || 'Uncategorized'}</span>
                    {item.partNumber && <code>{item.partNumber}</code>}
                  </div>
                  <h3>{item.name}</h3>
                  {item.specifications.length > 0 && (
                    <p>{item.specifications.slice(0, 3).map(s => `${s.key}: ${s.value}`).join(' · ')}</p>
                  )}
                  <div className="location-lines">
                    {item.placements.length ? (
                      item.placements.slice(0, 2).map(p => (
                        <div key={p.id}>
                          <MapPin size={14} />
                          <span>{p.locationPath}</span>
                          <strong>{p.quantity} {p.unit}</strong>
                        </div>
                      ))
                    ) : (
                      <div className="unplaced">Not placed yet</div>
                    )}
                  </div>
                </div>
                <ChevronRight className="card-arrow" size={19} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span><Search size={27} /></span>
            <h3>{active ? 'No components match' : 'Your inventory is empty'}</h3>
            <p>
              {active
                ? 'Try another word, alias, category, or location.'
                : 'Add your first component, then assign it to a cabinet, drawer, or bin.'}
            </p>
            <Link className="button primary" href="/components/new" aria-label="Add component">
              <PackagePlus size={16} />
              <span className="button-text">Add component</span>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

