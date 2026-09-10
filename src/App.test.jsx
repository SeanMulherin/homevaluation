// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import fixture from './test-fixtures/analysis-contract.synthetic.json';
vi.mock('recharts', async (original) => ({ ...(await original()), ResponsiveContainer: () => null }));
let container, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container); vi.stubGlobal('fetch', vi.fn());
  localStorage.setItem('housing-market-lab:analysis:v5:1600 pennsylvania avenue nw, washington, dc 20500', JSON.stringify({ cachedAt: new Date().toISOString(), dashboard: { subject: { address: 'Old cached home' } } }));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); localStorage.clear(); vi.unstubAllGlobals(); });
const input = () => container.querySelector('input[aria-label="Property address"]');
async function typeAddress(value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit() { await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }
it('starts collapsed and idle on the server and client, even with browser data', async () => {
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain('Insert the full address [Street address, City, ST ZIP]');
  expect(html).not.toContain('Address-level market analysis');
  expect(html).not.toContain('Housing Market Lab');
  expect(html).not.toContain('dashboard-grid');
  expect(html).not.toContain('Regression pricing assessment');
  expect(html).not.toContain('Price vs. square footage'); expect(html).not.toContain('Analyzing');
  await act(async () => root.render(<App />));
  expect(container.querySelector('.dashboard-grid')).toBeNull();
  expect(input().value).toBe(''); expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
  expect(container.textContent).not.toContain('Old cached home'); expect(fetch).not.toHaveBeenCalled();
  await typeAddress('123 Test St, Washington, DC 20001');
  expect(fetch).not.toHaveBeenCalled(); expect(container.querySelector('button[type="submit"]').disabled).toBe(false);
  expect(container.querySelector('.dashboard-grid')).toBeNull();
});
it('submits explicitly, announces the wait, prevents duplicates, and supports retry', async () => {
  let rejectRequest;
  fetch.mockImplementation(() => new Promise((resolve, reject) => { rejectRequest = reject; }));
  await act(async () => root.render(<App />));
  await typeAddress('   '); await submit(); expect(fetch).not.toHaveBeenCalled();
  expect(container.querySelector('.dashboard-grid')).toBeNull();
  await typeAddress('123 Test St, Washington, DC 20001'); await submit();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(container.querySelector('.dashboard-grid')).toBeNull();
  expect(container.querySelector('[aria-label="Regression pricing assessment"]')).toBeNull();
  expect(container.textContent).not.toContain('Price vs. square footage');
  expect(JSON.parse(fetch.mock.calls[0][1].body).address).toBe('123 Test St, Washington, DC 20001');
  expect(container.querySelector('#analysis-progress').textContent).toContain('1–2 minutes');
  expect(input().getAttribute('aria-describedby')).toBe('analysis-progress');
  expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
  await submit(); expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => rejectRequest(new Error('Provider unavailable')));
  expect(container.querySelector('#analysis-progress')).toBeNull();
  expect(container.querySelector('[role="alert"]').textContent).toContain('Provider unavailable');
  expect(container.querySelector('.dashboard-grid')).toBeNull();
  await submit(); expect(fetch).toHaveBeenCalledTimes(2);
  await act(async () => rejectRequest(new Error('Still unavailable')));
});

it('shows results only after success and applies scope changes only on another submission', async () => {
  let complete;
  fetch.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  await act(async () => root.render(<App />));
  await typeAddress('123 Test St, Washington, DC 20001'); await submit();
  expect(container.querySelector('.dashboard-grid')).toBeNull();
  await act(async () => complete({ ok: true, json: async () => fixture }));
  expect(container.querySelector('.dashboard-grid').getAttribute('data-state')).toBe('ready');
  expect(container.querySelector('[aria-label="Regression pricing assessment"]')).not.toBeNull();
  expect(container.textContent).toContain('Price vs. square footage');
  expect(container.querySelector('#analysis-progress')).toBeNull();
  const radius = container.querySelector('.data-freshness__scope select');
  await act(async () => { radius.value = '2'; radius.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(fetch).toHaveBeenCalledTimes(1);
  await submit(); expect(fetch).toHaveBeenCalledTimes(2);
  expect(container.querySelector('.dashboard-grid')).toBeNull();
  expect(JSON.parse(fetch.mock.calls[1][1].body).neighborhood_radius_miles).toBe(2);
  await act(async () => complete({ ok: true, json: async () => fixture }));
});
