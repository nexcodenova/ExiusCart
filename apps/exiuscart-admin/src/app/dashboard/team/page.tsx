'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { UsersRound, Plus, Loader2, X, Pencil, Trash2, Send, Ban, RotateCcw, Crown, ShieldCheck } from 'lucide-react';
import { adminTeamApi } from '@/lib/api';
import { useAdminAccess } from '@/components/access-provider';

type Tab = 'team' | 'roles' | 'activity';

interface Perm { key: string; label: string; hint: string }
interface Area { area: string; label: string; permissions: Perm[] }
interface Role { id: number; name: string; description: string | null; permissions: string[]; member_count: number }
interface Member { id: number; email: string; full_name: string | null; status: string; role_id: number; role_name: string | null; invited_at: string | null; joined_at: string | null }
interface Ev { id: number; event_type: string; who: string | null; email: string | null; description: string | null; created_at: string | null }

const utc = (iso: string) => new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : iso + 'Z');
const fmt = (iso: string | null) => (iso ? utc(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const errText = (e: any, fallback: string) => {
  const d = e?.response?.data?.detail;
  return typeof d === 'string' ? d : fallback;
};

const STATUS_LABEL: Record<string, string> = { active: 'Active', invited: 'Invite sent', suspended: 'Suspended' };
const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  invited: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Drawn on the page itself (not inside the dashboard shell) so it dims the
  // top bar and the menu too.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#6B3FD9] focus:outline-none focus:ring-2 focus:ring-[#6B3FD9]/20';

export default function AdminTeamPage() {
  const router = useRouter();
  const { loaded, isOwner } = useAdminAccess();
  const [tab, setTab] = useState<Tab>('team');
  const [areas, setAreas] = useState<Area[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [owner, setOwner] = useState<{ email: string; full_name: string | null } | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [more, setMore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role_id: 0 });
  const [roleForm, setRoleForm] = useState<{ id: number | null; name: string; description: string; permissions: string[] } | null>(null);
  const [formError, setFormError] = useState('');

  // Owner-only page: the menu hides it from staff, this is the belt to that braces.
  useEffect(() => { if (loaded && !isOwner) router.replace('/dashboard/shopping'); }, [loaded, isOwner, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, m, a] = await Promise.all([adminTeamApi.permissions(), adminTeamApi.roles(), adminTeamApi.members(), adminTeamApi.activity()]);
      setAreas(p.data.areas); setRoles(r.data.roles); setMembers(m.data.members); setOwner(m.data.owner);
      setEvents(a.data.events); setMore(a.data.next_before_id ?? null);
      setError('');
    } catch (e: any) {
      setError(errText(e, 'Could not load the team.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (loaded && isOwner) load(); }, [loaded, isOwner, load]);

  const flash = (t: string) => { setNotice(t); setTimeout(() => setNotice(''), 3500); };

  const doInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!inviteForm.role_id) { setFormError('Pick a role for this person first.'); return; }
    setBusy('invite');
    try {
      await adminTeamApi.invite({ email: inviteForm.email.trim(), full_name: inviteForm.full_name.trim() || undefined, role_id: inviteForm.role_id });
      setInviteOpen(false); setInviteForm({ email: '', full_name: '', role_id: 0 });
      flash('Invitation sent. It expires in 7 days.');
      await load();
    } catch (err: any) { setFormError(errText(err, 'Could not send the invitation.')); } finally { setBusy(null); }
  };

  const memberAction = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try { await fn(); flash(ok); await load(); } catch (err: any) { setError(errText(err, 'That did not work.')); } finally { setBusy(null); }
  };

  const saveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm) return;
    setFormError('');
    setBusy('role');
    try {
      const body = { name: roleForm.name.trim(), description: roleForm.description.trim() || undefined, permissions: roleForm.permissions };
      if (roleForm.id) await adminTeamApi.updateRole(roleForm.id, body); else await adminTeamApi.createRole(body);
      setRoleForm(null);
      flash('Role saved.');
      await load();
    } catch (err: any) { setFormError(errText(err, 'Could not save the role.')); } finally { setBusy(null); }
  };

  const toggleAll = (perms: string[], on: boolean) =>
    setRoleForm((f) => f && ({ ...f, permissions: on ? Array.from(new Set([...f.permissions, ...perms])) : f.permissions.filter((p) => !perms.includes(p)) }));

  if (!loaded || !isOwner) return null;

  const labelOf = (key: string) => areas.flatMap((a) => a.permissions).find((p) => p.key === key)?.label ?? key;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><UsersRound className="h-6 w-6 text-[#6B3FD9]" /> Admin Team</h1>
          <p className="mt-1 text-sm text-gray-500">Invite people to help run Prodora. You choose exactly what each role can do. Payments, subscriptions, users and settings always stay with you.</p>
        </div>
        <button
          type="button" onClick={() => { setFormError(''); setInviteForm({ email: '', full_name: '', role_id: roles[0]?.id ?? 0 }); setInviteOpen(true); }}
          disabled={roles.length === 0}
          title={roles.length === 0 ? 'Create a role first' : undefined}
          className="inline-flex items-center gap-2 rounded-lg bg-[#6B3FD9] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5A2EC9] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Invite person
        </button>
      </div>

      {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">{notice}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      <div className="flex gap-1 border-b border-gray-200">
        {([['team', `Team (${members.length + 1})`], ['roles', `Roles (${roles.length})`], ['activity', 'Activity']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === k ? 'border-[#6B3FD9] text-[#6B3FD9]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#6B3FD9]" /></div>
      ) : tab === 'team' ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-3">Person</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3"><div className="flex items-center gap-2 font-medium text-gray-900"><Crown className="h-4 w-4 text-amber-500" />{owner?.full_name || owner?.email}</div><div className="text-xs text-gray-500">{owner?.email}</div></td>
                <td className="px-4 py-3 text-gray-700">Owner</td>
                <td className="px-4 py-3"><span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">You</span></td>
                <td className="px-4 py-3 text-gray-400">—</td><td className="px-4 py-3 text-right text-xs text-gray-400">Full access</td>
              </tr>
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3"><div className="font-medium text-gray-900">{m.full_name || m.email}</div><div className="text-xs text-gray-500">{m.email}</div></td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Role for ${m.email}`} value={m.role_id} disabled={busy === `role-${m.id}`}
                      onChange={(e) => memberAction(`role-${m.id}`, () => adminTeamApi.updateMember(m.id, { role_id: Number(e.target.value) }), 'Role changed.')}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 focus:border-[#6B3FD9] focus:outline-none"
                    >
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status] ?? ''}`}>{STATUS_LABEL[m.status] ?? m.status}</span></td>
                  <td className="px-4 py-3 text-gray-600">{fmt(m.joined_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {m.status === 'invited' && (
                        <button type="button" title="Resend invitation" onClick={() => memberAction(`resend-${m.id}`, () => adminTeamApi.resend(m.id), 'Invitation sent again.')}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-[#6B3FD9]"><Send className="h-4 w-4" /></button>
                      )}
                      {m.status === 'active' && (
                        <button type="button" title="Suspend" onClick={() => memberAction(`s-${m.id}`, () => adminTeamApi.updateMember(m.id, { status: 'suspended' }), 'Suspended. They are locked out now.')}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-amber-600"><Ban className="h-4 w-4" /></button>
                      )}
                      {m.status === 'suspended' && (
                        <button type="button" title="Reactivate" onClick={() => memberAction(`s-${m.id}`, () => adminTeamApi.updateMember(m.id, { status: 'active' }), 'Reactivated.')}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-green-600"><RotateCcw className="h-4 w-4" /></button>
                      )}
                      <button type="button" title="Remove from team"
                        onClick={() => { if (window.confirm(`Remove ${m.full_name || m.email} from the admin team? They lose all admin access.`)) memberAction(`d-${m.id}`, () => adminTeamApi.removeMember(m.id), 'Removed from the team.'); }}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                  {roles.length === 0 ? 'Start on the Roles tab: build a role, then invite someone into it.' : 'No one has been invited yet. Use Invite person.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : tab === 'roles' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={() => { setFormError(''); setRoleForm({ id: null, name: '', description: '', permissions: [] }); }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#6B3FD9] px-4 py-2 text-sm font-semibold text-[#6B3FD9] transition hover:bg-[#6B3FD9]/5">
              <Plus className="h-4 w-4" /> New role
            </button>
          </div>
          {roles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
              No roles yet. A role is a named set of permissions, for example &ldquo;Catalogue editor&rdquo;. Create one, then invite people into it.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {roles.map((r) => (
                <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold text-gray-900"><ShieldCheck className="h-4 w-4 text-[#6B3FD9]" />{r.name}</h3>
                      {r.description && <p className="mt-0.5 text-sm text-gray-500">{r.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button type="button" title="Edit role" onClick={() => { setFormError(''); setRoleForm({ id: r.id, name: r.name, description: r.description ?? '', permissions: r.permissions }); }}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-[#6B3FD9]"><Pencil className="h-4 w-4" /></button>
                      <button type="button" title="Delete role"
                        onClick={() => { if (window.confirm(`Delete the role "${r.name}"?`)) memberAction(`rd-${r.id}`, () => adminTeamApi.deleteRole(r.id), 'Role deleted.'); }}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.permissions.length === 0 ? <span className="text-xs text-gray-400">No permissions ticked</span> : r.permissions.map((p) => (
                      <span key={p} className="rounded-full bg-[#6B3FD9]/10 px-2.5 py-0.5 text-xs font-medium text-[#5A2EC9]">{labelOf(p)}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">{r.member_count} {r.member_count === 1 ? 'person' : 'people'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Who</th><th className="px-4 py-3">What happened</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{fmt(ev.created_at)}</td>
                  <td className="px-4 py-3 text-gray-900">{ev.who || ev.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{ev.description || ev.event_type}</td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-500">Nothing yet. Every change your staff make is listed here.</td></tr>}
            </tbody>
          </table>
          {more && (
            <div className="border-t border-gray-100 p-3 text-center">
              <button type="button" onClick={async () => { const r = await adminTeamApi.activity(more); setEvents((e) => [...e, ...r.data.events]); setMore(r.data.next_before_id ?? null); }}
                className="text-sm font-medium text-[#6B3FD9] hover:underline">Show older</button>
            </div>
          )}
        </div>
      )}

      {inviteOpen && (
        <Modal title="Invite a person" onClose={() => setInviteOpen(false)}>
          <form onSubmit={doInvite} className="space-y-4">
            <div>
              <label htmlFor="inv-email" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input id="inv-email" type="email" required value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className={inputCls} placeholder="name@company.com" />
            </div>
            <div>
              <label htmlFor="inv-name" className="mb-1 block text-sm font-medium text-gray-700">Name <span className="font-normal text-gray-400">(optional)</span></label>
              <input id="inv-name" value={inviteForm.full_name} onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="inv-role" className="mb-1 block text-sm font-medium text-gray-700">Role</label>
              <select id="inv-role" value={inviteForm.role_id} onChange={(e) => setInviteForm({ ...inviteForm, role_id: Number(e.target.value) })} className={inputCls}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setInviteOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={busy === 'invite'} className="inline-flex items-center gap-2 rounded-lg bg-[#6B3FD9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5A2EC9] disabled:opacity-60">
                {busy === 'invite' && <Loader2 className="h-4 w-4 animate-spin" />} Send invitation
              </button>
            </div>
          </form>
        </Modal>
      )}

      {roleForm && (
        <Modal title={roleForm.id ? 'Edit role' : 'New role'} onClose={() => setRoleForm(null)}>
          <form onSubmit={saveRole} className="space-y-4">
            <div>
              <label htmlFor="role-name" className="mb-1 block text-sm font-medium text-gray-700">Role name</label>
              <input id="role-name" required maxLength={60} value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} className={inputCls} placeholder="e.g. Catalogue editor" />
            </div>
            <div>
              <label htmlFor="role-desc" className="mb-1 block text-sm font-medium text-gray-700">Description <span className="font-normal text-gray-400">(optional)</span></label>
              <input id="role-desc" maxLength={200} value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} className={inputCls} />
            </div>
            {areas.map((area) => {
              const keys = area.permissions.map((p) => p.key);
              const all = keys.every((k) => roleForm.permissions.includes(k));
              return (
                <fieldset key={area.area} className="rounded-xl border border-gray-200 p-4">
                  <legend className="px-1 text-sm font-semibold text-gray-900">{area.label}</legend>
                  <button type="button" onClick={() => toggleAll(keys, !all)} className="mb-2 text-xs font-medium text-[#6B3FD9] hover:underline">{all ? 'Untick all' : 'Tick all'}</button>
                  <div className="space-y-2.5">
                    {area.permissions.map((p) => (
                      <label key={p.key} className="flex cursor-pointer items-start gap-2.5">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#6B3FD9]"
                          checked={roleForm.permissions.includes(p.key)}
                          onChange={(e) => setRoleForm({ ...roleForm, permissions: e.target.checked ? [...roleForm.permissions, p.key] : roleForm.permissions.filter((k) => k !== p.key) })} />
                        <span><span className="block text-sm font-medium text-gray-800">{p.label}</span><span className="block text-xs text-gray-500">{p.hint}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setRoleForm(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={busy === 'role'} className="inline-flex items-center gap-2 rounded-lg bg-[#6B3FD9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5A2EC9] disabled:opacity-60">
                {busy === 'role' && <Loader2 className="h-4 w-4 animate-spin" />} Save role
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
