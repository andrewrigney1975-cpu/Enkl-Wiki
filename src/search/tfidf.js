// Pure, DOM-free TF-IDF + cosine similarity search engine. Kept dependency-
// free of the Worker/self globals so it can run identically inside the
// search Web Worker (see search-worker.js) or, as a fallback, inline on the
// main thread (see search-client.js) — and so it's directly unit-testable.
const DEFAULT_THRESHOLD = 0.15;

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[a-z0-9]+/g) || [];
}

// documents: [{ id, text }] -> { idf: Map<term, weight>, vectors: Map<id, {vec, norm}> }
export function buildIndex(documents) {
  const documentFrequency = new Map();
  const termFrequenciesById = new Map();

  for (const doc of documents) {
    const tokens = tokenize(doc.text);
    const tf = new Map();
    for (const term of tokens) tf.set(term, (tf.get(term) || 0) + 1);
    termFrequenciesById.set(doc.id, { tf, length: tokens.length });
    for (const term of tf.keys()) documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
  }

  const totalDocs = documents.length;
  const idf = new Map();
  for (const [term, count] of documentFrequency) {
    idf.set(term, Math.log((totalDocs + 1) / (count + 1)) + 1); // smoothed idf, always > 0
  }

  const vectors = new Map();
  for (const [id, { tf, length }] of termFrequenciesById) {
    vectors.set(id, weightedVector(tf, length, idf));
  }

  return { idf, vectors };
}

function weightedVector(tf, length, idf) {
  const vec = new Map();
  let normSq = 0;
  for (const [term, count] of tf) {
    const weight = (count / (length || 1)) * (idf.get(term) || 0);
    if (weight > 0) {
      vec.set(term, weight);
      normSq += weight * weight;
    }
  }
  return { vec, norm: Math.sqrt(normSq) || 1 };
}

export function vectorizeQuery(query, idf) {
  const tokens = tokenize(query);
  const tf = new Map();
  for (const term of tokens) tf.set(term, (tf.get(term) || 0) + 1);
  return weightedVector(tf, tokens.length, idf);
}

export function cosineSimilarity(a, b) {
  const [smaller, larger] = a.vec.size < b.vec.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of smaller.vec) {
    const otherWeight = larger.vec.get(term);
    if (otherWeight) dot += weight * otherWeight;
  }
  return dot / (a.norm * b.norm);
}

// Returns [{ id, score }, ...] sorted best-first, filtered to >= threshold.
export function search(index, query, { threshold = DEFAULT_THRESHOLD, limit = 20 } = {}) {
  const queryVector = vectorizeQuery(query, index.idf);
  if (queryVector.vec.size === 0) return [];

  const results = [];
  for (const [id, docVector] of index.vectors) {
    const score = cosineSimilarity(queryVector, docVector);
    if (score >= threshold) results.push({ id, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
