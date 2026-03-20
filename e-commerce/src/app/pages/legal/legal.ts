import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type LegalKey = 'privacy' | 'cookies' | 'terms';

type LegalDoc = {
	title: string;
	updatedAt: string;
	intro: string;
	sections: Array<{ heading: string; body: string }>;
};

@Component({
	selector: 'app-legal',
	imports: [RouterLink],
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
			updatedAt: '20 March 2026',
			intro: 'This school demo uses only technical cookies required for basic application behavior.',
			sections: [
				{
					heading: 'Essential Cookies',
					body: 'Essential cookies are used to manage minimal session state and the cookie consent decision needed to access the app.',
				},
				{
					heading: 'No Marketing Cookies',
					body: 'This demo does not use advertising, profiling, or third-party marketing cookies.',
				},
				{
					heading: 'Managing Cookies',
					body: 'You can clear browser storage at any time. Disabling technical cookies may prevent access to protected demo flows.',
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
