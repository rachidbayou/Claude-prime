(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var search = document.getElementById('q');
  var count = document.getElementById('count');
  var empty = document.getElementById('empty');
  var cat = 'all';

  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function apply() {
    var q = norm(search.value.trim());
    var n = 0;
    cards.forEach(function (c) {
      var ok = (cat === 'all' || c.dataset.cat === cat) &&
               (!q || norm(c.textContent).indexOf(q) !== -1);
      c.hidden = !ok;
      if (ok) n++;
    });
    count.textContent = n + (n > 1 ? ' outils' : ' outil');
    empty.hidden = n !== 0;
  }

  chips.forEach(function (b) {
    b.addEventListener('click', function () {
      cat = b.dataset.cat;
      chips.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      apply();
    });
  });
  search.addEventListener('input', apply);
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus(); }
  });
  apply();
})();
