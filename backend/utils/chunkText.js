module.exports = function chunkText(text, size = 1200, overlap = 180) {
  const cleaned = text.replace(/\r/g, '').replace(/[\t ]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const chunks = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + size, cleaned.length);
    if (end < cleaned.length) {
      const boundary = cleaned.lastIndexOf(' ', end);
      if (boundary > start + size * 0.65) end = boundary;
    }
    const chunk = cleaned.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= cleaned.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
};
