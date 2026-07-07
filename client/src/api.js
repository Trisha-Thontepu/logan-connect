const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listBusinesses: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/businesses${qs ? `?${qs}` : ''}`);
  },
  getBusiness: (slug) => request(`/businesses/${slug}`),
  getCategories: () => request('/businesses/meta/categories'),
  sendSms: (payload) =>
    request('/sms/simulate', { method: 'POST', body: JSON.stringify(payload) }),
  getThread: (phone, businessSlug) =>
    request(`/sms/thread?phone=${encodeURIComponent(phone)}&businessSlug=${businessSlug}`),
};
