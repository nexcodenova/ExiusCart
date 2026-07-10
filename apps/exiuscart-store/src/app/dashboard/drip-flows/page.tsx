'use client';
import { useState, useEffect } from 'react';
import {
  Plus, X, Loader2, Trash2, Edit2, Play, Pause, GitBranch,
  Mail, MessageCircle, Clock, RefreshCw, ChevronDown, ChevronUp,
  Users, CheckCircle, Zap, ArrowRight, Info, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { dripFlowsApi, leadsApi } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type TriggerType = 'lead_created' | 'status_changed' | 'score_above' | 'no_activity_days';
type StepType = 'wait' | 'send_email' | 'send_whatsapp' | 'update_status';

interface FlowStep {
  id?: number;
  sort_order: number;
  step_type: StepType;
  config: Record<string, any>;
}

interface DripFlow {
  id: number;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  steps: FlowStep[];
  stats: { enrolled: number; completed: number; emails_sent: number };
}

interface Enrollment {
  id: number;
  status: string;
  steps_completed: number;
  emails_sent: number;
  enrolled_at: string;
  completed_at: string | null;
  next_run_at: string | null;
  lead: { id: number; name: string; email: string | null; score: number } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, string> = {
  lead_created: 'New Lead Created',
  status_changed: 'Lead Status Changed',
  score_above: 'Score Crosses Threshold',
  no_activity_days: 'No Activity for X Days',
};

const TRIGGER_ICONS: Record<TriggerType, React.ReactNode> = {
  lead_created: <Zap className="w-3.5 h-3.5" />,
  status_changed: <RefreshCw className="w-3.5 h-3.5" />,
  score_above: <ArrowRight className="w-3.5 h-3.5" />,
  no_activity_days: <Clock className="w-3.5 h-3.5" />,
};

const STEP_LABELS: Record<StepType, string> = {
  wait: 'Wait',
  send_email: 'Send Email',
  send_whatsapp: 'Send WhatsApp',
  update_status: 'Update Status',
};

const STEP_ICONS: Record<StepType, React.ReactNode> = {
  wait: <Clock className="w-4 h-4 text-muted-foreground" />,
  send_email: <Mail className="w-4 h-4 text-blue-500" />,
  send_whatsapp: <MessageCircle className="w-4 h-4 text-green-500" />,
  update_status: <RefreshCw className="w-4 h-4 text-purple-500" />,
};

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'];

const emptyStep = (): FlowStep => ({ sort_order: 0, step_type: 'wait', config: { hours: 24 } });

// ── Step Editor ───────────────────────────────────────────────────────────────

function StepEditor({ step, onChange, onDelete, index, total }: {
  step: FlowStep; onChange: (s: FlowStep) => void; onDelete: () => void;
  index: number; total: number;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
          {index + 1}
        </div>
        {index < total - 1 && <div className="w-0.5 h-full bg-border mt-1 min-h-[20px]" />}
      </div>
      <div className="flex-1 bg-muted/40 border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {STEP_ICONS[step.step_type]}
            <select
              value={step.step_type}
              onChange={e => onChange({ ...step, step_type: e.target.value as StepType, config: defaultConfig(e.target.value as StepType) })}
              className="bg-transparent text-sm font-medium text-foreground border-none outline-none cursor-pointer"
            >
              {(Object.keys(STEP_LABELS) as StepType[]).map(t => (
                <option key={t} value={t}>{STEP_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <button onClick={onDelete} className="p-1.5 text-muted-foreground hover:text-destructive transition rounded-lg hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {step.step_type === 'wait' && (
          <div className="flex items-center gap-2">
            <input
              type="number" min={1}
              value={step.config.hours ?? 24}
              onChange={e => onChange({ ...step, config: { hours: Number(e.target.value) } })}
              className="w-24 px-2.5 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
            />
            <span className="text-sm text-muted-foreground">hours before next step</span>
          </div>
        )}

        {step.step_type === 'send_email' && (
          <div className="space-y-2">
            <input
              value={step.config.subject ?? ''}
              onChange={e => onChange({ ...step, config: { ...step.config, subject: e.target.value } })}
              placeholder="Email subject — use {name} for lead name"
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
            />
            <textarea
              value={step.config.body_html ?? ''}
              onChange={e => onChange({ ...step, config: { ...step.config, body_html: e.target.value } })}
              rows={3}
              placeholder="Email body (HTML supported). Use {name} for lead name."
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none resize-none"
            />
          </div>
        )}

        {step.step_type === 'send_whatsapp' && (
          <div className="space-y-2">
            <textarea
              value={step.config.message ?? ''}
              onChange={e => onChange({ ...step, config: { message: e.target.value } })}
              rows={2}
              placeholder="WhatsApp message — use {name} for lead name, {phone} for their number"
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none resize-none"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" /> Messages open in WhatsApp — lead clicks to reply
            </p>
          </div>
        )}

        {step.step_type === 'update_status' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Set status to</span>
            <select
              value={step.config.status ?? 'contacted'}
              onChange={e => onChange({ ...step, config: { status: e.target.value } })}
              className="px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
            >
              {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function defaultConfig(type: StepType): Record<string, any> {
  if (type === 'wait') return { hours: 24 };
  if (type === 'send_email') return { subject: '', body_html: '' };
  if (type === 'send_whatsapp') return { message: '' };
  if (type === 'update_status') return { status: 'contacted' };
  return {};
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DripFlowsPage() {
  const [shopId, setShopId] = useState('');
  const [flows, setFlows] = useState<DripFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DripFlow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState<number | null>(null);
  const [expandedFlow, setExpandedFlow] = useState<number | null>(null);
  const [enrollments, setEnrollments] = useState<Record<number, Enrollment[]>>({});
  const [loadingEnrollments, setLoadingEnrollments] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTrigger, setFormTrigger] = useState<TriggerType>('lead_created');
  const [formTriggerConfig, setFormTriggerConfig] = useState<Record<string, any>>({});
  const [formSteps, setFormSteps] = useState<FlowStep[]>([]);

  useEffect(() => {
    const id = localStorage.getItem('shop_id') || '';
    setShopId(id);
  }, []);

  const load = async () => {
    if (!shopId) return;
    try {
      const res = await dripFlowsApi.getAll(shopId);
      setFlows(res.data ?? []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId]);

  const openNew = () => {
    setEditing(null);
    setFormName(''); setFormDesc('');
    setFormTrigger('lead_created'); setFormTriggerConfig({});
    setFormSteps([]);
    setError(''); setShowModal(true);
  };

  const openEdit = (flow: DripFlow) => {
    setEditing(flow);
    setFormName(flow.name); setFormDesc(flow.description || '');
    setFormTrigger(flow.trigger_type); setFormTriggerConfig(flow.trigger_config || {});
    setFormSteps(flow.steps.map(s => ({ ...s })));
    setError(''); setShowModal(true);
  };

  const save = async () => {
    if (!formName.trim()) { setError('Flow name is required.'); return; }
    if (formSteps.length === 0) { setError('Add at least one step.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: formName.trim(), description: formDesc || null,
        trigger_type: formTrigger, trigger_config: formTriggerConfig,
        steps: formSteps.map((s, i) => ({ ...s, sort_order: i })),
      };
      if (editing) await dripFlowsApi.update(shopId, editing.id, payload);
      else await dripFlowsApi.create(shopId, payload);
      setShowModal(false); load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save flow.');
    } finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this drip flow? All enrollments will be removed.')) return;
    try { await dripFlowsApi.delete(shopId, id); load(); } catch {}
  };

  const toggle = async (flow: DripFlow) => {
    setToggling(flow.id);
    try { await dripFlowsApi.toggle(shopId, flow.id); load(); } catch {}
    setToggling(null);
  };

  const loadEnrollments = async (flowId: number) => {
    if (expandedFlow === flowId) { setExpandedFlow(null); return; }
    setExpandedFlow(flowId);
    if (enrollments[flowId]) return;
    setLoadingEnrollments(flowId);
    try {
      const res = await dripFlowsApi.getEnrollments(shopId, flowId);
      setEnrollments(prev => ({ ...prev, [flowId]: res.data ?? [] }));
    } catch {}
    setLoadingEnrollments(null);
  };

  const addStep = (type: StepType) => {
    setFormSteps(prev => [...prev, { sort_order: prev.length, step_type: type, config: defaultConfig(type) }]);
  };

  const updateStep = (idx: number, step: FlowStep) => {
    setFormSteps(prev => prev.map((s, i) => i === idx ? step : s));
  };

  const deleteStep = (idx: number) => {
    setFormSteps(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GitBranch className="w-5 h-5 text-purple-500" />
            <h1 className="text-2xl font-bold text-foreground">Drip Flows</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Automated email &amp; WhatsApp sequences — set up once, run forever on autopilot
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/leads" className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition">
            ← Leads
          </Link>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
          >
            <Plus className="w-4 h-4" /> New Flow
          </button>
        </div>
      </div>

      {/* Explainer banner */}
      <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl px-5 py-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">How drip flows work</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            A flow starts when a trigger fires (e.g. new lead created). It then runs each step in order — wait, send email, update status — automatically. Activate a flow to start it.
          </p>
        </div>
      </div>

      {/* Flow list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : flows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <GitBranch className="w-14 h-14 mx-auto text-muted-foreground opacity-40 mb-4" />
          <h3 className="font-semibold text-foreground mb-1">No drip flows yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Create your first flow to start automating lead follow-ups.</p>
          <button onClick={openNew} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            <Plus className="w-4 h-4" /> Create Flow
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {flows.map(flow => (
            <div key={flow.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Flow header */}
              <div className="px-5 py-4 flex items-center gap-4">
                {/* Active toggle */}
                <button
                  onClick={() => toggle(flow)}
                  disabled={toggling === flow.id}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 disabled:opacity-50 ${flow.is_active ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
                >
                  {toggling === flow.id
                    ? <Loader2 className="w-3.5 h-3.5 text-white absolute top-1 left-1 animate-spin" />
                    : <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${flow.is_active ? 'left-5' : 'left-0.5'}`} />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{flow.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${flow.is_active ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                      {flow.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      {TRIGGER_ICONS[flow.trigger_type]} {TRIGGER_LABELS[flow.trigger_type]}
                    </span>
                  </div>
                  {flow.description && <p className="text-xs text-muted-foreground mt-0.5">{flow.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {flow.steps.length} steps</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {flow.stats.enrolled} active</span>
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {flow.stats.completed} completed</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {flow.stats.emails_sent} emails sent</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(flow)} className="p-2 text-muted-foreground hover:text-primary transition rounded-lg hover:bg-muted">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => del(flow.id)} className="p-2 text-muted-foreground hover:text-destructive transition rounded-lg hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => loadEnrollments(flow.id)} className="p-2 text-muted-foreground hover:text-foreground transition rounded-lg hover:bg-muted">
                    {expandedFlow === flow.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Steps preview strip */}
              {flow.steps.length > 0 && (
                <div className="px-5 pb-3 flex items-center gap-1.5 overflow-x-auto">
                  {flow.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1.5 shrink-0">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                        {STEP_ICONS[step.step_type]}
                        {step.step_type === 'wait' ? `Wait ${step.config.hours}h` :
                         step.step_type === 'send_email' ? (step.config.subject || 'Email') :
                         step.step_type === 'send_whatsapp' ? 'WhatsApp' :
                         `→ ${step.config.status}`}
                      </div>
                      {i < flow.steps.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                    </div>
                  ))}
                </div>
              )}

              {/* Enrollments panel */}
              {expandedFlow === flow.id && (
                <div className="border-t border-border">
                  {loadingEnrollments === flow.id ? (
                    <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : (enrollments[flow.id] ?? []).length === 0 ? (
                    <div className="px-5 py-4 text-sm text-muted-foreground">No enrollments yet. Activate this flow and it will auto-enroll leads when the trigger fires.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            {['Lead', 'Status', 'Steps Done', 'Emails Sent', 'Next Run', 'Enrolled'].map(h => (
                              <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {(enrollments[flow.id] ?? []).map(e => (
                            <tr key={e.id} className="hover:bg-muted/20">
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-foreground text-xs">{e.lead?.name ?? '—'}</p>
                                {e.lead?.email && <p className="text-xs text-muted-foreground">{e.lead.email}</p>}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  e.status === 'active' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                  e.status === 'completed' ? 'bg-blue-500/10 text-blue-600' :
                                  'bg-muted text-muted-foreground'
                                }`}>{e.status}</span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{e.steps_completed} / {flow.steps.length}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{e.emails_sent}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                {e.next_run_at ? new Date(e.next_run_at).toLocaleString('en-AE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                {new Date(e.enrolled_at).toLocaleDateString('en-AE')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-purple-500" />
                {editing ? 'Edit Flow' : 'New Drip Flow'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              {/* Name & Description */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Flow Name *</label>
                  <input
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. New Lead Welcome Sequence"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Description (optional)</label>
                  <input
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="What does this flow do?"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Trigger */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Trigger — when should this flow start?</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setFormTrigger(t); setFormTriggerConfig({}); }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition ${formTrigger === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:border-primary/30'}`}
                    >
                      {TRIGGER_ICONS[t]} {TRIGGER_LABELS[t]}
                    </button>
                  ))}
                </div>

                {/* Trigger config */}
                {formTrigger === 'status_changed' && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">When status becomes</span>
                    <select
                      value={formTriggerConfig.status ?? ''}
                      onChange={e => setFormTriggerConfig({ status: e.target.value })}
                      className="px-3 py-1.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="">Any status</option>
                      {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                  </div>
                )}
                {formTrigger === 'score_above' && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">When score crosses</span>
                    <input
                      type="number" min={1} max={100}
                      value={formTriggerConfig.score ?? 70}
                      onChange={e => setFormTriggerConfig({ score: Number(e.target.value) })}
                      className="w-20 px-2.5 py-1.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                    />
                    <span className="text-sm text-muted-foreground">points</span>
                  </div>
                )}
                {formTrigger === 'no_activity_days' && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">After</span>
                    <input
                      type="number" min={1}
                      value={formTriggerConfig.days ?? 14}
                      onChange={e => setFormTriggerConfig({ days: Number(e.target.value) })}
                      className="w-20 px-2.5 py-1.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                    />
                    <span className="text-sm text-muted-foreground">days of no activity</span>
                  </div>
                )}
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-foreground">Steps ({formSteps.length})</label>
                </div>
                <div className="space-y-3">
                  {formSteps.map((step, i) => (
                    <StepEditor
                      key={i} step={step} index={i} total={formSteps.length}
                      onChange={s => updateStep(i, s)}
                      onDelete={() => deleteStep(i)}
                    />
                  ))}
                </div>
                {/* Add step buttons */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(Object.keys(STEP_LABELS) as StepType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addStep(type)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
                    >
                      <Plus className="w-3 h-3" /> {STEP_LABELS[type]}
                    </button>
                  ))}
                </div>
                {formSteps.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center py-4 bg-muted/30 rounded-xl">
                    Add steps above — they run in order, top to bottom.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Flow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
