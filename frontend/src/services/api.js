const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');

async function request(path, options = {}) {
  let response;
  try { response = await fetch(`${baseUrl}${path}`, options); }
  catch { throw new Error('Could not reach the Papertrail API. Check that the backend is running.'); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status}).`);
  return payload;
}

export const getDocuments = () => request('/documents');
export const getDocument = (id) => request(`/documents/${id}`);
export const uploadDocument = (file) => {
  const body = new FormData(); body.append('pdf', file);
  return request('/documents', { method: 'POST', body });
};
export const deleteDocument = (id) => request(`/documents/${id}`, { method: 'DELETE' });
export const getChat = (id) => request(`/documents/${id}/chat`);
export const askQuestion = (id, question) => request(`/documents/${id}/chat`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }),
});
export const clearChat = (id) => request(`/documents/${id}/chat`, { method: 'DELETE' });
