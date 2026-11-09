(function () {
  var form = document.getElementById('contact');
  var status = document.getElementById('status');
  var btn = form.querySelector('button');

  function say(msg) { status.textContent = msg; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = new FormData(form);
    var data = {
      name: (f.get('name') || '').trim(),
      email: (f.get('email') || '').trim(),
      message: (f.get('message') || '').trim(),
      turnstileToken: f.get('cf-turnstile-response') || ''
    };
    if (!data.name || !data.email || !data.message) { say('Merci de remplir tous les champs.'); return; }
    if (!data.turnstileToken) { say('Merci de valider le contrôle anti-robot.'); return; }

    btn.disabled = true; say('Envoi en cours…');
    fetch(form.dataset.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (r.status === 201) { form.reset(); if (window.turnstile) turnstile.reset(); say('Message envoyé, merci.'); return; }
      return r.json().catch(function () { return {}; }).then(function (j) {
        say(j.error || 'L’envoi a échoué. Réessayez plus tard.');
        if (window.turnstile) turnstile.reset();
      });
    }).catch(function () {
      say('Connexion impossible. Réessayez plus tard.');
    }).then(function () { btn.disabled = false; });
  });
})();
