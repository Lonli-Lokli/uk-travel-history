import type { Metadata } from 'next';
import { PageWrapper } from '@/components/PageWrapper';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'Terms and conditions for using UK Travel History Parser.',
};

export default function TermsPage() {
  return (
    <PageWrapper variant="default">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">
        Terms and Conditions
      </h1>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
        <p className="text-sm text-slate-500">
          Last updated:{' '}
          {new Date().toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing and using UK Travel History Parser (&quot;the
            Service&quot;), you accept and agree to be bound by the terms and
            provisions of this agreement. If you do not agree to these terms,
            please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            2. Use of Service
          </h2>
          <p>
            The Service is provided as a tool to help individuals track their UK
            travel history and calculate days outside the UK. You agree to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the Service for lawful purposes only</li>
            <li>
              Not attempt to gain unauthorized access to any part of the Service
            </li>
            <li>
              Not use the Service in any way that could damage, disable, or
              impair it
            </li>
            <li>
              Verify all calculations independently before making immigration
              decisions
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            3. Disclaimer of Warranties
          </h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY
            KIND, EITHER EXPRESS OR IMPLIED. We do not warrant that:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The Service will meet your specific requirements</li>
            <li>
              The Service will be uninterrupted, timely, secure, or error-free
            </li>
            <li>
              The results obtained from the use of the Service will be accurate
              or reliable
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            4. Limitation of Liability
          </h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE
            SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR
            REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF
            DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your use or inability to use the Service</li>
            <li>
              Any unauthorized access to or use of our servers and/or any
              personal information stored therein
            </li>
            <li>Any errors or omissions in any content or calculations</li>
            <li>Immigration decisions made based on data from this Service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            5. Privacy and Data
          </h2>
          <p>
            We are committed to protecting your privacy. All data processing
            happens locally in your browser. We do not collect, store, or
            transmit your travel history data unless you explicitly use cloud
            backup features (when available).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            6. Not Legal Advice
          </h2>
          <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded p-4">
            <strong>Important:</strong> This Service does not provide legal
            advice. The calculations and information provided are for
            informational purposes only. You should always consult with a
            qualified immigration lawyer or advisor for guidance specific to
            your situation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            7. Changes to Terms
          </h2>
          <p>
            We reserve the right to modify these terms at any time. Continued
            use of the Service after changes constitutes acceptance of the new
            terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            8. Third-Party Services
          </h2>
          <p>
            The Service may integrate with third-party services (such as payment
            processors, authentication providers, etc.). Your use of such
            services is subject to their respective terms and conditions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            9. Contact
          </h2>
          <p>
            If you have any questions about these Terms and Conditions, please
            contact us through our GitHub repository.
          </p>
        </section>
      </div>
    </PageWrapper>
  );
}
