// Optional helpers: setup instructions and selectable text also work without JS.
const chinese = document.documentElement.lang === 'zh-Hant';
for (const button of document.querySelectorAll('[data-copy]')) {
  const target = document.getElementById(button.dataset.copy);
  if (!target) continue;
  button.hidden = false;
  button.addEventListener('click', async () => {
    const status = button.nextElementSibling;
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      status.textContent = chinese ? '已複製' : 'Copied';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = chinese ? '請複製已選取的文字' : 'Please copy the selected text';
    }
  });
}

function revealLinkedDetails() {
  const target = document.getElementById(location.hash.slice(1));
  if (target instanceof HTMLDetailsElement) target.open = true;
}
window.addEventListener('hashchange', revealLinkedDetails);
revealLinkedDetails();
