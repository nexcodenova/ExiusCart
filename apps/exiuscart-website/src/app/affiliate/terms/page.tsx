import Link from 'next/link';

export const metadata = {
  title: 'Affiliate Program Terms & Conditions — ExiusCart',
  description: 'Full legal terms and conditions governing the ExiusCart Affiliate Program, including commission rates, tracking, cookie policy, fraud rules, payout conditions, and applicable law.',
};

export default function AffiliateTermsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold"><span className="text-[#6B3FD9]">Exius</span>Cart</Link>
          <Link href="/affiliate" className="text-sm text-slate-500 hover:text-slate-900 transition">
            ← Back to Affiliate Program
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Document header */}
        <div className="border-b border-slate-200 pb-10 mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B3FD9] mb-3">ExiusCart Affiliate Program</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-4">Affiliate Program<br />Terms &amp; Conditions</h1>
          <p className="text-sm text-slate-500">
            <strong>Effective date:</strong> 1 June 2026 &nbsp;·&nbsp;
            <strong>Operated by:</strong> NexCodeNova &nbsp;·&nbsp;
            <strong>Applies to:</strong> All participants in the ExiusCart Affiliate Program
          </p>
          <p className="mt-4 text-sm text-slate-600 leading-relaxed max-w-3xl">
            By applying to, being accepted into, or continuing to participate in the ExiusCart Affiliate Program (&ldquo;Program&rdquo;), you (&ldquo;Affiliate&rdquo;) agree to be fully bound by these Terms &amp; Conditions (&ldquo;Agreement&rdquo;). If you do not agree with any part of this Agreement, you must not participate in the Program. NexCodeNova (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;) reserves the right to amend this Agreement at any time. Continued participation after any amendment constitutes acceptance.
          </p>
        </div>

        <div className="space-y-12 text-sm text-slate-700 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">1. Definitions</h2>
            <p className="mb-3">For the purposes of this Agreement, the following definitions apply:</p>
            <ul className="space-y-2 list-none pl-0">
              <li><strong className="text-slate-900">&ldquo;Affiliate&rdquo;</strong> — any individual or entity approved by NexCodeNova to participate in the Program and promote ExiusCart products and services in exchange for commission.</li>
              <li><strong className="text-slate-900">&ldquo;Referral Link&rdquo;</strong> — the unique URL assigned to each Affiliate, containing a tracking parameter (&ldquo;ref code&rdquo;) that identifies traffic and sign-ups originating from that Affiliate.</li>
              <li><strong className="text-slate-900">&ldquo;Qualified Referral&rdquo;</strong> — a new user who registers on ExiusCart with the Affiliate&apos;s tracking cookie active on their browser (see &ldquo;Cookie Window&rdquo; below), has not previously registered on ExiusCart under any account, and subsequently activates a paid subscription. There is no deadline by which the paid subscription must be activated once the account is registered with the referral attached.</li>
              <li><strong className="text-slate-900">&ldquo;Commission Model&rdquo;</strong> — the payout structure chosen by the Affiliate at the time of application (&ldquo;One-Time&rdquo; or &ldquo;Recurring&rdquo;), as set out in Section 3. The Commission Model is locked at application and cannot be changed afterward under any circumstances.</li>
              <li><strong className="text-slate-900">&ldquo;Commission&rdquo;</strong> — the payment made to the Affiliate for a Qualified Referral, calculated according to the Affiliate&apos;s chosen Commission Model, as set out in Section 3.</li>
              <li><strong className="text-slate-900">&ldquo;Lock Period&rdquo;</strong> — the mandatory 30-day holding period applied to every individual Commission payment after the corresponding customer payment is confirmed, during which that Commission cannot be withdrawn.</li>
              <li><strong className="text-slate-900">&ldquo;Cookie Window&rdquo;</strong> — the duration for which an Affiliate&apos;s tracking cookie remains active on the referred user&apos;s browser after clicking the Referral Link, currently set to <strong>30 days</strong>. The referred user must complete registration within this window for the referral to attach to their account.</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">2. Eligibility &amp; Application</h2>
            <p className="mb-3">Participation in the Program is open to individuals and entities who meet all of the following criteria:</p>
            <ul className="space-y-2 list-disc list-inside pl-2">
              <li>You are at least 18 years of age or the age of majority in your jurisdiction, whichever is greater.</li>
              <li>You have a valid email address, a PayPal, Skrill, or Payoneer account capable of receiving payments.</li>
              <li>You operate a website, social media account, YouTube channel, blog, newsletter, or other legitimate digital promotional channel with authentic, original content.</li>
              <li>You are not a current employee, contractor, or director of NexCodeNova or ExiusCart.</li>
              <li>You are not located in a jurisdiction subject to international sanctions that would prohibit the receipt of payments from the Company.</li>
            </ul>
            <p className="mt-3">Applications are reviewed at the Company&apos;s sole discretion. Approval of an application does not guarantee continued membership. The Company may revoke membership at any time for any reason, including but not limited to policy violations, inactivity, or changes in business direction.</p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">3. Commission Rates</h2>
            <p className="mb-3">At the time of application, every Affiliate must choose <strong>one</strong> of the two Commission Models below. This choice is <strong>locked permanently</strong> upon approval — it cannot be changed, switched, or reverted at any later date, regardless of reason. Free Trial sign-ups that never activate a paid subscription earn no Commission under either model.</p>
            <div className="overflow-x-auto">
              <table className="w-full border border-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Commission Model</th>
                    <th className="text-left px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Rate</th>
                    <th className="text-left px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">How It Works</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-900 font-semibold">One-Time</td>
                    <td className="px-4 py-3 font-bold text-slate-900">$75.00 USD</td>
                    <td className="px-4 py-3 text-slate-600">A single flat payment, paid once when the referred customer&apos;s first subscription payment is confirmed. No further Commission is paid for that referral regardless of how long the customer remains subscribed.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-900 font-semibold">Recurring</td>
                    <td className="px-4 py-3 font-bold text-[#6B3FD9]">50% of payment</td>
                    <td className="px-4 py-3 text-slate-600">50% of the amount the referred customer actually pays, credited each time a payment is confirmed for that customer, for a maximum of <strong>12 payments</strong> per referral. No Commission is paid for that referral&apos;s 13th payment onward.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">Commissions under either model are only generated against a real, confirmed payment from the referred customer — never estimated, projected, or credited in advance of payment. Commission rates may be modified for future applicants with 14 days&apos; advance notice; changes never apply retroactively to an Affiliate&apos;s already-locked Commission Model.</p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">4. Tracking Technology — Cookies, IP Addresses &amp; Attribution</h2>
            <p className="mb-3">The ExiusCart Affiliate Program uses multiple layers of tracking to attribute referrals accurately and to detect fraud.</p>

            <h3 className="font-semibold text-slate-900 mt-5 mb-2">4.1 Cookie-Based Tracking</h3>
            <p className="mb-3">When a user clicks your Referral Link, a first-party cookie containing your affiliate code (&ldquo;ref&rdquo;) is placed on the user&apos;s browser. This cookie has a lifetime of <strong>30 days</strong>. If the user registers an ExiusCart account within those 30 days, the referral attaches to their account permanently — there is no further deadline for them to activate a paid subscription after registering.</p>
            <ul className="space-y-1.5 list-disc list-inside pl-2 mb-3">
              <li>If the user clears their cookies or uses a different browser or device before signing up, the referral may not be attributed to you.</li>
              <li>Only the <em>last</em> Referral Link clicked before sign-up is credited. If a user clicks multiple Affiliate links, only the most recent one is recorded.</li>
              <li>Cookie stuffing — placing tracking cookies on a user&apos;s device without their knowledge or a genuine click on your Referral Link — is strictly prohibited and constitutes fraud.</li>
            </ul>

            <h3 className="font-semibold text-slate-900 mt-5 mb-2">4.2 IP Address Tracking</h3>
            <p className="mb-3">In addition to cookies, ExiusCart records the IP address of each visitor who clicks a Referral Link. IP-based tracking is used as a secondary attribution signal and as a primary fraud-detection mechanism. The following IP-based patterns may trigger a fraud review and result in Commission cancellation:</p>
            <ul className="space-y-1.5 list-disc list-inside pl-2 mb-3">
              <li>Multiple sign-ups originating from the same IP address or IP range within a short time window.</li>
              <li>Sign-ups originating from IP addresses associated with data centres, VPNs, proxy services, or TOR exit nodes.</li>
              <li>Sign-ups where the Affiliate&apos;s own IP address matches or is within the same subnet as the referred user&apos;s IP address (indicative of self-referral).</li>
              <li>Unusually high click-to-sign-up ratios from a single IP range, suggesting bot traffic or click farms.</li>
            </ul>
            <p>IP address data is stored for a minimum of 12 months for fraud investigation purposes and is processed in accordance with our Privacy Policy.</p>

            <h3 className="font-semibold text-slate-900 mt-5 mb-2">4.3 UTM Parameters &amp; URL Integrity</h3>
            <p>Affiliates must not alter, strip, or manipulate the tracking parameters on their Referral Link. Removing, replacing, or redirecting these parameters may result in referral attribution failure. The Company is not liable for lost commissions resulting from self-modification of Referral Links.</p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">5. Qualified Referral Criteria</h2>
            <p className="mb-3">A referral is a Qualified Referral — and therefore earns Commission — only if <strong>all</strong> of the following conditions are simultaneously satisfied:</p>
            <ol className="space-y-2 list-decimal list-inside pl-2">
              <li>The referred user clicked your Referral Link within the 30-day Cookie Window before registering.</li>
              <li>The referred user is a genuinely new customer with no prior account on ExiusCart under any email address.</li>
              <li>The referred user activates a paid subscription (Monthly or Yearly) — at any point after registering, with no deadline.</li>
              <li>The referred user&apos;s payment is successfully processed and not subject to an immediate refund or chargeback.</li>
              <li>Your affiliate account is in good standing with no unresolved policy violations at the time the Commission is calculated.</li>
              <li>You have published supporting content (see Section 7) that includes your Referral Link, active and publicly accessible at the time of the referral.</li>
              <li>The partnership label requirement (see Section 8) has been fulfilled and confirmed.</li>
            </ol>
            <p className="mt-3">The Company&apos;s tracking system is the sole and authoritative source for determining whether a referral qualifies. Disputes regarding tracking must be submitted in writing to support@exiuscart.com within 30 days of the Commission calculation date.</p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">6. Lock Period &amp; Commission Crediting</h2>
            <p className="mb-3">Each individual Commission — whether the single One-Time payment or one of up to 12 monthly Recurring payments — enters a <strong>30-day lock period</strong> upon the corresponding customer payment being confirmed. During this period:</p>
            <ul className="space-y-2 list-disc list-inside pl-2">
              <li>The Commission is visible in your Affiliate dashboard as &ldquo;Pending&rdquo; but cannot be withdrawn or transferred.</li>
              <li>If the referred customer requests a refund (including under any money-back guarantee) within the 30-day lock period, that Commission is immediately cancelled and permanently forfeited.</li>
              <li>If a chargeback is initiated by the referred customer at any time — even after the lock period — the affected Commission may be reversed and deducted from future earnings.</li>
              <li>After 30 days, provided no refund or chargeback has been processed, the Commission requires final Company approval before it becomes available for payout request. Under the Recurring model, each of the up to 12 monthly Commissions goes through this same 30-day lock and approval process independently.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">7. Promotion Rules &amp; Content Requirements</h2>

            <h3 className="font-semibold text-slate-900 mt-4 mb-2">7.1 Supporting Content Requirement</h3>
            <p className="mb-3">Sharing a bare Referral Link without accompanying original content is <strong>not permitted</strong> and will result in those referrals being ineligible for Commission. Acceptable content formats include, but are not limited to: a landing page, blog post or article, social media post with original commentary, YouTube or TikTok video, newsletter segment, or podcast mention. The content must be publicly accessible and must fairly represent ExiusCart&apos;s actual features and pricing.</p>

            <h3 className="font-semibold text-slate-900 mt-4 mb-2">7.2 Paid Advertising</h3>
            <p className="mb-3">Paid advertising on any platform — including Google Ads, Meta Ads, TikTok Ads, YouTube Ads, and others — is permitted, provided the ad directs users to content you control (e.g. your landing page) rather than directly to ExiusCart. Directly linking paid ads to ExiusCart.com or any ExiusCart subdomain using your Referral Link is prohibited without prior written approval from the Company.</p>

            <h3 className="font-semibold text-slate-900 mt-4 mb-2">7.3 Prohibited Promotion Methods</h3>
            <p className="mb-3">The following methods are strictly prohibited and will result in immediate account termination and forfeiture of all pending and cleared Commissions:</p>
            <ul className="space-y-1.5 list-disc list-inside pl-2">
              <li>Spam — unsolicited bulk emails, SMS messages, WhatsApp broadcasts, or social media direct messages promoting your Referral Link.</li>
              <li>Purchasing bot traffic, fake clicks, or incentivised clicks from click farms or paid-to-click services.</li>
              <li>Self-referrals — creating or assisting in the creation of ExiusCart accounts using your own Referral Link, directly or through a third party you control.</li>
              <li>Cookie stuffing or any form of unauthorised tracking manipulation.</li>
              <li>Making false, exaggerated, or misleading claims about ExiusCart&apos;s features, pricing, security, or capabilities.</li>
              <li>Impersonating ExiusCart, NexCodeNova, or any of their representatives.</li>
              <li>Bidding on branded keywords (&ldquo;ExiusCart,&rdquo; &ldquo;NexCodeNova&rdquo; or any variant) on paid search platforms.</li>
              <li>Placing the Referral Link on coupon, cashback, or deal aggregator websites without prior written approval.</li>
              <li>Any promotion method that violates the terms of service of the platform on which it is used.</li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">8. Partnership Label Requirement</h2>
            <p className="mb-3">As a condition of payout eligibility, every Affiliate must publicly display the following disclosure on any channel or platform used to promote ExiusCart:</p>
            <blockquote className="border-l-4 border-[#6B3FD9] pl-5 py-2 bg-slate-50 my-4 text-slate-800 font-mono text-sm">
              &ldquo;Affiliate partner of ExiusCart by NexCodeNova&rdquo;
            </blockquote>
            <p className="mb-3">This label must be prominently displayed — for example, in your social media bio, website footer, or the disclosure section of any blog post or video description containing your Referral Link. Hidden or obfuscated disclosure does not satisfy this requirement.</p>
            <p>Affiliates must confirm fulfilment of this requirement via the Affiliate dashboard. Failure to maintain this disclosure after confirmation, or providing false confirmation, constitutes a material breach of this Agreement and may result in immediate termination and Commission forfeiture.</p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">9. Payout Conditions</h2>
            <p className="mb-3">Payouts are subject to the following conditions:</p>
            <ul className="space-y-2 list-disc list-inside pl-2">
              <li><strong>Minimum balance:</strong> Your cleared (post-lock, approved) balance must reach a minimum of <strong>$100.00 USD</strong> before a payout can be requested.</li>
              <li><strong>Payout methods:</strong> PayPal, Skrill, or Payoneer only. No bank transfers, cryptocurrency, gift cards, or other methods are available at this time.</li>
              <li><strong>Processing time:</strong> Approved payout requests are processed within <strong>7 business days</strong>. The Company reserves the right to extend this period by up to 14 additional business days during audits, investigations, or high-volume periods.</li>
              <li><strong>Taxes:</strong> You are solely responsible for declaring and paying any taxes applicable to your Commission income in your jurisdiction. The Company does not withhold tax on behalf of Affiliates unless required by applicable law.</li>
              <li><strong>Currency:</strong> All Commissions and payouts are denominated in United States Dollars (USD). Currency conversion fees, if applicable, are borne by the Affiliate.</li>
              <li><strong>Withheld payouts:</strong> The Company reserves the right to withhold any payout indefinitely pending the outcome of a fraud investigation, legal dispute, or regulatory inquiry. Affiliates will be notified of any withhold within 5 business days of the payout request being placed on hold.</li>
            </ul>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">10. Refunds, Chargebacks &amp; Commission Reversal</h2>
            <p className="mb-3">ExiusCart offers customers a <strong>7-day money-back guarantee</strong> on their first payment. The following reversal rules apply:</p>
            <ul className="space-y-2 list-disc list-inside pl-2">
              <li>If a referred customer requests a refund within the 7-day money-back guarantee window, the Commission is cancelled and not payable under any circumstances.</li>
              <li>If a referred customer initiates a chargeback with their bank or payment provider at any time, the Commission is cancelled regardless of whether the lock period has elapsed or the Commission has been paid out. If already paid out, the reversed amount will be deducted from your next cleared balance or recovered by the Company.</li>
              <li>Commissions already paid out are subject to clawback if a chargeback or fraudulent referral is discovered after payment. You agree to repay any such amounts upon demand.</li>
              <li>The Company is not liable for any refund or chargeback decision made by a third-party payment processor.</li>
            </ul>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">11. Fraud Detection &amp; Investigation</h2>
            <p className="mb-3">The Company employs automated and manual fraud detection measures. Any of the following signals may trigger a fraud review, Commission suspension, or immediate account termination:</p>
            <ul className="space-y-1.5 list-disc list-inside pl-2">
              <li>High click volumes with low or zero sign-up conversion that is inconsistent with legitimate referral traffic patterns.</li>
              <li>Multiple referrals from the same IP address, device fingerprint, or household within a short timeframe.</li>
              <li>Referred accounts that are created but never used, or used only to trigger commission before cancellation.</li>
              <li>Any correlation between the Affiliate&apos;s account details (name, email, IP address, payment account) and referred customer accounts.</li>
              <li>Sudden spikes in referral volume that cannot be reasonably explained by documented promotional activity.</li>
              <li>Use of VPN, proxy, or anonymisation services during referral-generating activity.</li>
              <li>Shared device identifiers or browser fingerprints between the Affiliate and referred users.</li>
            </ul>
            <p className="mt-3">During an active fraud investigation, the Company may suspend payout processing without notice. The Affiliate will be given an opportunity to provide evidence to dispute findings. The Company&apos;s determination following investigation is final.</p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">12. Data Collection &amp; Privacy</h2>
            <p className="mb-3">By participating in the Program, you consent to the following data practices:</p>
            <ul className="space-y-2 list-disc list-inside pl-2">
              <li>The Company collects and stores your name, email address, payment account details, IP addresses, and referral activity data for the purpose of administering the Program.</li>
              <li>Click and referral data from your Referral Link — including timestamps, IP addresses, device types, and browser user-agents of users who click your link — is collected and retained for fraud detection and attribution purposes.</li>
              <li>Data is retained for a minimum of 36 months following the end of your participation in the Program to comply with legal and audit requirements.</li>
              <li>The Company does not sell Affiliate personal data to third parties. Data may be shared with payment processors (PayPal, Skrill, Payoneer) as necessary to execute payouts.</li>
              <li>You are responsible for disclosing to your audience that clicking your Referral Link results in a cookie being placed on their browser, as required by applicable privacy laws including but not limited to the EU General Data Protection Regulation (GDPR) and the UK Privacy and Electronic Communications Regulations (PECR).</li>
            </ul>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">13. Intellectual Property</h2>
            <p className="mb-3">The Company grants you a limited, non-exclusive, non-transferable, revocable licence to use ExiusCart&apos;s name, logo, and approved marketing materials solely for the purpose of promoting ExiusCart through the Program and in accordance with these Terms. This licence:</p>
            <ul className="space-y-1.5 list-disc list-inside pl-2">
              <li>Does not permit you to modify, alter, or create derivative works of any ExiusCart intellectual property.</li>
              <li>Does not permit you to register domain names, social media handles, or business names that include &ldquo;ExiusCart&rdquo; or &ldquo;NexCodeNova&rdquo; without prior written consent.</li>
              <li>Terminates automatically upon the termination or suspension of your Affiliate account.</li>
            </ul>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">14. Termination &amp; Disqualification</h2>
            <p className="mb-3">Either party may terminate this Agreement at any time. The Company may terminate or suspend your Affiliate account with immediate effect and without prior notice for any of the following reasons:</p>
            <ul className="space-y-1.5 list-disc list-inside pl-2 mb-3">
              <li>Any violation of these Terms &amp; Conditions.</li>
              <li>Any fraudulent, deceptive, or abusive conduct in connection with the Program.</li>
              <li>Misrepresentation of ExiusCart, NexCodeNova, or their products and services.</li>
              <li>Failure to maintain or removal of the partnership label (Section 8).</li>
              <li>Inactivity for a period exceeding 12 consecutive months.</li>
              <li>Any legal or regulatory requirement that necessitates termination.</li>
            </ul>
            <p>Upon termination for cause, all pending and locked Commissions are permanently forfeited. Upon termination without cause by the Company, Cleared Commissions available for payout at the time of termination will be paid out within 30 days, subject to final fraud review. You may not re-apply to the Program for 12 months following a termination for cause.</p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">15. Limitation of Liability &amp; Disclaimer</h2>
            <p className="mb-3">To the maximum extent permitted by applicable law:</p>
            <ul className="space-y-2 list-disc list-inside pl-2">
              <li>The Company&apos;s total liability to you under or in connection with this Agreement shall not exceed the total amount of Commissions paid to you in the 6 months immediately preceding the event giving rise to the claim.</li>
              <li>The Company is not liable for any indirect, special, consequential, incidental, or punitive damages arising from your participation in the Program, including lost profits or loss of expected Commission income.</li>
              <li>The Program is provided &ldquo;as is.&rdquo; The Company makes no warranty regarding the continuity, availability, or profitability of the Program.</li>
              <li>The Company is not responsible for any third-party platform decisions (ad account suspensions, social media takedowns, etc.) that affect your ability to promote ExiusCart.</li>
            </ul>
          </section>

          {/* 16 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">16. Relationship of the Parties</h2>
            <p>You and the Company are independent contractors. Nothing in this Agreement creates or implies any employment, partnership, joint venture, agency, franchise, or sales representative relationship. You have no authority to bind the Company in any contract or representation and must not represent yourself as an employee or agent of ExiusCart or NexCodeNova.</p>
          </section>

          {/* 17 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">17. Amendments</h2>
            <p>The Company reserves the right to modify these Terms &amp; Conditions at any time. Material changes will be communicated to active Affiliates via email at least 14 days before taking effect, except in cases of urgent changes required by law or to prevent fraud, which may take effect immediately. Continued participation in the Program after the effective date of any amendment constitutes your binding acceptance of the revised terms. It is your responsibility to review these terms periodically.</p>
          </section>

          {/* 18 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">18. Governing Law &amp; Dispute Resolution</h2>
            <p className="mb-3">This Agreement is governed by and construed in accordance with the laws of the United Arab Emirates (UAE) and, where applicable, the laws of the jurisdiction in which NexCodeNova is incorporated. In the event of any dispute arising from or in connection with this Agreement, the parties shall first attempt to resolve the matter by good-faith negotiation. If the dispute is not resolved within 30 days, it shall be referred to binding arbitration under the rules of a mutually agreed arbitral institution. Nothing in this clause prevents either party from seeking urgent injunctive relief from a court of competent jurisdiction.</p>
            <p>You agree that any claim against the Company must be brought within <strong>12 months</strong> of the event giving rise to the claim. Claims brought after this period are time-barred.</p>
          </section>

          {/* 19 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">19. Contact &amp; Notices</h2>
            <p className="mb-2">For questions about this Agreement, Commission disputes, or to report suspected fraud in the Program:</p>
            <ul className="space-y-1.5 list-none pl-0">
              <li><strong>Email:</strong> <a href="mailto:support@exiuscart.com" className="text-[#6B3FD9] hover:underline">support@exiuscart.com</a></li>
              <li><strong>Operated by:</strong> NexCodeNova</li>
              <li><strong>Website:</strong> <a href="https://exiuscart.com" className="text-[#6B3FD9] hover:underline">https://exiuscart.com</a></li>
            </ul>
            <p className="mt-3 text-slate-500 text-xs">All formal notices must be submitted in English in writing to the email address above. The Company will respond to compliance and legal notices within 10 business days.</p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">ExiusCart Affiliate Program Terms &amp; Conditions — Version effective 1 June 2026</p>
          <p className="text-xs text-slate-400 mt-1">Operated by NexCodeNova · <a href="mailto:support@exiuscart.com" className="hover:text-slate-600">support@exiuscart.com</a></p>
          <div className="mt-6">
            <Link href="/affiliate" className="inline-flex items-center gap-2 rounded-xl bg-[#6B3FD9] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5A2EC9] transition">
              Apply to become an affiliate →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
