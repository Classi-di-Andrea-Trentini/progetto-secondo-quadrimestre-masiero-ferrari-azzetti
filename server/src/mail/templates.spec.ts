import {
  escapeHtml,
  escapeUrl,
  welcomeEmail,
  newsletterConfirmation,
  returnStatusUpdateEmail,
  shippingNotificationEmail,
} from './templates';

describe('escapeHtml', () => {
  it('neutralizza i caratteri che aprono tag e attributi', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(escapeHtml('a "b" \'c\' & d')).toBe('a &quot;b&quot; &#39;c&#39; &amp; d');
  });

  it('tratta null e undefined come stringa vuota', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('escapeUrl', () => {
  it('lascia passare http e https', () => {
    expect(escapeUrl('https://commonera.it/track/1')).toBe('https://commonera.it/track/1');
    expect(escapeUrl('http://localhost:3000/x')).toBe('http://localhost:3000/x');
  });

  it('scarta gli schemi pericolosi in un href', () => {
    // `trackingUrl` lo scrive un admin dal pannello: se ci finisce dentro un javascript:
    // il link nella mail diventa codice che parte al click.
    expect(escapeUrl('javascript:alert(1)')).toBe('');
    expect(escapeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('');
    expect(escapeUrl('non-un-url')).toBe('');
    expect(escapeUrl(undefined)).toBe('');
  });
});

describe('email transazionali', () => {
  // Questo e' il payload reale del finding A5: `fullName` e' validato solo in lunghezza,
  // quindi uno si registra cosi' e ogni email che riceve (o che riceve chi lo cita) mostra
  // un link cliccabile dentro un messaggio inviato dal dominio vero del progetto.
  const phishing = '<a href="http://evil.example">Servizio Clienti</a>';

  it('non lascia HTML vivo nel nome del destinatario', () => {
    const html = welcomeEmail(phishing);
    // Nota: qui il template usa solo la prima parola del nome (`fullName.split(' ')[0]`),
    // quindi finisce nell'email il pezzo `<a` — che infatti esce escapato.
    expect(html).not.toContain('<a href="http://evil.example">');
    expect(html).toContain('&lt;a');
  });

  it('non lascia HTML vivo nel nome della newsletter', () => {
    const html = newsletterConfirmation(phishing);
    expect(html).not.toContain('<a href="http://evil.example">');
    expect(html).toContain('&lt;a href=&quot;http://evil.example&quot;&gt;');
  });

  it('non lascia HTML vivo nella nota dell-amministratore sul reso', () => {
    const html = returnStatusUpdateEmail(
      'Mario Rossi',
      '11111111-2222-3333-4444-555555555555',
      'approved',
      '<img src=x onerror=alert(1)>',
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('non mette in href un tracking url con schema javascript', () => {
    const html = shippingNotificationEmail('Mario Rossi', {
      id: '11111111-2222-3333-4444-555555555555',
      trackingNumber: 'ABC123',
      trackingUrl: 'javascript:alert(1)',
    });
    expect(html).not.toContain('javascript:');
  });

  it('lascia intatto un nome normale', () => {
    expect(welcomeEmail('Mario Rossi')).toContain('Mario');
  });
});
