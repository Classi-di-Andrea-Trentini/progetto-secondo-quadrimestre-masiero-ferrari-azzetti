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
