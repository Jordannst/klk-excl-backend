import assert from 'assert';
import { buildPdfSpikeHtml } from '../services/pdfSpikeHtml';

const html = buildPdfSpikeHtml();

assert.match(html, /<table[\s\S]*<thead[\s\S]*<tbody/);
assert.match(html, /@page\s*\{[\s\S]*size:\s*A4/);
assert.match(html, /thead\s*\{[\s\S]*display:\s*table-header-group/);
assert.equal((html.match(/<tr>/g) || []).length >= 90, true);
assert.equal(html.includes('PDF Spike'), true);

console.log('pdf-spike-html check passed');
