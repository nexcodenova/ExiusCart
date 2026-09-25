'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  UserPlus, Crown, ShieldCheck, Mail, Trash2, Loader2, CheckCircle, X, Pause, Play, Send,
} from 'lucide-react';
import { teamApi, type TeamMember, type TeamRole } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ui/confirm-dialog';

const errMsg = (e: any, fallback: string) => {
  const d = e?.response?.data?.detail;
  return typeof d === 'string' ? d : fallback;
};

const initials = (name: string | null, email: string) =>
  (name || email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

const STATUS: Record<TeamMember['status'], { label: string; variant: 'success' | 'default' | 'muted' }> = {
  active: { label: 'Active', variant: 'success' },
  invited: { label: 'Invited', variant: 'default' },
  suspended: { label: 'Suspended', variant: 'muted' },
};

export default function TeamPage() {
  const confirm = useConfirm();
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const [owner, setOwner] = useState<{ email: string | null; full_name: string | null } | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: '', full_name: '', role_id: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    if (!shopId) return;
    try {
      const [m, r] = await Promise.all([teamApi.listMembers(shopId), teamApi.listRoles(shopId)]);
      setOwner(m.data.owner);
      setMembers(m.data.members);
      setRoles(r.data.roles);
    } catch (e) {
      notify(errMsg(e, 'Could not load your team.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  const openInvite = () => {
    setInvite({ email: '', full_name: '', role_id: roles[0] ? String(roles[0].id) : '' });
    setInviteError('');
    setInviteOpen(true);
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    if (!invite.role_id) { setInviteError('Pick a role first.'); return; }
    setInviting(true);
    try {
      await teamApi.invite(shopId, { email: invite.email.trim(), full_name: invite.full_name.trim() || undefined, role_id: Number(invite.role_id) });
      setInviteOpen(false);
      notify(`Invitation sent to ${invite.email.trim()}`);
      load();
    } catch (err) {
      setInviteError(errMsg(err, 'Could not send the invitation.'));
    } finally {
      setInviting(false);
    }
  };

  const run = async (id: number, action: () => Promise<unknown>, okMsg: string) => {
    setBusyId(id);
    try {
      await action();
      notify(okMsg);
      await load();
    } catch (e) {
      notify(errMsg(e, 'Something went wrong.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = (m: TeamMember, roleId: string) =>
    run(m.id, () => teamApi.updateMember(shopId, m.id, { role_id: Number(roleId) }), `${m.email} is now ${roles.find((r) => String(r.id) === roleId)?.name ?? 'updated'}`);

  const toggleSuspend = async (m: TeamMember) => {
    const suspending = m.status === 'active';
    if (suspending) {
      const ok = await confirm({
        title: `Pause ${m.full_name || m.email}?`,
        description: 'They will be signed out of your store straight away and can’t get back in until you reactivate them. Nothing they did is deleted.',
        confirmText: 'Pause access',
        variant: 'destructive',
      });
      if (!ok) return;
    }
    run(m.id, () => teamApi.updateMember(shopId, m.id, { status: suspending ? 'suspended' : 'active' }),
      suspending ? `${m.email} paused` : `${m.email} reactivated`);
  };

  const removeMember = async (m: TeamMember) => {
    const ok = await confirm({
      title: `Remove ${m.full_name || m.email}?`,
      description: m.status === 'invited'
        ? 'The invitation link stops working.'
        : 'They lose access to your store immediately. Their own ExiusCart account isn’t deleted.',
      confirmText: 'Remove',
      variant: 'destructive',
    });
    if (!ok) return;
    run(m.id, () => teamApi.remove(shopId, m.id), `${m.email} removed`);
  };

  return (
    <div className="mx-auto max-w-4xl">
      {toast && (
        <div className={`fixed right-4 top-4 z-[70] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground">Invite people to help run your store, and choose exactly what each of them can do.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/dashboard/staff/roles"><ShieldCheck className="h-4 w-4" /> Roles &amp; permissions</Link></Button>
          <Button onClick={openInvite} disabled={loading}><UserPlus className="h-4 w-4" /> Invite member</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-xl" />)}</div>
      ) : (
        <>
          {roles.length === 0 && (
            <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm text-foreground">
                  <span className="font-medium">Start by creating a role.</span>{' '}
                  <span className="text-muted-foreground">A role is a set of permissions you choose, like &ldquo;Warehouse&rdquo; or &ldquo;Support desk&rdquo;. You&apos;ll assign one to each person you invite.</span>
                </p>
                <Button asChild size="sm"><Link href="/dashboard/staff/roles">Create a role</Link></Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="divide-y divide-border p-0">
              <div className="flex items-center gap-3 p-4">
                <Avatar text={initials(owner?.full_name ?? null, owner?.email ?? '')} owner />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{owner?.full_name || owner?.email} <span className="text-muted-foreground">(you)</span></p>
                  <p className="truncate text-xs text-muted-foreground">{owner?.email}</p>
                </div>
                <Badge variant="default"><Crown className="mr-1 h-3 w-3" /> Owner</Badge>
              </div>

              {members.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                  <Avatar text={initials(m.full_name, m.email)} />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-medium text-foreground">{m.full_name || m.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.full_name ? m.email : STATUS[m.status].label === 'Invited' ? 'Waiting to accept' : ''}</p>
                  </div>
                  <Badge variant={STATUS[m.status].variant}>{STATUS[m.status].label}</Badge>
                  <div className="w-44">
                    <Select value={String(m.role_id)} onValueChange={(v) => changeRole(m, v)} disabled={busyId === m.id}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    {busyId === m.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {m.status === 'invited' && (
                      <Button variant="ghost" size="icon" title="Resend invitation" disabled={busyId === m.id}
                        onClick={() => run(m.id, () => teamApi.resend(shopId, m.id), `Invitation re-sent to ${m.email}`)}>
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {m.status === 'active' && (
                      <Button variant="ghost" size="icon" title="Pause access" disabled={busyId === m.id} onClick={() => toggleSuspend(m)}>
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {m.status === 'suspended' && (
                      <Button variant="ghost" size="icon" title="Reactivate" disabled={busyId === m.id} onClick={() => toggleSuspend(m)}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" title="Remove from team" disabled={busyId === m.id} onClick={() => removeMember(m)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              {members.length === 0 && roles.length > 0 && (
                <div className="p-8 text-center">
                  <Mail className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground">Just you so far</p>
                  <p className="mb-3 text-xs text-muted-foreground">Invite someone and they&apos;ll get an email to set up their login.</p>
                  <Button size="sm" onClick={openInvite}><UserPlus className="h-4 w-4" /> Invite your first member</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>They&apos;ll get an email with a link to set their password. The link works for 7 days.</DialogDescription>
          </DialogHeader>
          <form onSubmit={sendInvite} className="space-y-4 p-5">
            {inviteError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{inviteError}</div>}
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" required value={invite.email} placeholder="name@example.com"
                onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Name <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="invite-name" value={invite.full_name} placeholder="So the email greets them properly"
                onChange={(e) => setInvite({ ...invite, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              {roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t created any roles yet. <Link href="/dashboard/staff/roles" className="font-medium text-primary underline">Create one first</Link>.
                </p>
              ) : (
                <Select value={invite.role_id} onValueChange={(v) => setInvite({ ...invite, role_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose a role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={inviting || roles.length === 0}>
                {inviting && <Loader2 className="h-4 w-4 animate-spin" />} Send invitation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Avatar({ text, owner = false }: { text: string; owner?: boolean }) {
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${owner ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
      {text}
    </div>
  );
}
