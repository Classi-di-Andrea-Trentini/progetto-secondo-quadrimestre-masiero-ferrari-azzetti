const year = new Date().getFullYear();

const base = (title: string, content: string) => `<!DOCTYPE html>
<html lang="en">
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
      <p style="margin-top:6px;">You received this email because you have an account on Common Era.</p>
    </div>
  </div>
</body>
</html>`;

export function welcomeEmail(fullName: string): string {
  const firstName = fullName.split(' ')[0];
  return base(
    'Welcome to Common Era',
    `<h1>Welcome,<br>${firstName}.</h1>
    <hr class="divider" />
    <p>Your Common Era account has been created successfully. You can now access your profile, save your favourite products, and track your orders.</p>
    <p>We're glad to have you with us.</p>
    <hr class="divider" />
    <p style="font-size:12px; color:#8F8F8F;">If you did not create this account, you can safely ignore this email.</p>`,
  );
}

export function emailChangeConfirmation(
  fullName: string,
  newEmail: string,
  confirmationUrl: string,
): string {
  const firstName = fullName.split(' ')[0];
  return base(
    'Confirm your new email address',
    `<h1>Confirm your new email.</h1>
    <hr class="divider" />
    <p>Hi <strong>${firstName}</strong>, you requested to change your email address to:</p>
    <p><strong>${newEmail}</strong></p>
    <p>Click the button below to confirm the change. The link is valid for <strong>24 hours</strong>.</p>
    <a class="btn" href="${confirmationUrl}">Confirm email</a>
    <div class="url-box">${confirmationUrl}</div>
    <hr class="divider" />
    <div class="alert-bar"><p>If you did not request this change, your current email address remains unchanged. You can safely ignore this email.</p></div>`,
  );
}

export function emailChangedAlert(oldEmail: string, fullName: string, newEmail: string): string {
  const firstName = fullName.split(' ')[0];
  return base(
    'Your email address has been updated',
    `<h1>Email updated.</h1>
    <hr class="divider" />
    <p>Hi <strong>${firstName}</strong>, your email address has been successfully updated.</p>
    <p>Your new address is: <strong>${newEmail}</strong></p>
    <p>Please use this address to sign in from now on.</p>
    <hr class="divider" />
    <div class="alert-bar"><p>If you did not authorise this change, please contact our support team immediately at <a href="mailto:support@commonera.it" style="color:#C3A88D;">support@commonera.it</a>.</p></div>`,
  );
}

export function emailVerification(fullName: string, verificationUrl: string): string {
  const firstName = fullName.split(' ')[0];
  return base(
    'Verify your email address',
    `<h1>Verify your email.</h1>
    <hr class="divider" />
    <p>Hi <strong>${firstName}</strong>, click the button below to verify your email address. The link is valid for <strong>24 hours</strong>.</p>
    <a class="btn" href="${verificationUrl}">Verify email</a>
    <div class="url-box">${verificationUrl}</div>
    <hr class="divider" />
    <div class="alert-bar"><p>If you did not request this verification, you can safely ignore this email.</p></div>`,
  );
}

export function newsletterConfirmation(name: string): string {
  return base(
    'You\'re subscribed to Common Era',
    `<h1>Welcome to the<br>Common Era circle.</h1>
    <hr class="divider" />
    <p>Hi <strong>${name}</strong>, your newsletter subscription is confirmed.</p>
    <p>You'll receive updates on new collections, exclusive drops, and offers reserved for subscribers.</p>
    <hr class="divider" />
    <p style="font-size:12px; color:#8F8F8F;">If you did not request this subscription, you can safely ignore this email. We will not send further messages without your consent.</p>`,
  );
}

export function passwordResetEmail(fullName: string, resetUrl: string): string {
  const firstName = fullName.split(' ')[0];
  return base(
    'Reimposta la tua password',
    `<h1>Reimposta la tua password.</h1>
    <hr class="divider" />
    <p>Ciao <strong>${firstName}</strong>, hai richiesto di reimpostare la password del tuo account Common Era.</p>
    <p>Clicca il pulsante qui sotto per procedere. Il link è valido per <strong>1 ora</strong>.</p>
    <a class="btn" href="${resetUrl}">Reimposta password</a>
    <div class="url-box">${resetUrl}</div>
    <hr class="divider" />
    <div class="alert-bar"><p>Se non hai richiesto questa operazione, ignora questa email. La tua password rimane invariata.</p></div>`,
  );
}

export function orderConfirmationEmail(
  fullName: string,
  order: { id: string; items: Array<{ productName: string; quantity: number; lineTotal: any }>; total: any; trackingNumber?: string },
): string {
  const firstName = fullName.split(' ')[0];
  const orderId = order.id.slice(0, 8).toUpperCase();
  const itemRows = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:10px 0; border-bottom:1px solid #F0F0F0; font-size:13px; color:#000;">${i.productName}</td>
          <td style="padding:10px 0; border-bottom:1px solid #F0F0F0; font-size:13px; color:#8F8F8F; text-align:center;">×${i.quantity}</td>
          <td style="padding:10px 0; border-bottom:1px solid #F0F0F0; font-size:13px; color:#000; text-align:right;">€${parseFloat(String(i.lineTotal)).toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  return base(
    `Ordine confermato #${orderId}`,
    `<h1>Ordine confermato.</h1>
    <hr class="divider" />
    <p>Grazie <strong>${firstName}</strong>, il tuo ordine <strong>#${orderId}</strong> è stato ricevuto ed è in elaborazione.</p>
    <table style="width:100%; border-collapse:collapse; margin: 24px 0;">
      <thead>
        <tr>
          <th style="text-align:left; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#8F8F8F; padding-bottom:8px; border-bottom:1px solid #000;">Prodotto</th>
          <th style="text-align:center; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#8F8F8F; padding-bottom:8px; border-bottom:1px solid #000;">Qtà</th>
          <th style="text-align:right; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#8F8F8F; padding-bottom:8px; border-bottom:1px solid #000;">Importo</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding-top:12px; font-size:13px; font-weight:600; color:#000;">Totale</td>
          <td style="padding-top:12px; font-size:14px; font-weight:700; color:#000; text-align:right;">€${parseFloat(String(order.total)).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    <hr class="divider" />
    <p style="font-size:12px; color:#8F8F8F;">Ti invieremo una notifica quando il tuo ordine verrà spedito.</p>`,
  );
}

export function shippingNotificationEmail(
  fullName: string,
  order: { id: string; trackingNumber?: string; trackingUrl?: string },
): string {
  const firstName = fullName.split(' ')[0];
  const orderId = order.id.slice(0, 8).toUpperCase();
  const trackingSection = order.trackingNumber
    ? `<p>Il tuo numero di tracciamento è: <strong>${order.trackingNumber}</strong></p>
       ${order.trackingUrl ? `<a class="btn" href="${order.trackingUrl}" style="margin-top:16px;">Traccia il tuo ordine</a>` : ''}`
    : '';

  return base(
    `Il tuo ordine è in spedizione`,
    `<h1>In viaggio verso di te.</h1>
    <hr class="divider" />
    <p>Ciao <strong>${firstName}</strong>, il tuo ordine <strong>#${orderId}</strong> è stato affidato al corriere.</p>
    ${trackingSection}
    <hr class="divider" />
    <p style="font-size:12px; color:#8F8F8F;">I tempi di consegna possono variare in base alla tua zona.</p>`,
  );
}

export function returnStatusUpdateEmail(
  fullName: string,
  returnId: string,
  status: string,
  adminNote?: string,
): string {
  const firstName = fullName.split(' ')[0];
  const statusLabels: Record<string, string> = {
    approved: 'Approvato',
    rejected: 'Rifiutato',
    received: 'Ricevuto',
    refunded: 'Rimborsato',
    requested: 'In attesa',
  };
  const statusLabel = statusLabels[status] ?? status;

  return base(
    'Aggiornamento reso',
    `<h1>Aggiornamento sul tuo reso.</h1>
    <hr class="divider" />
    <p>Ciao <strong>${firstName}</strong>, lo stato del tuo reso (<code style="font-family:monospace;">${returnId.slice(0, 8).toUpperCase()}</code>) è stato aggiornato:</p>
    <p style="font-size:18px; font-weight:700; color:#000;">${statusLabel}</p>
    ${adminNote ? `<div class="alert-bar"><p>${adminNote}</p></div>` : ''}
    <hr class="divider" />
    <p style="font-size:12px; color:#8F8F8F;">Per qualsiasi domanda contatta il nostro supporto: <a href="mailto:support@commonera.it" style="color:#C3A88D;">support@commonera.it</a></p>`,
  );
}

export function passwordChangedAlert(fullName: string): string {
  const firstName = fullName.split(' ')[0];
  return base(
    'Your password has been changed',
    `<h1>Password updated.</h1>
    <hr class="divider" />
    <p>Hi <strong>${firstName}</strong>, the password for your Common Era account has been successfully changed.</p>
    <p>For your security, all active sessions on other devices have been signed out.</p>
    <hr class="divider" />
    <div class="alert-bar"><p>If you did not make this change, please contact support immediately: <a href="mailto:support@commonera.it" style="color:#C3A88D;">support@commonera.it</a></p></div>`,
  );
}
