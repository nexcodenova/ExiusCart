'use client';
import { useState, useEffect } from 'react';
import { Plus, Briefcase, Users, ChevronRight, Trash2, Edit2, X, ArrowRight } from 'lucide-react';
import { recruitmentApi } from '@/lib/api';

const STAGES = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];
const STAGE_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  screening: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  interview: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  offer: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  hired: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const EMP_TYPES = ['full_time', 'part_time', 'contract', 'internship'];

export default function RecruitmentPage() {
  const [shopId, setShopId] = useState<string>('');
  const [tab, setTab] = useState<'jobs' | 'applicants'>('jobs');
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || '1'); }, []);
  const [jobs, setJobs] = useState<any[]>([]);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [jobForm, setJobForm] = useState<any>({ title: '', department: '', description: '', requirements: '', employment_type: 'full_time', location: '', is_remote: false });
  const [appForm, setAppForm] = useState<any>({ job_position_id: '', full_name: '', email: '', phone: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [stageFilter, setStageFilter] = useState('');

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [j, a] = await Promise.all([recruitmentApi.getJobs(shopId), recruitmentApi.getApplicants(shopId)]);
      setJobs(j.data); setApplicants(a.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId]);

  const openNewJob = () => {
    setEditingJob(null);
    setJobForm({ title: '', department: '', description: '', requirements: '', employment_type: 'full_time', location: '', is_remote: false });
    setShowJobModal(true);
  };
  const openEditJob = (j: any) => {
    setEditingJob(j);
    setJobForm({ title: j.title, department: j.department || '', description: j.description || '', requirements: j.requirements || '', employment_type: j.employment_type, location: j.location || '', is_remote: j.is_remote });
    setShowJobModal(true);
  };

  const saveJob = async () => {
    if (!jobForm.title.trim()) return;
    setSaving(true);
    try {
      if (editingJob) await recruitmentApi.updateJob(shopId!, editingJob.id, jobForm);
      else await recruitmentApi.createJob(shopId!, jobForm);
      setShowJobModal(false); load();
    } catch {} finally { setSaving(false); }
  };

  const delJob = async (j: any) => {
    if (!confirm(`Delete job "${j.title}"?`)) return;
    try { await recruitmentApi.deleteJob(shopId!, j.id); load(); } catch {}
  };

  const saveApplicant = async () => {
    if (!appForm.full_name.trim() || !appForm.job_position_id) return;
    setSaving(true);
    try {
      await recruitmentApi.createApplicant(shopId!, { ...appForm, job_position_id: parseInt(appForm.job_position_id) });
      setShowApplicantModal(false);
      setAppForm({ job_position_id: '', full_name: '', email: '', phone: '', notes: '' });
      load();
    } catch {} finally { setSaving(false); }
  };

  const moveStage = async (a: any, stage: string) => {
    try { await recruitmentApi.moveStage(shopId!, a.id, stage); load(); } catch {}
  };

  const delApplicant = async (a: any) => {
    if (!confirm('Delete applicant?')) return;
    try { await recruitmentApi.deleteApplicant(shopId!, a.id); load(); } catch {}
  };

  const filteredApplicants = stageFilter ? applicants.filter(a => a.stage === stageFilter) : applicants;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recruitment</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage job openings and applicant pipeline</p>
        </div>
        <button onClick={tab === 'jobs' ? openNewJob : () => setShowApplicantModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> {tab === 'jobs' ? 'New Job' : 'Add Applicant'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open Positions', value: jobs.filter(j => j.status === 'open').length },
          { label: 'Total Applicants', value: applicants.length },
          { label: 'In Interview', value: applicants.filter(a => a.stage === 'interview').length },
          { label: 'Hired', value: applicants.filter(a => a.stage === 'hired').length },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {(['jobs', 'applicants'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
            {t === 'jobs' ? 'Job Openings' : 'Applicants'}
          </button>
        ))}
      </div>

      {tab === 'jobs' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div>
            : jobs.length === 0 ? (
              <div className="p-12 text-center">
                <Briefcase className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No job openings yet.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>{['Title', 'Department', 'Type', 'Location', 'Applicants', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {jobs.map(j => (
                    <tr key={j.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{j.title}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{j.department || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{j.employment_type?.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{j.is_remote ? 'Remote' : j.location || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{j.applicant_count}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${j.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{j.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEditJob(j)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => delJob(j)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stage filter */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStageFilter('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!stageFilter ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
              All ({applicants.length})
            </button>
            {STAGES.map(s => (
              <button key={s} onClick={() => setStageFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${stageFilter === s ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {s} ({applicants.filter(a => a.stage === s).length})
              </button>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {filteredApplicants.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No applicants{stageFilter ? ` in ${stageFilter}` : ''} yet.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>{['Name', 'Email', 'Position', 'Stage', 'Applied', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredApplicants.map(a => {
                    const currentIdx = STAGES.indexOf(a.stage);
                    const nextStage = currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null;
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{a.full_name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.email || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.job_title}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STAGE_COLORS[a.stage]}`}>{a.stage}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(a.applied_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {nextStage && a.stage !== 'hired' && a.stage !== 'rejected' && (
                              <button onClick={() => moveStage(a, nextStage)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100" title={`Move to ${nextStage}`}>
                                <ArrowRight className="w-3 h-3" /> {nextStage}
                              </button>
                            )}
                            {a.stage !== 'rejected' && a.stage !== 'hired' && (
                              <button onClick={() => moveStage(a, 'rejected')}
                                className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-100">Reject</button>
                            )}
                            <button onClick={() => delApplicant(a)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Job Modal */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingJob ? 'Edit Job' : 'New Job Opening'}</h2>
              <button onClick={() => setShowJobModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {[
                { label: 'Job Title *', key: 'title', placeholder: 'Software Engineer' },
                { label: 'Department', key: 'department', placeholder: 'Engineering' },
                { label: 'Location', key: 'location', placeholder: 'City, Country' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <input value={jobForm[f.key]} onChange={e => setJobForm((v: any) => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employment Type</label>
                <select value={jobForm.employment_type} onChange={e => setJobForm((v: any) => ({ ...v, employment_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  {EMP_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_remote" checked={jobForm.is_remote} onChange={e => setJobForm((v: any) => ({ ...v, is_remote: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="is_remote" className="text-sm text-gray-700 dark:text-gray-300">Remote Position</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={jobForm.description} onChange={e => setJobForm((v: any) => ({ ...v, description: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Requirements</label>
                <textarea value={jobForm.requirements} onChange={e => setJobForm((v: any) => ({ ...v, requirements: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowJobModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={saveJob} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editingJob ? 'Save Changes' : 'Create Job'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Applicant Modal */}
      {showApplicantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Applicant</h2>
              <button onClick={() => setShowApplicantModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Position *</label>
                <select value={appForm.job_position_id} onChange={e => setAppForm((v: any) => ({ ...v, job_position_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="">Select position...</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              {[
                { label: 'Full Name *', key: 'full_name', placeholder: 'John Doe' },
                { label: 'Email', key: 'email', placeholder: 'john@example.com' },
                { label: 'Phone', key: 'phone', placeholder: '+XX XX XXX XXXX' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <input value={appForm[f.key]} onChange={e => setAppForm((v: any) => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder={f.placeholder} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowApplicantModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={saveApplicant} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Add Applicant'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
