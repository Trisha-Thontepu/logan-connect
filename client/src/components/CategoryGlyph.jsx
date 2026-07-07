// Small line-art glyphs themed to each category. Kept intentionally loose/hand-drawn
// rather than generic icon-font shapes, to match the signage-painted feel of the site.

const PATHS = {
  'Nail Salon': (
    <>
      <path d="M22 6c-4 2-6 7-5 13 1 5 5 9 9 8 3-1 4-5 3-9-1-5-3-10-7-12z" />
      <circle cx="24" cy="11" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  'Panadería': (
    <>
      <ellipse cx="24" cy="27" rx="14" ry="8" />
      <path d="M14 24c2-6 6-10 10-10s8 4 10 10" />
      <path d="M19 19c1-2 2-3 3-3M27 19c-1-2-2-3-3-3" />
    </>
  ),
  Restaurant: (
    <>
      <path d="M12 20c0-5 5-9 12-9s12 4 12 9c0 3-3 5-7 6l-1 8h-8l-1-8c-4-1-7-3-7-6z" />
      <path d="M14 21c4 2 16 2 20 0" />
    </>
  ),
  Barbershop: (
    <>
      <circle cx="17" cy="13" r="4" />
      <circle cx="17" cy="31" r="4" />
      <path d="M13 16l18 18M31 16L13 34" />
    </>
  ),
  Laundromat: (
    <>
      <rect x="11" y="9" width="22" height="26" rx="3" />
      <circle cx="22" cy="23" r="7" />
      <path d="M19 23c0-2 1.5-3.5 3-3.5" />
      <circle cx="16" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="20" cy="13" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  'Beauty Salon': (
    <>
      <path d="M24 8c3 5 3 10 0 14-3-4-3-9 0-14z" />
      <path d="M14 22c4-2 8-2 10 1 2-3 6-3 10-1-2 6-6 10-10 10s-8-4-10-10z" />
    </>
  ),
};

const DEFAULT = (
  <circle cx="22" cy="22" r="12" />
);

export default function CategoryGlyph({ category, size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="presentation"
      aria-hidden="true"
    >
      {PATHS[category] || DEFAULT}
    </svg>
  );
}
