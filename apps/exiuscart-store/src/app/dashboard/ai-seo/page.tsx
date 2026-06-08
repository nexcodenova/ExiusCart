'use client';
import { useState, useEffect } from 'react';
import { Sparkles, Search, FileText, Tag, TrendingUp, Copy, CheckCheck, ChevronDown, ChevronUp, AlertCircle, BarChart2, Zap } from 'lucide-react';
import { aiSeoApi } from '@/lib/api';

function shopIdFromStorage() { return typeof window !== 'undefined' ? localStorage.getItem('shop_id') || '1' : '1'; }

type Tab = 'description' | 'keywords' | 'metatags' | 'blog' | 'audit';

const TONES = ['professional', 'casual', 'luxury', 'technical', 'friendly'];
const LANGUAGES = ['English', 'Arabic', 'French', 'Spanish', 'German'];

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 border border-gray-200 dark:border-gray-600 rounded">
      {copied ? <><CheckCheck className="w-3 h-3 text-green-500" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
    </button>
  );
}

function ResultCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        <CopyBtn text={value} />
      </div>
      <p className={`text-sm text-gray-800 dark:text-gray-200 ${mono ? 'font-mono' : ''}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{value.length} chars</p>
    </div>
  );
}

export default function AiSeoPage() {
  const [shopId] = useState(shopIdFromStorage);
  const [tab, setTab] = useState<Tab>('description');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  // Description form
  const [descForm, setDescForm] = useState({ product_name: '', category: '', key_features: '', target_audience: 'shoppers', tone: 'professional', language: 'English' });
  // Keywords form
  const [kwForm, setKwForm] = useState({ topic: '', industry: 'e-commerce', target_region: 'UAE' });
  // Meta tags form
  const [metaForm, setMetaForm] = useState({ page_title: '', page_type: 'product', content_summary: '', business_name: '' });
  // Blog form
  const [blogForm, setBlogForm] = useState({ topic: '', target_keyword: '', word_count: '800', business_name: '' });
  // Audit
  const [auditData, setAuditData] = useState<any>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);

  const run = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      let r: any;
      if (tab === 'description') r = await aiSeoApi.generateDescription(shopId, descForm);
      else if (tab === 'keywords') r = await aiSeoApi.generateKeywords(shopId, kwForm);
      else if (tab === 'metatags') r = await aiSeoApi.generateMetaTags(shopId, metaForm);
      else if (tab === 'blog') r = await aiSeoApi.generateBlogPost(shopId, { ...blogForm, word_count: parseInt(blogForm.word_count) });
      setResult(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'AI generation failed. Check your API key configuration.');
    } finally { setLoading(false); }
  };

  const runAudit = async () => {
    setAuditLoading(true);
    try { const r = await aiSeoApi.seoAudit(shopId); setAuditData(r.data); }
    catch (e: any) { setError(e?.response?.data?.detail || 'Audit failed.'); }
    finally { setAuditLoading(false); }
  };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'description', label: 'Product Description', icon: FileText },
    { id: 'keywords', label: 'Keyword Research', icon: Search },
    { id: 'metatags', label: 'Meta Tags', icon: Tag },
    { id: 'blog', label: 'Blog Post', icon: TrendingUp },
    { id: 'audit', label: 'SEO Audit', icon: BarChart2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI SEO Tools</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Generate SEO-optimised content, keywords, and meta tags powered by Claude AI</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); setError(''); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wide">Input</h2>

          {tab === 'description' && (
            <>
              {[
                { label: 'Product Name *', key: 'product_name', placeholder: 'iPhone 15 Pro Max 256GB' },
                { label: 'Category', key: 'category', placeholder: 'Electronics / Smartphones' },
                { label: 'Key Features', key: 'key_features', placeholder: 'A17 Pro chip, titanium frame, 48MP camera...' },
                { label: 'Target Audience', key: 'target_audience', placeholder: 'tech enthusiasts, professionals' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <input value={descForm[f.key as keyof typeof descForm]} onChange={e => setDescForm(v => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tone</label>
                  <select value={descForm.tone} onChange={e => setDescForm(v => ({ ...v, tone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Language</label>
                  <select value={descForm.language} onChange={e => setDescForm(v => ({ ...v, language: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {tab === 'keywords' && (
            <>
              {[
                { label: 'Topic / Product *', key: 'topic', placeholder: 'wireless earbuds' },
                { label: 'Industry', key: 'industry', placeholder: 'electronics, fashion, food...' },
                { label: 'Target Region', key: 'target_region', placeholder: 'UAE, Sri Lanka, UK...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <input value={kwForm[f.key as keyof typeof kwForm]} onChange={e => setKwForm(v => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder={f.placeholder} />
                </div>
              ))}
            </>
          )}

          {tab === 'metatags' && (
            <>
              {[
                { label: 'Page Title *', key: 'page_title', placeholder: 'Nike Air Max 270 - Mens Running Shoes' },
                { label: 'Content Summary', key: 'content_summary', placeholder: 'Brief summary of what this page is about...' },
                { label: 'Business Name', key: 'business_name', placeholder: 'Your Shop Name' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <input value={metaForm[f.key as keyof typeof metaForm]} onChange={e => setMetaForm(v => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Page Type</label>
                <select value={metaForm.page_type} onChange={e => setMetaForm(v => ({ ...v, page_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  {['product', 'category', 'homepage', 'blog'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </>
          )}

          {tab === 'blog' && (
            <>
              {[
                { label: 'Blog Topic *', key: 'topic', placeholder: 'Top 10 wireless earbuds under AED 200' },
                { label: 'Target Keyword', key: 'target_keyword', placeholder: 'best wireless earbuds UAE' },
                { label: 'Business Name', key: 'business_name', placeholder: 'Your Shop' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <input value={blogForm[f.key as keyof typeof blogForm]} onChange={e => setBlogForm(v => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Word Count</label>
                <select value={blogForm.word_count} onChange={e => setBlogForm(v => ({ ...v, word_count: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  {['500', '800', '1200', '1500', '2000'].map(w => <option key={w} value={w}>{w} words</option>)}
                </select>
              </div>
            </>
          )}

          {tab === 'audit' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">Scan all your products for SEO issues — missing descriptions, short titles, no images, and more.</p>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                <Zap className="w-4 h-4 inline mr-1" /> No AI credits used — this audit runs locally against your product data.
              </div>
              <button onClick={runAudit} disabled={auditLoading}
                className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
                <BarChart2 className={`w-4 h-4 ${auditLoading ? 'animate-pulse' : ''}`} />
                {auditLoading ? 'Auditing...' : 'Run SEO Audit'}
              </button>
            </div>
          )}

          {tab !== 'audit' && (
            <button onClick={run} disabled={loading}
              className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
              <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Generating with AI...' : 'Generate with AI'}
            </button>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wide mb-4">Results</h2>

          {/* Description results */}
          {tab === 'description' && result && (
            <div className="space-y-3">
              <ResultCard label="SEO Title" value={result.seo_title} />
              <ResultCard label="Meta Description" value={result.meta_description} />
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Product Description</span>
                  <CopyBtn text={result.description} />
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{result.description}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Keywords / Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {(result.keywords || []).map((k: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs">{k}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Keyword results */}
          {tab === 'keywords' && result && (
            <div className="space-y-3">
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">Primary Keyword</p>
                <p className="font-bold text-purple-800 dark:text-purple-200">{result.primary_keyword}</p>
              </div>
              {[
                { label: 'Secondary Keywords', data: result.secondary_keywords },
                { label: 'Long-tail Keywords', data: result.long_tail_keywords },
                { label: 'Question Keywords', data: result.question_keywords },
                { label: 'Local Keywords', data: result.local_keywords },
              ].map(g => g.data?.length > 0 && (
                <div key={g.label} className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{g.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.data.map((k: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">{k}</span>
                    ))}
                  </div>
                </div>
              ))}
              {result.content_ideas?.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Content Ideas</p>
                  <div className="space-y-2">
                    {result.content_ideas.map((idea: any, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded capitalize">{idea.type}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-200">{idea.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Meta tags results */}
          {tab === 'metatags' && result && (
            <div className="space-y-3">
              {[
                { label: 'Title Tag', key: 'title_tag' },
                { label: 'Meta Description', key: 'meta_description' },
                { label: 'OG Title', key: 'og_title' },
                { label: 'OG Description', key: 'og_description' },
                { label: 'Twitter Title', key: 'twitter_title' },
                { label: 'Focus Keyword', key: 'focus_keyword' },
                { label: 'URL Slug', key: 'canonical_slug', mono: true },
              ].map(f => result[f.key] && <ResultCard key={f.key} label={f.label} value={result[f.key]} mono={f.mono} />)}
              {result.seo_score_tips?.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">SEO Tips</p>
                  <ul className="space-y-1">
                    {result.seo_score_tips.map((t: string, i: number) => <li key={i} className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5"><span>•</span>{t}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Blog post results */}
          {tab === 'blog' && result && (
            <div className="space-y-3">
              <ResultCard label="Blog Title" value={result.title} />
              <ResultCard label="Meta Description" value={result.meta_description} />
              <ResultCard label="URL Slug" value={result.slug} mono />
              <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>📖 {result.estimated_read_time}</span>
                <span>·</span>
                <span>🎯 {result.focus_keyword}</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Full Blog Post</span>
                  <CopyBtn text={result.content} />
                </div>
                <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{result.content}</pre>
              </div>
              {result.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {result.tags.map((t: string, i: number) => <span key={i} className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs">{t}</span>)}
                </div>
              )}
            </div>
          )}

          {/* Audit results */}
          {tab === 'audit' && auditData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Avg SEO Score', value: `${auditData.average_seo_score}/100`, color: auditData.average_seo_score >= 80 ? 'text-green-600' : auditData.average_seo_score >= 50 ? 'text-orange-500' : 'text-red-500' },
                  { label: 'Total Products', value: auditData.total_products, color: 'text-gray-900 dark:text-white' },
                  { label: 'Good', value: auditData.products_good, color: 'text-green-600' },
                  { label: 'Needs Work', value: auditData.products_needs_work, color: 'text-orange-500' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                    <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditData.products.map((p: any) => (
                  <div key={p.product_id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button onClick={() => setExpandedProduct(expandedProduct === p.product_id ? null : p.product_id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 text-left">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status === 'good' ? 'bg-green-500' : p.status === 'needs_work' ? 'bg-orange-400' : 'bg-red-500'}`} />
                      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{p.product_name}</span>
                      <span className={`text-xs font-bold ${p.seo_score >= 80 ? 'text-green-600' : p.seo_score >= 50 ? 'text-orange-500' : 'text-red-500'}`}>{p.seo_score}</span>
                      {expandedProduct === p.product_id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {expandedProduct === p.product_id && p.issues.length > 0 && (
                      <div className="px-3 pb-3 pt-0 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                        <ul className="space-y-1 mt-2">
                          {p.issues.map((issue: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-orange-700 dark:text-orange-300">
                              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" /> {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!result && !auditData && !loading && !auditLoading && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Sparkles className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-400 dark:text-gray-500">Fill in the form and click Generate to see AI results here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
