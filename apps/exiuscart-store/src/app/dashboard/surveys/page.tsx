'use client';
import { useState, useEffect } from 'react';
import { Plus, BarChart2, Trash2, Play, PauseCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { marketingApi } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  closed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const Q_TYPES = ['text', 'multiple_choice', 'checkbox', 'rating', 'yes_no'];

interface Question { question_text: string; question_type: string; options: string; }

export default function SurveysPage() {
  const [shopId, setShopId] = useState<string>('');
  const [surveys, setSurveys] = useState<any[]>([]);
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || '1'); }, []);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([{ question_text: '', question_type: 'text', options: '' }]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    try { const r = await marketingApi.getSurveys(shopId); setSurveys(r.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId]);

  const addQuestion = () => setQuestions(qs => [...qs, { question_text: '', question_type: 'text', options: '' }]);
  const removeQuestion = (i: number) => setQuestions(qs => qs.filter((_, idx) => idx !== i));
  const updateQuestion = (i: number, key: keyof Question, val: string) =>
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, [key]: val } : q));

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title, description,
        questions: questions.filter(q => q.question_text.trim()).map(q => ({
          question_text: q.question_text,
          question_type: q.question_type,
          options: ['multiple_choice', 'checkbox'].includes(q.question_type)
            ? q.options.split('\n').map(s => s.trim()).filter(Boolean)
            : null,
        })),
      };
      await marketingApi.createSurvey(shopId!, payload);
      setShowModal(false); setTitle(''); setDescription('');
      setQuestions([{ question_text: '', question_type: 'text', options: '' }]);
      load();
    } catch {} finally { setSaving(false); }
  };

  const toggleStatus = async (s: any) => {
    const next = s.status === 'active' ? 'closed' : 'active';
    try { await marketingApi.updateSurveyStatus(shopId!, s.id, next); load(); } catch {}
  };

  const del = async (s: any) => {
    if (!confirm('Delete this survey?')) return;
    try { await marketingApi.deleteSurvey(shopId!, s.id); load(); } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Surveys</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Collect feedback from your customers</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Survey
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
      ) : surveys.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <BarChart2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No surveys yet. Create your first survey.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {surveys.map(s => (
            <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between mb-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                <div className="flex gap-1">
                  <button onClick={() => toggleStatus(s)} title={s.status === 'active' ? 'Close' : 'Activate'}
                    className="p-1.5 text-gray-400 hover:text-green-600 rounded">
                    {s.status === 'active' ? <PauseCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button onClick={() => del(s)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{s.title}</h3>
              {s.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{s.description}</p>}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span>{s.question_count} questions</span>
                <span>{s.response_count} responses</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Survey</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Survey Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Customer Satisfaction Survey" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Tell us about your experience..." />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Questions</label>
                  <button onClick={addQuestion} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Question</button>
                </div>
                <div className="space-y-3">
                  {questions.map((q, i) => (
                    <div key={i} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-4">{i + 1}.</span>
                        <input value={q.question_text} onChange={e => updateQuestion(i, 'question_text', e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Enter question..." />
                        <select value={q.question_type} onChange={e => updateQuestion(i, 'question_type', e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                          {Q_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                        </select>
                        {questions.length > 1 && (
                          <button onClick={() => removeQuestion(i)} className="p-1 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                      {['multiple_choice', 'checkbox'].includes(q.question_type) && (
                        <textarea value={q.options} onChange={e => updateQuestion(i, 'options', e.target.value)} rows={3}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="One option per line..." />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Create Survey'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
