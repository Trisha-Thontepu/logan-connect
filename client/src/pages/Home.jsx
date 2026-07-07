import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import BusinessCard from '../components/BusinessCard';
import MapView from '../components/MapView';

export default function Home() {
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (category) params.category = category;
    if (query) params.q = query;
    api
      .listBusinesses(params)
      .then(setBusinesses)
      .finally(() => setLoading(false));
  }, [category, query]);

  const anchor = useMemo(
    () => businesses.find((b) => b.slug === 'logan-nails-spa'),
    [businesses]
  );

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <span className="eyebrow">Logan Heights, San Diego</span>
          <h1>
            Built on National Avenue,
            <br />
            for the neighborhood that built it.
          </h1>
          <p className="hero-sub">
            A directory and digital map for Latinx-owned businesses in Logan Heights —
            the people behind the storefronts, how to reach them, and how to book without
            a single dollar spent on software they can't afford.
          </p>
        </div>
        <div className="hero-lights" aria-hidden="true" />
      </section>

      <div className="scallop-divider" />

      <section className="container origin-strip">
        <span className="eyebrow">Where this started</span>
        <p>
          My mother has run <strong>Logan Nails Spa</strong> on National Avenue for twenty years
          on word-of-mouth alone. This started as a website for her — it became a directory for
          everyone like her.
        </p>
      </section>

      <section className="container directory-controls">
        <input
          className="search-input"
          placeholder="Search businesses…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search businesses"
        />
        <div className="category-pills">
          <button
            className={`btn-pill ${category === '' ? 'btn-pill-solid' : ''}`}
            onClick={() => setCategory('')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`btn-pill ${category === c ? 'btn-pill-solid' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="container map-section">
        {businesses.length > 0 && <MapView businesses={businesses} />}
      </section>

      <section className="container directory-grid-section">
        <h2 className="section-title">The directory</h2>
        {loading ? (
          <p className="cream-dim">Loading businesses…</p>
        ) : businesses.length === 0 ? (
          <p className="cream-dim">No businesses match that search yet.</p>
        ) : (
          <div className="directory-grid">
            {businesses.map((b, i) => (
              <BusinessCard key={b.id} business={b} index={i} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
