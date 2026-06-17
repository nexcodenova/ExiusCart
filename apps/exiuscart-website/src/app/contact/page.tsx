'use client';

import { useState } from 'react';
import { MessageCircle, Mail, Phone, Clock, Send, CheckCircle, ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed');
      setIsSubmitted(true);
      setFormData({ firstName: '', lastName: '', email: '', phone: '', subject: '', message: '' });
    } catch {
      alert('Something went wrong. Please try WhatsApp or email us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-screen" style={{ background: '#EDEBE6' }}>
      <Navbar />

      <section className="pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left — headline + info */}
            <div className="lg:pt-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[#6B3FD9] mb-6 block">
                Contact Us
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-gray-900 leading-[1.08] tracking-tight mb-6">
                Let's talk about<br />
                <span style={{ color: '#6B3FD9' }}>your business.</span>
              </h1>
              <p className="text-gray-500 text-lg leading-relaxed mb-12 max-w-md">
                Tell us what you need and our team will get back to you within one business day.
              </p>

              <div className="space-y-6">
                <a
                  href="https://wa.me/971562393573?text=Hi%2C%20I'm%20interested%20in%20ExiusCart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-11 h-11 bg-[#25D366]/15 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-[#25D366]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">WhatsApp</p>
                    <span className="text-gray-900 font-medium group-hover:text-[#6B3FD9] transition-colors">
                      +971 562 393 573
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#6B3FD9] ml-auto transition-colors" />
                </a>

                <a
                  href="mailto:support@exiuscart.com"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-11 h-11 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-[#6B3FD9]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">Email</p>
                    <span className="text-gray-900 font-medium group-hover:text-[#6B3FD9] transition-colors">
                      support@exiuscart.com
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#6B3FD9] ml-auto transition-colors" />
                </a>

                <a
                  href="tel:+971562393573"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-11 h-11 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-[#6B3FD9]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">Phone</p>
                    <span className="text-gray-900 font-medium group-hover:text-[#6B3FD9] transition-colors">
                      +971 562 393 573
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#6B3FD9] ml-auto transition-colors" />
                </a>

                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-[#6B3FD9]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">Business Hours</p>
                    <p className="text-gray-900 font-medium text-sm">Sun–Thu: 9 AM – 6 PM</p>
                    <p className="text-gray-500 text-sm">Fri: 9 AM – 12 PM · Sat: Closed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — form */}
            <div className="bg-white rounded-3xl p-10 shadow-sm border border-black/5">
              {isSubmitted ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Message sent!</h3>
                  <p className="text-gray-500 mb-8">
                    We'll get back to you within one business day.
                  </p>
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="text-[#6B3FD9] font-medium hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Send us a message</h2>
                  <p className="text-gray-400 text-sm mb-8">We'll get back to you as soon as possible.</p>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">First name *</label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          required
                          placeholder="First name"
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#6B3FD9] focus:ring-2 focus:ring-[#6B3FD9]/15 outline-none transition text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name *</label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          required
                          placeholder="Last name"
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#6B3FD9] focus:ring-2 focus:ring-[#6B3FD9]/15 outline-none transition text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Work email *</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="you@company.com"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#6B3FD9] focus:ring-2 focus:ring-[#6B3FD9]/15 outline-none transition text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone number</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+971 50 123 4567"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#6B3FD9] focus:ring-2 focus:ring-[#6B3FD9]/15 outline-none transition text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">What can we help you with? *</label>
                      <select
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:border-[#6B3FD9] focus:ring-2 focus:ring-[#6B3FD9]/15 outline-none transition text-sm bg-white"
                      >
                        <option value="">Please select</option>
                        <option value="sales">Sales Inquiry</option>
                        <option value="support">Technical Support</option>
                        <option value="enterprise">Enterprise / Marketplace</option>
                        <option value="partnership">Partnership</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={4}
                        placeholder="Tell us how we can help..."
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#6B3FD9] focus:ring-2 focus:ring-[#6B3FD9]/15 outline-none transition text-sm resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send message
                          <Send className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
