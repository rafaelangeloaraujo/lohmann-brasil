import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

const baseEnv = { SITE_URL: 'https://lohmann.example', SITE_NAME: 'Lohmann do Brasil' };

test('public page issues CSRF token and nonce-based CSP', async () => {
  const response = await worker.fetch(new Request('https://lohmann.example/'), baseEnv);
  const body = await response.text();
  const cookie = response.headers.get('set-cookie') || '';
  const csp = response.headers.get('content-security-policy') || '';
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1] || '';
  const token = cookie.match(/__Host-lohmann_csrf=([a-f0-9]{64})/)?.[1] || '';

  assert.equal(response.status, 200);
  assert.ok(nonce);
  assert.ok(token);
  assert.match(body, new RegExp(`name="csrf" value="${token}"`));
  assert.match(body, new RegExp(`<script nonce="${nonce}">`));
  assert.doesNotMatch(body, /googletagmanager\.com/);
  assert.equal(response.headers.get('x-frame-options'), null);
  assert.equal(response.headers.get('x-content-type-options'), null);
});

test('contact endpoint rejects missing and cross-site CSRF tokens', async () => {
  const missing = await worker.fetch(new Request('https://lohmann.example/api/contact', {
    method: 'POST',
    body: new URLSearchParams({ name: 'Teste', email: 'teste@example.com', message: 'Mensagem' }),
  }), baseEnv);
  assert.equal(missing.status, 403);

  const page = await worker.fetch(new Request('https://lohmann.example/'), baseEnv);
  const token = (page.headers.get('set-cookie') || '').match(/__Host-lohmann_csrf=([a-f0-9]{64})/)?.[1] || '';
  const crossSite = await worker.fetch(new Request('https://lohmann.example/api/contact', {
    method: 'POST',
    headers: { cookie: `__Host-lohmann_csrf=${token}`, origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
    body: new URLSearchParams({ csrf: token, name: 'Teste', email: 'teste@example.com', message: 'Mensagem' }),
  }), baseEnv);
  assert.equal(crossSite.status, 403);
});

test('admin login and mutations require CSRF', async () => {
  const env = { ...baseEnv, ADMIN_TOKEN: 'admin-secret' };
  const login = await worker.fetch(new Request('https://lohmann.example/admin'), env);
  const loginBody = await login.text();
  assert.match(loginBody, /name="csrf" value="[a-f0-9]{64}"/);

  const mutation = await worker.fetch(new Request('https://lohmann.example/api/admin/products?token=admin-secret', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Teste' }),
  }), env);
  assert.equal(mutation.status, 403);
});

test('radar renders sanitized data without external scripts', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`document.write(\`<table><tbody>
    <tr><td>29/09/2026</td><td><span>Ovos Brancos</span><br><span>cx 30 dúzias</span></td><td>R$ <span>123,45</span></td></tr>
  </tbody></table>\`)`, { status: 200 });
  try {
    const response = await worker.fetch(new Request('https://lohmann.example/radar-tecnico'), baseEnv);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /Ovos Brancos cx 30 dúzias/);
    assert.doesNotMatch(body, /<script[^>]+src="https:\/\//i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
