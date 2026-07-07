import { Link } from 'react-router-dom';
import CategoryGlyph from './CategoryGlyph';

const ACCENTS = ['marigold', 'rosa', 'turquesa'];

export default function BusinessCard({ business, index = 0 }) {
  const accent = ACCENTS[index % ACCENTS.length];
  return (
    <Link to={`/negocio/${business.slug}`} className={`biz-card accent-${accent}`}>
      <div className="biz-card-glyph">
        <CategoryGlyph category={business.category} />
      </div>
      <div className="biz-card-body">
        <span className="eyebrow">{business.category}</span>
        <h3>{business.name}</h3>
        <p className="biz-card-tagline">{business.tagline}</p>
        <div className="biz-card-meta">
          <span>{business.address.split(',')[0]}</span>
          {business.appointment_only && <span className="pill">Appointment only</span>}
        </div>
      </div>
    </Link>
  );
}
