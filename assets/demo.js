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

  const form = root.querySelector('[data-demo-form]');
  const input = root.querySelector('[data-demo-input]');
  const send = root.querySelector('[data-demo-send]');
  const transcript = root.querySelector('[data-demo-transcript]');
  const status = root.querySelector('[data-demo-status]');
  const promptButtons = [...root.querySelectorAll('[data-demo-prompt]')];

  let busy = false;
  const sessionId = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
    ? globalThis.crypto.randomUUID()
    : `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('error', isError);
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

  const appendTurn = (role, label, text) => {
    clearEmpty();
    const turn = document.createElement('div');
    turn.className = `demo-turn ${role}`;

    const heading = document.createElement('strong');
    heading.textContent = label;

    const body = document.createElement('div');
    body.textContent = text;

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
    setStatus(sendingText);

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
