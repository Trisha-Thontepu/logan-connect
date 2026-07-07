import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import SmsDemoWidget from '../components/SmsDemoWidget';
import CategoryGlyph from '../components/CategoryGlyph';

const DAY_LABELS = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function formatPrice(cents) {
  if (!cents) return null;
  return `$${(cents / 100).toFixed(0)}`;
}

export default function BusinessProfile() {
  const { slug } = useParams();
  const [business, setBusiness] = useState(null);
  const [lang, setLang] = useState('en');
  const [error, setError] = useState(null);

  useEffect(() => {
    setBusiness(null);
    setError(null);
    api.getBusiness(slug).catch((err) => setError(err.message)).then((data) => {
      if (data) setBusiness(data);
    });
  }, [slug]);

  if (error) {
    return (
      <div className="container profile-empty">
        <p>We couldn't find that business. <Link to="/">Back to the directory</Link></p>
      </div>
    );
  }

  if (!business) {
    return <div className="container profile-empty"><p>Loading…</p></div>;
  }

  const story = lang === 'es' && business.story_es ? business.story_es : business.story_en;

  return (
    <div className="profile">
      <section className="profile-header">
        <div className="container profile-header-inner">
          <Link to="/" className="back-link">← Back to directory</Link>
          <div className="profile-title-row">
            <CategoryGlyph category={business.category} size={56} />
            <div>
              <span className="eyebrow">{business.category}</span>
              <h1>{business.name}</h1>
            </div>
          </div>
          <p className="profile-tagline">{business.tagline}</p>
        </div>
      </section>

      <div className="container profile-grid">
        <div className="profile-main">
          <div className="profile-card">
            <div className="lang-toggle" role="tablist" aria-label="Story language">
              <button
                className={lang === 'en' ? 'active' : ''}
                onClick={() => setLang('en')}
                role="tab"
                aria-selected={lang === 'en'}
              >
                English
              </button>
              <button
                className={lang === 'es' ? 'active' : ''}
                onClick={() => setLang('es')}
                role="tab"
                aria-selected={lang === 'es'}
              >
                Español
              </button>
            </div>
            <h2 className="profile-section-title">
              {lang === 'es' ? `Sobre ${business.owner_name || 'el negocio'}` : `About ${business.owner_name || 'the owner'}`}
            </h2>
            <p className="profile-story">{story}</p>
          </div>

          {business.services?.length > 0 && (
            <div className="profile-card">
              <h2 className="profile-section-title">
                {lang === 'es' ? 'Servicios' : 'Services'}
              </h2>
              <ul className="services-list">
                {business.services.map((s) => (
                  <li key={s.id}>
                    <span>{lang === 'es' && s.name_es ? s.name_es : s.name_en}</span>
                    <span className="services-price mono">{formatPrice(s.price_cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="profile-card">
            <SmsDemoWidget businessSlug={business.slug} />
          </div>
        </div>

        <aside className="profile-aside">
          <div className="profile-card profile-info-card">
            <h3>{lang === 'es' ? 'Visítanos' : 'Visit'}</h3>
            <p>{business.address}</p>
            {business.phone && <p className="mono">{business.phone}</p>}
            {business.appointment_only && (
              <p className="pill pill-static">
                {lang === 'es' ? 'Solo con cita' : 'Appointment only'}
              </p>
            )}

            <h3 className="hours-title">{lang === 'es' ? 'Horario' : 'Hours'}</h3>
            <ul className="hours-list">
              {DAY_ORDER.map((d) => (
                <li key={d}>
                  <span>{DAY_LABELS[d]}</span>
                  <span className="mono">
                    {business.hours_json?.[d] === 'closed'
                      ? (lang === 'es' ? 'Cerrado' : 'Closed')
                      : business.hours_json?.[d] || '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
