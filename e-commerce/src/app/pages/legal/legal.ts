import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

type LegalKey = 'privacy' | 'cookies' | 'terms';

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

@Component({
	selector: 'app-legal',
	imports: [],
	templateUrl: './legal.html',
	styleUrl: './legal.css',
})
export class Legal {
	private readonly route = inject(ActivatedRoute);

	pageKey: LegalKey = 'privacy';

	readonly docs: Record<LegalKey, LegalDoc> = {
		privacy: {
			title: 'Privacy Policy',
			updatedAt: '20 March 2026',
			intro: 'This website is a school demo project. It is not a real commercial service and does not process real sales transactions.',
			sections: [
				{
					heading: 'Data We Collect',
					body: 'For demo purposes, the app may temporarily handle basic form data such as login, profile, or order simulation inputs. The project is not intended for real personal data processing.',
				},
				{
					heading: 'How We Use Data',
					body: 'Any displayed data is used only to simulate e-commerce features in an educational context and to demonstrate technical functionality.',
				},
				{
					heading: 'Third Parties and Retention',
					body: 'At the moment, no external third-party providers are configured to retain user data as part of this demo project.',
				},
				{
					heading: 'Educational Scope',
					body: 'The platform is provided exclusively for school evaluation and development activities. No real customer relationship is established through this demo.',
				},
			],
		},
		cookies: {
			title: 'Cookie Policy',
			updatedAt: '27 March 2026',
			intro: 'This page explains exactly which cookies and local storage entries Common Era uses, why they are necessary, and how long they persist. We use only essential technical cookies — no advertising, analytics, or profiling cookies of any kind.',
			sections: [
				{
					heading: 'What Are Cookies?',
					body: 'Cookies are small text files that a website stores on your browser or device. They allow the site to remember information between page visits — such as whether you are logged in. Local storage works similarly but persists independently of the browser\'s cookie jar. Both can be cleared at any time from your browser settings.',
				},
				{
					heading: 'Cookies We Use',
					body: 'The table below lists every cookie and storage entry set by Common Era. We do not use any third-party, advertising, or tracking cookies.',
					cookies: [
						{
							name: 'access_token',
							type: 'HTTP Cookie (HttpOnly)',
							purpose: 'Stores your authentication session as a signed JWT token. Sent automatically with every request to keep you logged in across page reloads. HttpOnly means it cannot be read by JavaScript — only by the server.',
							duration: '7 days (deleted on logout)',
							category: 'Essential',
						},
						{
							name: 'common_era_cookie_consent',
							type: 'localStorage',
							purpose: 'Remembers your cookie consent decision ("accepted" or "rejected") so the consent banner does not reappear on subsequent visits.',
							duration: 'Persistent (until you clear browser storage)',
							category: 'Essential',
						},
					],
				},
				{
					heading: 'Essential Cookies — Always Active',
					body: 'Essential cookies cannot be disabled because the site cannot function without them. The authentication cookie is required to keep you logged in; removing it logs you out immediately. The consent cookie is required to honour your own preference and avoid showing the banner on every page load.',
				},
				{
					heading: 'No Analytics or Marketing Cookies',
					body: 'Common Era does not use Google Analytics, Meta Pixel, advertising networks, or any other third-party tracking service. No data about your browsing behaviour is shared with external parties. This is a school demo project with no commercial data collection.',
				},
				{
					heading: 'How to Manage or Delete Cookies',
					body: 'You can delete all cookies and local storage at any time:\n• Chrome / Edge: Settings → Privacy and security → Clear browsing data\n• Firefox: Settings → Privacy & Security → Cookies and Site Data → Clear Data\n• Safari: Settings → Advanced → Website Data → Remove All Website Data\n\nDeleting the access_token cookie will log you out. Deleting common_era_cookie_consent will cause the consent banner to reappear on your next visit.',
				},
				{
					heading: 'Changes to This Policy',
					body: 'If new cookies are introduced (e.g. analytics in a future version), this page will be updated before deployment and the consent banner will reappear to collect a fresh decision.',
				},
			],
		},
		terms: {
			title: 'Terms of Service',
			updatedAt: '20 March 2026',
			intro: 'These terms govern access to a non-commercial school demo of COMMON ERA.',
			sections: [
				{
					heading: 'Use of the Service',
					body: 'You agree to use the demo lawfully and only for testing, study, and educational demonstration purposes.',
				},
				{
					heading: 'No Real Purchases',
					body: 'Products, checkout, and payment flows are simulated. No real contract of sale is created and no real payment is required.',
				},
				{
					heading: 'Liability and Updates',
					body: 'Content may change during development. The project team may update these terms and demo features at any time.',
				},
			],
		},
	};

	get doc(): LegalDoc {
		return this.docs[this.pageKey];
	}

	constructor() {
		this.route.paramMap.subscribe((params) => {
			const page = params.get('pagina');
			this.pageKey = this.asLegalKey(page);
		});
	}

	private asLegalKey(value: string | null): LegalKey {
		if (value === 'privacy' || value === 'cookies' || value === 'terms') {
			return value;
		}
		return 'privacy';
	}
}
