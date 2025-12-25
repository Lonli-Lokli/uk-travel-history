import Link from 'next/link';
import { Button, UIIcon } from '@uth/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn more about UK Travel History Parser and how it helps track your UK residency and travel days.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Back Button */}
        <Link href="/" className="inline-block mb-8">
          <Button variant="outline" size="sm">
            <UIIcon iconName="arrow-left" className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        {/* Content */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">
            About UK Travel History Parser
          </h1>

          <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                What is this tool?
              </h2>
              <p>
                UK Travel History Parser is a free, privacy-focused tool designed to help individuals
                track their UK travel history and calculate days spent outside the UK for immigration
                and residency purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Who is this for?
              </h2>
              <p>
                This tool is particularly useful for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Individuals applying for Indefinite Leave to Remain (ILR)</li>
                <li>Those tracking compliance with visa conditions</li>
                <li>Anyone needing to calculate continuous residence in the UK</li>
                <li>People monitoring the 180-day absence rule</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Key Features
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Parse UK Home Office Subject Access Request (SAR) PDF documents</li>
                <li>Manual entry and editing of travel records</li>
                <li>Automatic calculation of days outside the UK</li>
                <li>Track vignette entry dates and visa start dates</li>
                <li>Monitor continuous leave periods</li>
                <li>Check rolling 12-month absence limits</li>
                <li>Export data to Excel for record-keeping</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Privacy & Security
              </h2>
              <p>
                Your privacy is important. All data processing happens in your browser.
                Your travel history and personal information are not uploaded to any server
                unless you explicitly choose to use cloud backup features (when available).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Disclaimer
              </h2>
              <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded p-4">
                This tool is provided for informational purposes only and should not be considered
                as legal advice. Always verify your calculations and consult with an immigration
                lawyer or advisor for official guidance regarding your visa or residency status.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Support the Project
              </h2>
              <p>
                If you find this tool helpful, consider supporting its development:
              </p>
              <div className="mt-4">
                <a
                  href="https://www.buymeacoffee.com/LonliLokliV"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="bg-[#FFDD00] hover:bg-[#FFED4E] text-slate-900">
                    <UIIcon iconName="coffee" className="h-4 w-4 mr-2" />
                    Buy Me a Coffee
                  </Button>
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
