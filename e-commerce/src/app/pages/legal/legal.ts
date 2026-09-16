import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Le chiavi valide. `recesso` e `spedizioni-e-resi` sono obbligatorie per vendere
 * online in UE (artt. 49 e 52 del Codice del consumo) e prima non esistevano.
 */
export type LegalKey = 'privacy' | 'cookies' | 'terms' | 'recesso' | 'spedizioni-e-resi';

export const LEGAL_KEYS: readonly LegalKey[] = [
  'privacy',
  'cookies',
  'terms',
  'recesso',
  'spedizioni-e-resi',
];

type CookieRow = { name: string; type: string; purpose: string; duration: string; category: string };

type LegalSection = {
  heading: string;
  body: string;
  cookies?: CookieRow[];
};

type LegalDoc = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

/**
 * Le pagine legali.
 *
 * <h2>I segnaposto fra parentesi quadre</h2>
 *
 * `[RAGIONE SOCIALE]`, `[P.IVA]`, `[SEDE LEGALE]`, `[PEC]`, `[REA]` sono **voluti** e
 * devono restare visibili finche' non c'e' un'azienda vera dietro. Inventare una
 * partita IVA o una sede per far sembrare completa una pagina significa pubblicare
 * dati falsi di un soggetto che non esiste: e' peggio di un buco evidente, perche'
 * un buco evidente qualcuno lo riempie prima di andare online.
 *
 * <h2>I numeri qui dentro sono quelli veri</h2>
 *
 * Costi e tempi di spedizione non sono inventati per riempire la pagina: vengono da
 * `CheckoutService` (4,90 € standard, 9,90 € express, gratis sopra i 100 €) e dalle
 * regole dei resi (`ReturnService` accetta richieste solo su ordini consegnati o
 * completati). Se quelle cifre cambiano, questa pagina va cambiata insieme a loro,
 * altrimenti il negozio dichiara ai clienti condizioni che poi non applica.
 */
@Component({
  selector: 'app-legal',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './legal.html',
  styleUrl: './legal.css',
})
export class Legal {
  private readonly route = inject(ActivatedRoute);

  /** `null` quando l'indirizzo non corrisponde a nessuna pagina: si mostra il 404. */
  readonly pageKey = signal<LegalKey | null>('privacy');

  readonly docs: Record<LegalKey, LegalDoc> = {
    // ─── Privacy ───────────────────────────────────────────────────────────
    privacy: {
      title: 'Privacy notice',
      updatedAt: '16 September 2026',
      intro:
        'This notice explains what personal data we collect when you use Common Era, why we collect it, how long we keep it, and what rights you can exercise. It is provided under Articles 13 and 14 of Regulation (EU) 2016/679 (GDPR).',
      sections: [
        {
          heading: '1. Data controller',
          body: 'The data controller is [RAGIONE SOCIALE], with registered office in [SEDE LEGALE], VAT number [P.IVA], registered with the Companies Register under REA number [REA].\n\nFor any question about your personal data you can write to [PEC].\n\nWe have not appointed a Data Protection Officer (DPO), as the cases set out in Article 37 of the GDPR do not apply to us.',
        },
        {
          heading: '2. What data we process',
          body:
            'Registration and account data: first and last name, email address, password (stored only as a hash, never in plain text), and optionally phone number, date of birth and gender, if you choose to provide them.\n\n' +
            'Google sign-in data, if you choose to use it: your email address, the name on your Google profile, and the stable numeric identifier Google assigns to your account. That identifier is what lets us find your account again even if you change your email address, and it tells anyone reading it nothing about you. We never receive or store your Google password, and we have no access to any other data in your Google account — not your mail, not your contacts, not your files. If you don\'t use that button, nothing is shared with Google.\n\n' +
            'Purchase data: shipping and billing addresses, order contents, amounts, gift cards and loyalty points used, invoice number and date.\n\n' +
            'Payment data: your card details never pass through or are stored on our systems. They are processed directly by Stripe, which receives the payment; we only keep the outcome of the transaction and its identifier.\n\n' +
            'Content you publish: reviews, ratings and photos you choose to attach.\n\n' +
            'Technical data: IP address and browser type associated with the login session, for security purposes.',
        },
        {
          heading: '3. Why we process it and on what legal basis',
          body:
            'To perform the sales contract — managing the order, shipping, returns and customer support. Legal basis: Article 6(1)(b) GDPR (performance of a contract to which you are a party). Providing this data is necessary: without it we cannot complete the order.\n\n' +
            'To comply with legal obligations — issuing and retaining invoices, tax and accounting obligations. Legal basis: Article 6(1)(c) GDPR (legal obligation).\n\n' +
            'To manage the account and login security — keeping the session active, verifying the email address, preventing abuse and fraud. Legal basis: Article 6(1)(b) and 6(1)(f) GDPR (legitimate interest in the security of the service). This also covers Google sign-in, if you choose it: it is one of the ways of performing the contract you are a party to, not a further processing activity, and not using it costs you nothing — signing in with email and password always remains available.\n\n' +
            'To send the newsletter — only if you request it. Legal basis: Article 6(1)(a) GDPR (consent), which you can withdraw at any time from your account settings or the link at the bottom of every email, without affecting the lawfulness of processing carried out before the withdrawal.\n\n' +
            'To publish reviews — on your own initiative. Legal basis: Article 6(1)(a) GDPR (consent).',
        },
        {
          heading: '4. Who we share data with',
          body:
            'Your data is never sold or passed on to third parties for marketing purposes. It is shared only with those who help us get you what you ordered:\n\n' +
            '• Stripe Payments Europe, Ltd. — card payment processing;\n' +
            '• Google Ireland Limited — only if you choose to sign in with Google, and only the moment you press that button. Your browser is sent to Google\'s page, which returns your email address, your Google profile name and an identifier for your account. Google acts here as an independent controller for your Google account: its notice is at policies.google.com/privacy. We do not tell it what you bought, what you looked at, or how much you spent;\n' +
            '• the courier responsible for delivery — name, address, phone number, to deliver the parcel;\n' +
            '• our transactional email provider — to send you order confirmations and service communications;\n' +
            '• the provider of the infrastructure hosting the site;\n' +
            '• our tax and accounting advisor, for statutory compliance;\n' +
            '• public authorities, when required by law.\n\n' +
            'Providers who process data on our behalf act as data processors, appointed under Article 28 GDPR.\n\n' +
            'Transfers outside the EU: some providers may process data outside the European Economic Area. In that case the transfer relies on an adequacy decision of the European Commission or on the Standard Contractual Clauses under Article 46(2)(c) GDPR.',
        },
        {
          heading: '5. How long we keep it',
          body:
            'Account data: for as long as the account stays active. If you delete it, your personal data is anonymised immediately.\n\n' +
            'Invoices, orders and accounting records: ten years from the date of registration, as required by Article 2220 of the Codice civile. This period cannot be shortened on request: it is a legal obligation and takes precedence over an erasure request, as allowed under Article 17(3)(b) GDPR.\n\n' +
            'Browsing data and login sessions: until the session expires, seven days at most.\n\n' +
            'Reviews: for as long as they remain published; they are removed if you delete your account.\n\n' +
            'Email address for the newsletter: until you withdraw consent.',
        },
        {
          heading: '6. Your rights',
          body:
            'You can exercise the rights set out in Articles 15 to 22 of the GDPR at any time:\n\n' +
            '• access: find out what data we process and get a copy of it;\n' +
            '• rectification: correct inaccurate or incomplete data;\n' +
            '• erasure: have your data removed, except what we must keep by law;\n' +
            '• restriction: ask that processing be suspended while something is being checked;\n' +
            '• portability: receive your data in a structured, machine-readable format;\n' +
            '• objection: object to processing based on our legitimate interest;\n' +
            '• withdrawal of consent: withdraw consent wherever it is the legal basis for processing.\n\n' +
            'Two of these rights you can exercise yourself, right away, without writing to anyone: the Settings section of your account has "Download your data", which gives you a file with everything we keep about you, and "Delete account", which anonymises your personal data.\n\n' +
            'For the other rights, write to [PEC]. We reply within one month of the request, extendable by two months for complex cases, in which case we will let you know.\n\n' +
            'We do not carry out automated decision-making or profiling under Article 22 GDPR.',
        },
        {
          heading: '7. Complaints to the supervisory authority',
          body:
            'If you believe our processing of your data breaches the GDPR, you have the right to lodge a complaint with a supervisory authority.\n\n' +
            'In Italy this is the Garante per la protezione dei dati personali (the Italian Data Protection Authority), Piazza Venezia 11, 00187 Roma — phone +39 06 696771, email protocollo@gpdp.it, PEC protocollo@pec.gpdp.it, website www.garanteprivacy.it.\n\n' +
            'You may alternatively contact the supervisory authority of the Member State where you live or work, or bring the matter before the courts.',
        },
        {
          heading: '8. Security',
          body:
            'We adopt technical and organisational measures appropriate to the risk: passwords stored only as BCrypt hashes, HTTPS-encrypted connections, HttpOnly session cookies not readable by JavaScript, rate-limiting on repeated login attempts, and access to data restricted to those who need it.\n\n' +
            'No measure removes the risk entirely. In the event of a personal data breach that poses a high risk to your rights, we will inform you without undue delay, as required by Article 34 GDPR.',
        },
        {
          heading: '9. Changes to this notice',
          body:
            'If the purposes, legal bases or recipients change, we update this page and change the date shown at the top. When changes are material, we tell you by email before they take effect.',
        },
      ],
    },

    // ─── Cookie ────────────────────────────────────────────────────────────
    cookies: {
      title: 'Cookie policy',
      updatedAt: '16 September 2026',
      intro:
        'This page lists, one by one, the cookies and local storage entries that Common Era uses, what they are for, and how long they last. We use technical cookies only: no analytics, advertising or profiling cookies of any kind.',
      sections: [
        {
          heading: 'What cookies are',
          body: 'Cookies are small text files a site saves in your browser. They let the site remember something from one page to the next — for example that you\'re signed in. "Local storage" works in a similar way, but it stays in the browser independently of cookies. Both can be cleared at any time from your browser settings.',
        },
        {
          heading: 'Why we don\'t ask for your consent',
          body: 'Article 122 of the Italian Codice Privacy, which transposes the ePrivacy Directive, requires prior consent only for non-technical cookies — non-anonymised analytics, advertising and profiling cookies. For technical cookies, meaning those without which the service you asked for doesn\'t work, it is enough to inform you: which is what this page does.\n\nEvery cookie listed below is technical. That\'s why the notice you see on your first visit has no "Reject" button: there would be nothing to reject, and a rejection that rejects nothing would just be a fiction. If we ever introduce non-technical cookies, this page will be updated first and the notice will go back to asking you for a real choice.',
        },
        {
          heading: 'The cookies we use',
          body: 'The table lists everything saved in your browser by Common Era and by Stripe, the provider that handles card payments. Some entries appear only at certain times: the Google sign-in cookie exists only for the few minutes of that step, and Stripe\'s only if you reach the payment page.',
          cookies: [
            {
              name: 'access_token',
              type: 'HTTP cookie (HttpOnly)',
              purpose:
                'Keeps the login session alive as a signed token. It is sent with every request to keep you signed in even after reloading the page. Being HttpOnly, it cannot be read by JavaScript, only by the server.',
              duration: '7 days (removed on sign-out)',
              category: 'Technical',
            },
            {
              name: 'common_era_cookie_consent',
              type: 'localStorage',
              purpose:
                'Remembers that you have already read the cookie notice, so it doesn\'t reappear on every page. It only holds the date it was read.',
              duration: 'Permanent (until you clear your browser data)',
              category: 'Technical',
            },
            {
              name: 'commonera_cart',
              type: 'localStorage',
              purpose:
                'Keeps your cart when you browse without signing in, so you don\'t lose what you chose when changing page. It is merged into your account cart when you sign in.',
              duration: 'Permanent (until you clear your browser data)',
              category: 'Technical',
            },
            {
              name: 'oauth2_auth_request',
              type: 'HTTP cookie (HttpOnly)',
              purpose:
                'Appears only if you press "Sign in with Google". It keeps, for the time it takes to go to Google and back, the check code the server uses to recognise that it\'s you coming back and not someone else. Without it, sign-in couldn\'t be completed securely. It is deleted as soon as the round trip ends, whether it succeeds or not.',
              duration: '5 minutes',
              category: 'Technical',
            },
            {
              name: '__stripe_mid',
              type: 'HTTP cookie (third party: Stripe)',
              purpose:
                'Set by Stripe during payment to prevent fraud. It identifies the device across multiple sessions and lets Stripe recognise abnormal payment attempts. Necessary to securely process the payment you requested.',
              duration: '1 year',
              category: 'Technical',
            },
            {
              name: '__stripe_sid',
              type: 'HTTP cookie (third party: Stripe)',
              purpose:
                'Set by Stripe during payment, with the same anti-fraud function as __stripe_mid, but limited to a single payment session.',
              duration: '30 minutes',
              category: 'Technical',
            },
          ],
        },
        {
          heading: 'Stripe\'s cookies',
          body: 'The cookies __stripe_mid and __stripe_sid are set by Stripe Payments Europe, Ltd., which acts as an independent controller for fraud-prevention purposes. They are set only when you reach the payment page: if you browse the catalogue without buying anything, they never appear.\n\nThey serve to carry out the payment service you asked for, so they count as technical cookies and don\'t require consent. Stripe\'s privacy notice is available at stripe.com/privacy.',
        },
        {
          heading: 'No analytics or advertising cookies',
          body:
            'Common Era does not use Google Analytics, Meta Pixel, ad networks or any other third-party tracking service. No data about your browsing behaviour is shared with outside parties for commercial purposes.\n\n' +
            'One clarification, because the two things are easily confused: the site offers sign-in with Google. That isn\'t tracking — it\'s authentication, and it only happens if you press that button yourself. Google receives no data about the pages you visit, gives us no advertising profile, and sets no cookies on this site: the consent screen opens on Google\'s own domain, and the cookies you see there are Google\'s and follow Google\'s notice. It is nonetheless a disclosure of personal data to an outside party, and it is declared as such in the privacy notice, at point 4.',
        },
        {
          heading: 'How to delete cookies',
          body:
            'You can delete cookies and local storage at any time:\n' +
            '• Chrome and Edge: Settings → Privacy and security → Clear browsing data\n' +
            '• Firefox: Settings → Privacy & Security → Cookies and Site Data → Clear Data\n' +
            '• Safari: Settings → Advanced → Website Data → Remove All\n\n' +
            'Deleting access_token will sign you out. Deleting common_era_cookie_consent will make the notice reappear on your next visit. You can re-read this notice whenever you like from the "Manage cookies" link at the bottom of every page.',
        },
        {
          heading: 'Changes to this page',
          body: 'If we introduce new cookies, this page will be updated before they go live. If they turned out to be non-technical cookies, the notice would reappear to collect real, granular, revocable consent.',
        },
      ],
    },

    // ─── Condizioni di vendita ─────────────────────────────────────────────
    terms: {
      title: 'Terms & Conditions of Sale',
      updatedAt: '15 September 2026',
      intro:
        'These terms govern distance sales contracts concluded through the Common Era site. They form an integral part of every order: accepting them is a condition of purchase. We recommend saving or printing a copy.',
      sections: [
        {
          heading: '1. The seller',
          body: 'The seller is [RAGIONE SOCIALE], with registered office in [SEDE LEGALE], VAT number [P.IVA], registered with the Companies Register under REA number [REA], PEC [PEC].',
        },
        {
          heading: '2. Scope',
          body: 'These terms apply to sales made to consumers under Article 3 of the Codice del consumo (Legislative Decree 206/2005), meaning natural persons acting for purposes outside their trade, business or profession.\n\nIf you purchase using a VAT number you are acting as a business: in that case the rules on the right of withdrawal and the statutory conformity guarantee reserved for consumers do not apply.',
        },
        {
          heading: '3. Products and availability',
          body: 'Product images and descriptions are intended to represent the items as faithfully as possible. Colour differences due to screen rendering or slight variations in natural materials do not constitute a lack of conformity.\n\nThe availability shown is updated in real time, but it can change between the moment you add an item to your cart and the moment you complete the order. If an item turns out to be unavailable after the order is placed, we will notify you and refund the corresponding amount in full.',
        },
        {
          heading: '4. Prices',
          body: 'All prices are in euro and include VAT. Shipping costs are shown separately before the order is confirmed and added to the total.\n\nThe applicable price is the one shown when the order is submitted. We reserve the right to change prices at any time, without affecting orders already confirmed.\n\nIn the event of an obvious pricing error — an amount plainly inconsistent with the value of the item — we will contact you before proceeding with the order, and you may confirm it at the correct price or cancel it at no cost.',
        },
        {
          heading: '5. How the contract is formed',
          body:
            'The presentation of products on the site is an invitation to treat. The contract is formed when we send you the order confirmation by email, not when the order is submitted.\n\n' +
            'Before submitting the order you are shown a complete summary with products, quantities, unit price, shipping costs and total due, and you can correct any input errors.\n\n' +
            'The order confirmation summarises all the information required by Article 51 of the Codice del consumo and counts as confirmation on a durable medium.',
        },
        {
          heading: '6. Payments',
          body: 'Card payments are handled by Stripe Payments Europe, Ltd. over an encrypted connection. Your card details never pass through or are stored on our servers: Stripe processes them directly.\n\nYou can also use gift cards we have issued and loyalty points from previous purchases, to offset the price in full or in part. Any remaining balance must be paid by card.\n\nThe order is processed only after payment is confirmed. A failed payment results in the order being cancelled and the items becoming available again.',
        },
        {
          heading: '7. Invoicing',
          body: 'An invoice is issued for every order, downloadable as a PDF from the "My orders" section of your account. The billing details are the ones you provided when placing the order: they cannot be changed once the document has been issued.',
        },
        {
          heading: '8. Delivery',
          body: 'Delivery times, costs and methods are described on the Shipping & Returns page, which forms an integral part of these terms.\n\nUnder Article 61 of the Codice del consumo, delivery takes place within thirty days of the contract being formed, unless a different time has been agreed. The risk of loss or damage to the goods passes to you when you, or a third party you designate other than the carrier, take physical possession of the goods.',
        },
        {
          heading: '9. Right of withdrawal',
          body: 'If you are a consumer you have fourteen days to withdraw from the purchase without giving a reason. The procedure, time limits and model form are described on the Right of Withdrawal page, which forms an integral part of these terms.',
        },
        {
          heading: '10. Statutory conformity guarantee',
          body:
            'All products are covered by the statutory conformity guarantee set out in Articles 128 to 135-septies of the Codice del consumo: if the item delivered is defective or does not match what was ordered, you are entitled to have conformity restored, through free repair or replacement, and failing that to a price reduction or termination of the contract.\n\n' +
            'The guarantee lasts two years from delivery. The defect must be reported within two months of discovery. For the first twelve months the defect is presumed to have already existed at the time of delivery, unless proven otherwise.\n\n' +
            'The guarantee does not cover damage resulting from misuse, negligence, impact or normal wear.',
        },
        {
          heading: '11. Complaints and dispute resolution',
          body:
            'For any complaint you can write to [PEC]. We reply within fifteen business days.\n\n' +
            'If we cannot reach an agreement, as a consumer you can turn to the European Online Dispute Resolution (ODR) platform set up by the European Commission, or start a mediation procedure under Legislative Decree 28/2010. Using these procedures is optional and does not affect your right to go to court.',
        },
        {
          heading: '12. Governing law and jurisdiction',
          body: 'These contracts are governed by Italian law. If you are a consumer, the mandatory provisions more favourable to you under the law of your country of residence still apply, and the competent court is that of your place of residence or elected domicile, under Article 66-bis of the Codice del consumo.',
        },
        {
          heading: '13. Changes',
          body: 'We may change these terms at any time. Sales already concluded are always governed by the version in force when the order was submitted, as recorded in the order confirmation.',
        },
      ],
    },

    // ─── Recesso ───────────────────────────────────────────────────────────
    recesso: {
      title: 'Right of Withdrawal',
      updatedAt: '15 September 2026',
      intro:
        'If you buy as a consumer you have fourteen days to change your mind and return what you bought, with no need to explain why and no penalty. It is a right set out in Articles 52 to 59 of the Codice del consumo (Legislative Decree 206/2005) and it cannot be taken away from you.',
      sections: [
        {
          heading: 'How much time you have',
          body: 'Fourteen calendar days, running from the day you, or a third party you designate other than the carrier, take physical delivery of the goods.\n\nIf a single order includes several goods delivered separately, the period runs from the day you receive the last item.\n\nTo meet the deadline it is enough to send the withdrawal notice before it expires: the goods do not need to have already come back to us.',
        },
        {
          heading: 'How to notify us of your withdrawal',
          body:
            'You can do this in two ways, whichever you prefer.\n\n' +
            'From the site: open the "My orders" section of your account, select the order and use the "Request a return" button, indicating the items to return. The request is logged with date and time, and you receive confirmation by email.\n\n' +
            'In writing: send an explicit statement to [PEC], using the model withdrawal form below or any other clear statement expressing your wish to withdraw. Using the form is not mandatory.\n\n' +
            'We will send you, without delay, an acknowledgement of receipt of the request on a durable medium.',
        },
        {
          heading: 'How to return the goods',
          body:
            'After notifying us of your withdrawal you must return the goods within fourteen days, to the address we will give you in the confirmation email.\n\n' +
            'Goods must be returned intact, complete with every part and accessory, with the original tags still attached and in their original packaging where possible.\n\n' +
            'You may handle and try the goods only as much as is needed to establish their nature, characteristics and how they work, exactly as you would in a physical shop. You are liable for any decrease in value resulting from handling beyond that: in that case we may deduct an amount corresponding to the loss in value from the refund.',
        },
        {
          heading: 'Who pays for the return',
          body: 'The direct cost of returning the goods is at your expense, as allowed by Article 57 of the Codice del consumo, and this page informs you of that before purchase as the law requires.\n\nThe exception is when the item is defective, non-conforming or different from what was ordered: in that case the return costs you nothing and the expense is ours.\n\nWe recommend keeping the shipping receipt: until the goods reach us, the risk of transport remains yours.',
        },
        {
          heading: 'When and how we refund you',
          body:
            'We refund all payments received, including standard delivery costs, within fourteen days of being informed of your withdrawal.\n\n' +
            'We may, however, withhold the refund until we receive the goods, or until you provide proof of having shipped them, whichever happens first.\n\n' +
            'The refund is made using the same payment method you used for the purchase, unless you expressly agree otherwise, and it never involves any cost to you. Gift cards and loyalty points used are credited back to your account.\n\n' +
            'If you had chosen a faster shipping method than standard, we refund the amount of standard shipping: the difference remains at your expense.',
        },
        {
          heading: 'When the right of withdrawal does not apply',
          body:
            'Article 59 of the Codice del consumo excludes the right of withdrawal in some cases. Among those that can apply to this shop:\n\n' +
            '• goods made to measure or clearly personalised at your request;\n' +
            '• sealed goods that are not suitable for return for hygiene reasons, if they were unsealed after delivery;\n' +
            '• goods that, after delivery, become inseparably mixed with other items.\n\n' +
            'When a product falls into one of these categories, the exclusion is stated on the product page before purchase.',
        },
        {
          heading: 'Model withdrawal form',
          body:
            'Complete and return this form only if you wish to withdraw from the contract. Using it is not mandatory.\n\n' +
            '— — — — — — — — — — — — — — — — — — — — — — — — — — — — — —\n\n' +
            'To: [RAGIONE SOCIALE], [SEDE LEGALE], PEC [PEC]\n\n' +
            'I/We (*) hereby give notice (*) that I/we (*) withdraw from my/our (*) contract of sale of the following goods (*):\n\n' +
            '____________________________________________\n\n' +
            'Ordered on (*) / received on (*): ____________________\n\n' +
            'Order number: ____________________\n\n' +
            'Name of consumer(s): ____________________\n\n' +
            'Address of consumer(s): ____________________\n\n' +
            'Signature of consumer(s) (only if this form is notified on paper): ____________________\n\n' +
            'Date: ____________________\n\n' +
            '(*) Delete as appropriate.\n\n' +
            '— — — — — — — — — — — — — — — — — — — — — — — — — — — — — —',
        },
      ],
    },

    // ─── Spedizioni e resi ─────────────────────────────────────────────────
    'spedizioni-e-resi': {
      title: 'Shipping & Returns',
      updatedAt: '15 September 2026',
      intro:
        'How much shipping costs, how long it takes for the parcel to arrive, and what to do if what you received isn\'t right. The figures given here are the same ones the cart applies when you place an order.',
      sections: [
        {
          heading: 'Where we ship',
          body: 'We ship throughout Italy, islands included. For deliveries outside Italian territory, write to us at [PEC] before ordering: timing and costs are agreed case by case.',
        },
        {
          heading: 'Shipping costs',
          body:
            'Standard shipping: €4.90.\n' +
            'Express shipping: €9.90.\n\n' +
            'Standard shipping is free for orders that, after any discounts and promo codes are applied, reach €100. The threshold is calculated on the amount actually charged after discount, not on the list price.\n\n' +
            'The exact cost is shown in the summary before the order is confirmed, and appears as a separate line on the invoice.',
        },
        {
          heading: 'Delivery times',
          body:
            'Standard shipping: 3-5 business days from when the courier takes the parcel.\n' +
            'Express shipping: 1-2 business days from when the courier takes the parcel.\n\n' +
            'Orders received and paid for by 1:00 pm on a business day are normally handed to the courier the same day; later orders go out the next business day. Saturdays, Sundays and public holidays are not business days.\n\n' +
            'During sales periods and in the weeks before holidays, times can stretch by a day or two. In any case, under Article 61 of the Codice del consumo, delivery takes place within thirty days of the contract being formed.',
        },
        {
          heading: 'How to track your shipment',
          body: 'As soon as the parcel is sent you receive an email with the tracking number. The same number, with a link to the courier\'s site, is always visible in the "My orders" section of your account, along with the full history of the order\'s status.',
        },
        {
          heading: 'If the parcel doesn\'t arrive or arrives damaged',
          body:
            'When the parcel is delivered, check that the packaging is intact. If it is visibly damaged or tampered with, accept the parcel with a written note on the courier\'s document and report it to us within seven days: without that note, a claim against the carrier becomes much harder.\n\n' +
            'If the parcel is marked as delivered but you never received it, write to us at [PEC]: we will open the case with the courier ourselves. Until delivery, the risk of loss or damage remains ours.',
        },
        {
          heading: 'Returns: two different paths',
          body:
            'Change of mind — you have fourteen days to return your purchase without giving a reason. This is the right of withdrawal: the procedure, time limits and model form are on the dedicated page. Return shipping costs are at your expense.\n\n' +
            'Defective or wrong product — if what you received is defective, non-conforming or different from what you ordered, the statutory conformity guarantee applies, lasting two years from delivery. In this case the return costs you nothing and you are entitled to free repair or replacement, and failing that to a price reduction or termination of the contract.',
        },
        {
          heading: 'How to open a return',
          body:
            '1. Go to the "My orders" section of your account. A request can be opened on orders that are already delivered or completed.\n' +
            '2. Press "Request a return" on the order, choose which items to return and in what quantity, and describe the reason in at least ten characters.\n' +
            '3. You receive the request confirmation by email, with the address to ship to and instructions.\n' +
            '4. Ship the goods within fourteen days of the request, keeping the receipt.\n' +
            '5. On receipt we check the condition of the goods and process the refund.\n\n' +
            'You can follow the status of the request on the same page: requested, approved, received, refunded — or rejected, with the reason given.',
        },
        {
          heading: 'Refund times',
          body: 'The refund is issued within fourteen days of when we receive the withdrawal notice, though we may wait for the goods or proof of shipment first.\n\nWhen the amount reaches your payment method then depends on your card issuer\'s own processing times, normally three to five business days. Gift cards and loyalty points become available on your account again immediately.',
        },
        {
          heading: 'Exchanges',
          body: 'We do not offer direct size or colour exchanges: availability changes too quickly for us to guarantee you the item for the time it takes the return to travel back to us. Open a return for the item that doesn\'t work and order what you want separately: it\'s faster and it ensures you get the size while it\'s still in stock.',
        },
      ],
    },
  };

  /** Il documento da mostrare, oppure `null` quando la pagina non esiste. */
  get doc(): LegalDoc | null {
    const key = this.pageKey();
    return key === null ? null : this.docs[key];
  }

  constructor() {
    this.route.paramMap.subscribe((params) => {
      this.pageKey.set(asLegalKey(params.get('pagina')));
    });
  }
}

/**
 * La chiave della pagina, o `null` se non corrisponde a niente.
 *
 * Prima qualunque stringa sconosciuta ricadeva su `privacy`: `/legal/qualsiasi-cosa`
 * rispondeva con l'informativa privacy e con uno stato 200. Per un motore di ricerca
 * significava un numero illimitato di URL diversi che servivano tutti la stessa
 * pagina — contenuto duplicato — e per una persona significava trovarsi davanti un
 * documento che non aveva chiesto, senza capire di aver sbagliato indirizzo.
 */
export function asLegalKey(value: string | null): LegalKey | null {
  return LEGAL_KEYS.includes(value as LegalKey) ? (value as LegalKey) : null;
}
