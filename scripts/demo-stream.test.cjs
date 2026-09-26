// Run with: node --test scripts/demo-stream.test.cjs
// Exercise the shipped script with real Web Streams and a small DOM stand-in. Browser
// verification remains necessary for layout and accessibility; these tests cover the
// request/stream lifecycle, including failures between reads that a static check misses.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.className = '';
    this.attributes = {};
    this.dataset = {};
    this.handlers = {};
    this.disabled = false;
    this.hidden = false;
    this.value = '';
  }
  get classList() {
    return {
      toggle: (name, on) => {
        const names = new Set(this.className.split(' ').filter(Boolean));
        if (on) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
      },
      remove: (name) => this.classList.toggle(name, false)
    };
  }
  set textContent(text) { this.replaceChildren(String(text)); }
  get textContent() { return this.children.map((c) => typeof c === 'string' ? c : c.textContent).join(''); }
  get firstElementChild() { return this.children.find((c) => c instanceof Element); }
  get rows() { return this.children.filter((c) => c.tagName === 'tr'); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  focus() { this.focused = true; }
  append(...nodes) {
    for (const node of nodes) {
      if (node.tagName === 'fragment') { this.append(...node.children); continue; }
      if (typeof node !== 'string') { node.remove(); node.parent = this; }
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    for (const child of this.children) if (typeof child !== 'string') child.parent = null;
    this.children = [];
    this.append(...nodes);
  }
  remove() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  insertBefore(node, previous) {
    node.remove();
    this.children.splice(this.children.indexOf(previous), 0, node);
    node.parent = this;
  }
  replaceChild(node, previous) { this.insertBefore(node, previous); previous.remove(); }
  querySelector(selector) {
    for (const child of this.children) {
      if (!(child instanceof Element)) continue;
      if (selector.startsWith('.') ? child.className.split(' ').includes(selector.slice(1))
        : child.tagName === selector) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
}

const source = readFileSync(new URL('../assets/demo.js', `file://${__filename}`), 'utf8');
const settle = () => new Promise((resolve) => setImmediate(resolve));
const frame = (event, payload) => `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

function stream() {
  let controller;
  const body = new ReadableStream({ start(value) { controller = value; } });
  return {
    response: new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } }),
    push: (text) => controller.enqueue(new TextEncoder().encode(text)),
    bytes: (bytes) => controller.enqueue(bytes),
    close: () => controller.close(),
    disconnect: () => controller.error(new Error('network disconnected'))
  };
}

function page(replies, locale = 'en') {
  const nodes = Object.fromEntries(['form', 'input', 'send', 'transcript', 'status', 'handoff']
    .map((name) => [name, new Element()]));
  const prompt = new Element('button');
  prompt.dataset.demoPrompt = 'Suggested question';
  nodes.handoff.hidden = true;
  const root = new Element();
  root.dataset = {
    endpoint: 'https://demo.invalid/demo/v1/respond', coachLabel: 'Coach', youLabel: 'You',
    sendingText: 'Reading training', waitingHint: 'Usually 10 to 30 seconds.',
    readyText: 'Ready', failureText: 'Demo unavailable.', resetText: 'Conversation restarted.',
    turnLimitText: 'Conversation limit.', busyText: 'Demo is busy.'
  };
  root.querySelector = (selector) => nodes[selector.match(/data-demo-(\w+)/)[1]];
  root.querySelectorAll = () => [prompt];
  const calls = [];
  runInNewContext(source, {
    document: {
      querySelector: () => root, documentElement: { lang: locale },
      createElement: (tag) => new Element(tag),
      createDocumentFragment: () => new Element('fragment')
    },
    crypto: { randomUUID: () => 'synthetic-session' }, TextDecoder,
    console: { debug() {} }, setInterval: () => 1, clearInterval() {},
    fetch: async (url, options) => { calls.push({ url, ...options }); return replies.shift(); }
  });
  return {
    ...nodes, prompt, calls,
    submit(text = 'My question') {
      nodes.input.value = text;
      nodes.form.handlers.submit({ preventDefault() {} });
    }
  };
}

test('JSON fallback submits once with locale and supports older replies without a turn', async () => {
  const ui = page([Response.json({ reply: '**A complete reply**' })], 'zh-Hant');
  ui.submit();
  await settle();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.calls[0].headers.Accept, 'text/event-stream, application/json');
  assert.equal(JSON.parse(ui.calls[0].body).locale, 'zh-Hant');
  assert.equal(ui.transcript.querySelector('.demo-inline').textContent, 'A complete reply');
  assert.equal(ui.handoff.hidden, false);
  assert.equal(ui.send.disabled, false);
});

test('a delayed stream stays one busy bubble until authoritative done renders its table', async () => {
  const live = stream();
  const ui = page([live.response]);
  ui.submit();
  live.push(frame('delta', { text: '**First words**\n' }));
  await settle();
  const bubble = ui.transcript.querySelector('.coach');
  assert.equal(bubble.attributes['aria-busy'], 'true');
  assert.equal(bubble.querySelector('.demo-body').textContent, '**First words**\n');
  assert.equal(ui.handoff.hidden, true);
  assert.equal(ui.send.disabled, true);
  assert.equal(ui.input.disabled, true);
  assert.equal(ui.prompt.disabled, true);
  ui.submit('Accidental repeat');
  assert.equal(ui.calls.length, 1);
  live.push(frame('done', { reply: '| Day | Work |\n|---|---|\n| Tue | **Run** |', turn: 1 }));
  await settle();
  assert.equal(ui.transcript.querySelector('.coach'), bubble);
  assert.equal(bubble.attributes['aria-busy'], 'false');
  assert.equal(bubble.querySelector('table').rows.length, 2);
  assert.equal(bubble.textContent.includes('First words'), false);
  assert.equal(ui.handoff.hidden, false);
  assert.equal(ui.send.disabled, false);
  assert.equal(ui.input.focused, true);
});

test('UTF-8 and SSE lines survive byte splits, CRLF, comments, multiline data and unknown events', async () => {
  const live = stream();
  const ui = page([live.response]);
  ui.submit();
  const wire = ': keepalive\r\n\r\nevent: reasoning\r\ndata: {"text":"private"}\r\n\r\n'
    + 'event: delta\r\ndata: {\r\ndata: "text":"練跑🏃"}\r\n\r\n';
  for (const byte of new TextEncoder().encode(wire)) live.bytes(new Uint8Array([byte]));
  await settle();
  assert.equal(ui.transcript.querySelector('.demo-body').textContent, 'My question');
  assert.equal(ui.transcript.querySelector('.coach').querySelector('.demo-body').textContent, '練跑🏃');
  assert.equal(ui.transcript.textContent.includes('private'), false);
  live.push(frame('done', { reply: '完成🏃', turn: 1 }).replaceAll('\n', '\r'));
  live.close();
  await settle();
  assert.equal(ui.transcript.querySelector('.coach').querySelector('.demo-body').textContent, '完成🏃');
  assert.equal(ui.status.textContent, 'Ready');
});

for (const ending of ['eof', 'disconnect', 'error', 'invalid-done', 'malformed', 'invalid-delta']) {
  test(`${ending} after a partial answer fails visibly without counting the answer`, async () => {
    const live = stream();
    const ui = page([live.response, Response.json({ reply: 'Recovered', turn: 1 })]);
    ui.submit();
    live.push(frame('delta', { text: 'Unfinished prescription' }));
    await settle();
    if (ending === 'eof') live.close();
    if (ending === 'disconnect') live.disconnect();
    if (ending === 'error') live.push(frame('error', { error: { code: 'unknown', message: 'RAW PROVIDER ERROR' } }));
    if (ending === 'invalid-done') live.push(frame('done', { reply: 'Missing turn' }));
    if (ending === 'malformed') live.push('event: done\ndata: { RAW PROVIDER ERROR\n\n');
    if (ending === 'invalid-delta') live.push(frame('delta', { text: 42 }));
    await settle();
    assert.equal(ui.status.textContent, 'Demo unavailable.');
    assert.equal(ui.transcript.querySelector('.coach'), null);
    assert.equal(ui.transcript.textContent.includes('Unfinished'), false);
    assert.equal(ui.transcript.textContent.includes('RAW PROVIDER'), false);
    assert.equal(ui.handoff.hidden, true);
    assert.equal(ui.send.disabled, false);
    ui.submit('Try again');
    await settle();
    assert.equal(ui.transcript.textContent.includes('Conversation restarted.'), false);
    assert.equal(ui.transcript.textContent.includes('My question'), true);
    assert.equal(ui.transcript.textContent.includes('Recovered'), true);
  });
}

test('both JSON and streamed errors use local copy and never inherited property names', async () => {
  const live = stream();
  const ui = page([
    Response.json({ error: { code: 'turn_limit_reached', message: 'RAW ERROR' } }, { status: 429 }),
    live.response,
    Response.json({ error: { code: 'constructor', message: 'RAW ERROR' } }, { status: 500 })
  ]);
  ui.submit();
  await settle();
  assert.equal(ui.status.textContent, 'Conversation limit.');
  ui.submit();
  live.push(frame('error', { error: { code: 'model_rate_limited', message: 'RAW ERROR' } }));
  await settle();
  assert.equal(ui.status.textContent, 'Demo is busy.');
  ui.submit();
  await settle();
  assert.equal(ui.status.textContent, 'Demo unavailable.');
  assert.equal(ui.transcript.textContent.includes('RAW ERROR'), false);
});

test('server reset notice precedes the new question, keeping earlier answers intact', async () => {
  const live = stream();
  const ui = page([Response.json({ reply: 'Earlier answer', turn: 2 }), live.response]);
  ui.submit('Earlier question');
  await settle();
  ui.submit('New question');
  live.push(frame('delta', { text: 'New ' }));
  live.push(frame('done', { reply: 'New answer', turn: 1 }));
  await settle();
  assert.deepEqual(ui.transcript.children.map((node) => node.textContent), [
    'YouEarlier question', 'CoachEarlier answer', 'Conversation restarted.',
    'YouNew question', 'CoachNew answer'
  ]);
});

test('model markup stays text during streaming and after final rendering', async () => {
  const live = stream();
  const ui = page([live.response]);
  const markup = '<img src=x onerror=alert(1)> **<script>alert(2)</script>**';
  ui.submit();
  live.push(frame('delta', { text: markup }));
  await settle();
  assert.equal(ui.transcript.querySelector('.coach').querySelector('.demo-body').textContent, markup);
  live.push(frame('done', { reply: markup, turn: 1 }));
  await settle();
  assert.equal(ui.transcript.querySelector('img'), null);
  assert.equal(ui.transcript.querySelector('script'), null);
  assert.equal(ui.transcript.querySelector('.demo-inline').textContent, '<script>alert(2)</script>');
});
