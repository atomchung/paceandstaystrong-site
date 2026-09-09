// Keep dialogue clear when a visitor switches between films.
const films = Array.from(document.querySelectorAll('.film-player'));
for (const film of films) {
  film.addEventListener('play', () => {
    for (const other of films) {
      if (other !== film) other.pause();
    }
  });
}
