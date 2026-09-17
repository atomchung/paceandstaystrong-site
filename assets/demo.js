(() => {
  const root = document.querySelector('[data-demo-root]');
  if (!root) return;

  const endpoint = root.dataset.endpoint;
  const coachLabel = root.dataset.coachLabel || 'Coach';
  const youLabel = root.dataset.youLabel || 'You';
  const readyText = root.dataset.readyText || '';
  const sendingText = root.dataset.sendingText || 'Thinking…';
  const failureText = root.dataset.failureText || 'The live demo is temporarily unavailable.';
  const emptyText = root.dataset.emptyText || '';
  const waitingHint = root.dataset.waitingHint || '';

  const form = root.querySelector('[data-demo-form]');
  const input = root.querySelector('[data-demo-input]');
  const send = root.querySelector('[data-demo-send]');
  const transcript = root.querySelector('[data-demo-transcript]');
  const status = root.querySelector('[data-demo-status]');
  const promptButtons = [...root.querySelectorAll('[data-demo-prompt]')];
  // Revealed once an answer exists. Before that there is nothing to convert on, and a
  // standing banner would sit between the question and the reply for no reason.
  const handoff = root.querySelector('[data-demo-handoff]');

  let busy = false;
  const sessionId = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
    ? globalThis.crypto.randomUUID()
    : `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // A turn takes eight to thirty seconds, and a motionless line for that long reads as a
  // page that has hung -- which is what it was mistaken for. The elapsed count is the
  // cheapest honest signal: it says the wait is being measured rather than ignored.
  let waitTimer = null;

  const stopWaiting = () => {
    if (waitTimer === null) return;
    clearInterval(waitTimer);
    waitTimer = null;
  };

  const setStatus = (message, isError = false) => {
    stopWaiting();
    status.textContent = message;
    status.classList.toggle('error', isError);
  };

  const startWaiting = () => {
    stopWaiting();
    const startedAt = Date.now();
    status.textContent = '';
    status.classList.remove('error');

    // Announced once. A live region that rewrites itself every second is unusable with a
    // screen reader, so the ticking part is hidden from it and exists for the eye only.
    const label = document.createElement('span');
    label.textContent = sendingText;
    const elapsed = document.createElement('span');
    elapsed.className = 'demo-elapsed';
    elapsed.setAttribute('aria-hidden', 'true');
    status.append(label, elapsed);
    if (waitingHint) {
      const hint = document.createElement('span');
      hint.className = 'demo-hint';
      hint.textContent = waitingHint;
      status.append(hint);
    }

    const tick = () => {
      elapsed.textContent = ` ${Math.round((Date.now() - startedAt) / 1000)}s`;
    };
    tick();
    waitTimer = setInterval(tick, 1000);
  };

  const setBusy = (value) => {
    busy = value;
    send.disabled = value;
    input.disabled = value;
    promptButtons.forEach((button) => { button.disabled = value; });
  };

  const clearEmpty = () => {
    const empty = transcript.querySelector('[data-demo-empty]');
    if (empty) empty.remove();
  };

  // The coach writes Markdown. Only the subset it actually uses is rendered -- headings,
  // bullets and bold -- and every piece is built as a DOM node. The reply is a model's
  // words arriving on a public page, so nothing here goes near innerHTML and anything the
  // renderer does not recognise stays literal text rather than becoming markup.
  const BOLD = /\*\*(.+?)\*\*/g;

  const appendInline = (node, text) => {
    let cursor = 0;
    for (const match of text.matchAll(BOLD)) {
      if (match.index > cursor) node.append(text.slice(cursor, match.index));
      const strong = document.createElement('strong');
      strong.className = 'demo-inline';
      strong.textContent = match[1];
      node.append(strong);
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) node.append(text.slice(cursor));
  };

  // A row of a pipe table, and the |---|:--:| rule that separates its header from its body.
  // The coach reaches for a table whenever it is comparing sessions, and rendered as plain
  // paragraphs those rows arrive as a wall of pipe characters -- which is what a first
  // visitor was being shown. Recognised here so they become a real table, still built node
  // by node like everything else.
  const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
  const TABLE_RULE = /^[\s|:-]+$/;

  const tableCells = (line) => TABLE_ROW.exec(line)[1].split('|').map((cell) => cell.trim());

  const renderReply = (text) => {
    const fragment = document.createDocumentFragment();
    let list = null;
    let table = null;
    for (const raw of text.split('\n')) {
      const line = raw.trimEnd();

      if (TABLE_ROW.test(line)) {
        list = null;
        // The rule row carries alignment, which this renderer does not use.
        if (TABLE_RULE.test(line) && line.includes('-')) continue;
        if (!table) {
          table = document.createElement('table');
          table.className = 'demo-table';
          const scroller = document.createElement('div');
          scroller.className = 'demo-table-scroll';
          scroller.append(table);
          fragment.append(scroller);
        }
        const row = document.createElement('tr');
        // The first row of a table is its header; everything after it is a body row.
        const cellTag = table.rows.length === 0 ? 'th' : 'td';
        for (const cell of tableCells(line)) {
          const node = document.createElement(cellTag);
          appendInline(node, cell);
          row.append(node);
        }
        table.append(row);
        continue;
      }
      table = null;

      const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
      if (bullet) {
        if (!list) { list = document.createElement('ul'); fragment.append(list); }
        const item = document.createElement('li');
        appendInline(item, bullet[1]);
        list.append(item);
        continue;
      }
      list = null;
      if (!line) continue;
      const heading = /^(#{1,4})\s+(.*)$/.exec(line);
      if (heading) {
        const node = document.createElement(`h${Math.min(heading[1].length + 2, 5)}`);
        appendInline(node, heading[2]);
        fragment.append(node);
        continue;
      }
      const para = document.createElement('p');
      appendInline(para, line);
      fragment.append(para);
    }
    return fragment;
  };

  const appendTurn = (role, label, text) => {
    clearEmpty();
    const turn = document.createElement('div');
    turn.className = `demo-turn ${role}`;

    const heading = document.createElement('strong');
    heading.textContent = label;

    const body = document.createElement('div');
    body.className = 'demo-body';
    // What the visitor typed is shown exactly as typed; only the coach's side is rendered.
    if (role === 'coach') body.append(renderReply(text));
    else body.textContent = text;

    turn.append(heading, body);
    transcript.append(turn);
    transcript.scrollTop = transcript.scrollHeight;
  };

  const submitMessage = async (message) => {
    const trimmed = message.trim();
    if (!trimmed || busy) return;

    appendTurn('user', youLabel, trimmed);
    input.value = '';
    setBusy(true);
    startWaiting();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: trimmed
        })
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }

      if (!response.ok) {
        const detail = payload && typeof payload.error === 'string' ? payload.error : failureText;
        throw new Error(detail);
      }

      const reply = payload && typeof payload.reply === 'string' ? payload.reply.trim() : '';
      if (!reply) throw new Error(failureText);

      appendTurn('coach', coachLabel, reply);
      if (handoff) handoff.hidden = false;
      setStatus(readyText);
    } catch (error) {
      const messageText = error instanceof Error && error.message ? error.message : failureText;
      setStatus(messageText, true);
    } finally {
      setBusy(false);
      input.focus();
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitMessage(input.value);
  });

  promptButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const prompt = button.dataset.demoPrompt || button.textContent || '';
      input.value = prompt.trim();
      void submitMessage(input.value);
    });
  });

  if (emptyText) {
    const empty = transcript.querySelector('[data-demo-empty]');
    if (empty) empty.textContent = emptyText;
  }
  setStatus(readyText);
})();
