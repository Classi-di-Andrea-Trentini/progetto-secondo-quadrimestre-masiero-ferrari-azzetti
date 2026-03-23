const year = new Date().getFullYear();

const base = (title: string, content: string) => `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Manrope:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #F0F0F0; font-family: 'Manrope', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 16px 60px; }
    .card { background: #FFFFFF; padding: 52px 48px; }
    .logo { font-family: 'Manrope', Helvetica, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.35em; text-transform: uppercase; color: #000000; margin-bottom: 48px; display: block; text-decoration: none; }
    .divider { border: none; border-top: 1px solid #F0F0F0; margin: 36px 0; }
    h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 30px; font-weight: 600; color: #000000; line-height: 1.2; margin-bottom: 20px; }
    p { font-size: 14px; line-height: 1.8; color: #8F8F8F; margin-bottom: 20px; }
    p strong { color: #000000; font-weight: 600; }
    .btn { display: inline-block; background: #000000; color: #FFFFFF !important; text-decoration: none; padding: 15px 36px; font-family: 'Manrope', Helvetica, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase; margin-top: 8px; }
    .btn:hover { background: #222; }
    .url-box { background: #F0F0F0; padding: 14px 18px; margin-top: 24px; word-break: break-all; font-size: 12px; color: #8F8F8F; font-family: monospace; }
    .alert-bar { border-left: 3px solid #C3A88D; padding: 14px 18px; background: #fdf8f4; margin: 24px 0; }
    .alert-bar p { margin: 0; color: #8F8F8F; font-size: 13px; }
    .footer { margin-top: 36px; text-align: center; font-size: 11px; color: #8F8F8F; line-height: 1.7; }
    .footer a { color: #8F8F8F; text-decoration: underline; }
    @media (max-width: 600px) { .card { padding: 36px 24px; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <span class="logo">Common Era</span>
      ${content}
    </div>
    <div class="footer">
      <p>© ${year} Common Era &nbsp;&middot;&nbsp; <a href="mailto:noreply@commonera.it">noreply@commonera.it</a></p>
      <p style="margin-top:6px;">Hai ricevuto questa email perché sei registrato su Common Era.</p>
    </div>
  </div>
</body>
</html>`;

export function welcomeEmail(fullName: string): string {
  const firstName = fullName.split(' ')[0];
  return base(
    'Benvenuto in Common Era',
    `<h1>Benvenuto,<br>${firstName}.</h1>
    <hr class="divider" />
    <p>Il tuo account Common Era è stato creato con successo. Ora puoi accedere al tuo profilo, salvare i tuoi prodotti preferiti e seguire i tuoi ordini.</p>
    <p>Siamo felici di averti con noi.</p>
    <hr class="divider" />
    <p style="font-size:12px; color:#8F8F8F;">Se non hai creato questo account, ignora questa email.</p>`,
  );
}

export function emailChangeConfirmation(
  fullName: string,
  newEmail: string,
  confirmationUrl: string,
): string {
  const firstName = fullName.split(' ')[0];
  return base(
    'Conferma il cambio email',
    `<h1>Conferma la nuova email.</h1>
    <hr class="divider" />
    <p>Ciao <strong>${firstName}</strong>, hai richiesto di cambiare il tuo indirizzo email con:</p>
    <p><strong>${newEmail}</strong></p>
    <p>Clicca il pulsante qui sotto per confermare il cambio. Il link è valido per <strong>24 ore</strong>.</p>
    <a class="btn" href="${confirmationUrl}">Conferma email</a>
    <div class="url-box">${confirmationUrl}</div>
    <hr class="divider" />
    <div class="alert-bar"><p>Se non hai richiesto questo cambio, la tua email attuale rimane invariata. Puoi ignorare questa email in sicurezza.</p></div>`,
  );
}

export function emailChangedAlert(oldEmail: string, fullName: string, newEmail: string): string {
  const firstName = fullName.split(' ')[0];
  return base(
    'Il tuo indirizzo email è stato aggiornato',
    `<h1>Email aggiornata.</h1>
    <hr class="divider" />
    <p>Ciao <strong>${firstName}</strong>, il tuo indirizzo email è stato aggiornato con successo.</p>
    <p>Il nuovo indirizzo è: <strong>${newEmail}</strong></p>
    <p>D'ora in poi utilizza questo indirizzo per accedere al tuo account.</p>
    <hr class="divider" />
    <div class="alert-bar"><p>Se non hai autorizzato questo cambio, contatta immediatamente il nostro supporto all'indirizzo <a href="mailto:support@commonera.it" style="color:#C3A88D;">support@commonera.it</a>.</p></div>`,
  );
}

export function passwordChangedAlert(fullName: string): string {
  const firstName = fullName.split(' ')[0];
  return base(
    'La tua password è stata modificata',
    `<h1>Password aggiornata.</h1>
    <hr class="divider" />
    <p>Ciao <strong>${firstName}</strong>, la password del tuo account Common Era è stata modificata con successo.</p>
    <p>Per sicurezza, tutte le sessioni attive su altri dispositivi sono state disconnesse.</p>
    <hr class="divider" />
    <div class="alert-bar"><p>Se non hai effettuato questa modifica, contatta immediatamente il supporto: <a href="mailto:support@commonera.it" style="color:#C3A88D;">support@commonera.it</a></p></div>`,
  );
}
