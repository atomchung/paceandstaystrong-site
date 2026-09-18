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
  const resetText = root.dataset.resetText || '';
  const turnLimitText = root.dataset.turnLimitText || '';
  const busyText = root.dataset.busyText || '';

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
  // How many answers this page has been given. A demo conversation lives in one server
  // process's memory: it expires on its own, and it is gone entirely when that process
  // restarts. The browser survives both -- same session id, same transcript on screen --
  // so a conversation that was replaced looks exactly like one that was continued. The
  // backend answers with its own count of the conversation, which makes the two tellable
  // apart: a `turn: 1` arriving after this page has already been answered is a new
  // conversation wearing the old one's transcript.
  let answered = 0;

  // What a visitor is told for each refusal the backend names. Anything not listed, and
  // any failure that never reached the backend, falls back to the page's own sentence --
  // never to a browser exception string, which is what "Failed to fetch" was.
  //
  // `session_busy` is deliberately absent: it means this visitor's own conversation is
  // already answering a turn, which is nothing to do with how many people are here, and
  // the form is disabled for exactly as long as that is true. A wrong sentence would be
  // worse than the general one.
  //
  // Null-prototype, so a code that happens to spell an inherited property -- `constructor`
  // reads back as a function, whose string form is browser internals -- cannot become the
  // sentence on screen. This backend sends a fixed set of codes; the map should not depend
  // on that staying true.
  const FAILURE_COPY = Object.assign(Object.create(null), {
    turn_limit_reached: turnLimitText,
    rate_limited: busyText,
    model_rate_limited: busyText,
    demo_at_capacity: busyText
  });

  // Carries a sentence written for a visitor. Anything else that reaches the catch is a
  // transport failure whose message is the browser's wording, not copy.
  class DemoFailure extends Error {}

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
    return turn;
  };

  // Not a turn, because nobody said it: it is the page reporting something about the
  // conversation itself. Deliberately not in the coach's voice -- a coach explaining its
  // own amnesia is the one thing this page cannot honestly show.
  //
  // Inserted *above* the question that landed in the new conversation, because that
  // question is the one thing on screen the coach did see. Appended after it, the line
  // would be saying "the coach cannot see anything above this" directly beneath the
  // sentence it had just answered.
  const noticeBefore = (node, text) => {
    if (!text || !node) return;
    clearEmpty();
    const notice = document.createElement('p');
    notice.className = 'demo-notice';
    notice.setAttribute('role', 'note');
    notice.textContent = text;
    transcript.insertBefore(notice, node);
  };

  const submitMessage = async (message) => {
    const trimmed = message.trim();
    if (!trimmed || busy) return;

    // Held, because a conversation that turns out to have been replaced needs a line
    // inserted above this question rather than under it.
    const question = appendTurn('user', youLabel, trimmed);
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
        // `error` is an object with a stable `code`; the message beside it is written for
        // whoever is reading a log, so only the code is read and the sentence is this
        // page's. A conversation that has spent its turns and one that is being rate
        // limited are different things to tell somebody, and both used to arrive as "the
        // demo is not answering right now".
        const code = payload && payload.error && typeof payload.error.code === 'string'
          ? payload.error.code
          : '';
        throw new DemoFailure(FAILURE_COPY[code] || failureText);
      }

      const reply = payload && typeof payload.reply === 'string' ? payload.reply.trim() : '';
      if (!reply) throw new DemoFailure(failureText);

      // Before the reply, because it is about everything above it. A deployment that does
      // not send a turn number leaves this page behaving exactly as it did before.
      const turn = payload && Number.isInteger(payload.turn) ? payload.turn : null;
      if (turn === 1 && answered > 0) noticeBefore(question, resetText);
      answered = turn === null ? answered + 1 : turn;

      appendTurn('coach', coachLabel, reply);
      if (handoff) handoff.hidden = false;
      setStatus(readyText);
    } catch (error) {
      // Only a sentence this page wrote reaches the status line. A transport failure gets
      // here with the browser's own words -- "Failed to fetch", which varies by browser and
      // reads like an unhandled bug -- so it is logged for debugging and never shown.
      if (!(error instanceof DemoFailure)) console.debug('demo request failed', error);
      setStatus(error instanceof DemoFailure ? error.message : failureText, true);
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
