'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2, Users, Loader2, CheckCircle, X, ShieldCheck } from 'lucide-react';
import { teamApi, type TeamRole } from '@/lib/api';
import type { PermissionArea } from '@/lib/access';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';

const errMsg = (e: any, fallback: string) => {
  const d = e?.response?.data?.detail;
  return typeof d === 'string' ? d : fallback;
};

interface Draft { id: number | null; name: string; description: string; permissions: Set<string> }
const emptyDraft = (): Draft => ({ id: null, name: '', description: '', permissions: new Set() });

export default function RolesPage() {
  const confirm = useConfirm();
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const [areas, setAreas] = useState<PermissionArea[]>([]);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    if (!shopId) return;
    try {
      const [a, r] = await Promise.all([teamApi.permissions(shopId), teamApi.listRoles(shopId)]);
      setAreas(a.data.areas);
      setRoles(r.data.roles);
    } catch (e) {
      notify(errMsg(e, 'Could not load roles.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  const areaLabel = useMemo(() => Object.fromEntries(areas.map((a) => [a.key, a.label])), [areas]);

  // "manage" (create/edit/delete) always includes "view" (read) - turning
  // manage on turns view on with it, and turning view off turns manage off.
  const toggle = (area: string, level: 'view' | 'manage', on: boolean) => {
    if (!draft) return;
    const next = new Set(draft.permissions);
    if (level === 'manage') {
      if (on) { next.add(`${area}.manage`); next.add(`${area}.view`); } else { next.delete(`${area}.manage`); }
    } else if (on) {
      next.add(`${area}.view`);
    } else {
      next.delete(`${area}.view`); next.delete(`${area}.manage`);
    }
    setDraft({ ...draft, permissions: next });
  };

  const setAll = (mode: 'none' | 'view' | 'manage') => {
    if (!draft) return;
    const next = new Set<string>();
    if (mode !== 'none') areas.forEach((a) => { next.add(`${a.key}.view`); if (mode === 'manage') next.add(`${a.key}.manage`); });
    setDraft({ ...draft, permissions: next });
  };

  const openNew = () => { setFormError(''); setDraft(emptyDraft()); };
  const openEdit = (r: TeamRole) => {
    setFormError('');
    setDraft({ id: r.id, name: r.name, description: r.description ?? '', permissions: new Set(r.permissions) });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) { setFormError('Give the role a name.'); return; }
    setSaving(true);
    setFormError('');
    const body = { name: draft.name.trim(), description: draft.description.trim() || undefined, permissions: Array.from(draft.permissions) };
    try {
      if (draft.id) await teamApi.updateRole(shopId, draft.id, body);
      else await teamApi.createRole(shopId, body);
      setDraft(null);
      notify(draft.id ? 'Role updated. It applies to everyone on it straight away.' : 'Role created');
      load();
    } catch (err) {
      setFormError(errMsg(err, 'Could not save the role.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: TeamRole) => {
    if (r.member_count > 0) {
      notify(`${r.member_count} team member(s) still have "${r.name}". Move them to another role first.`, 'error');
      return;
    }
    const ok = await confirm({ title: `Delete "${r.name}"?`, description: 'This role will be removed. No one is using it.', confirmText: 'Delete role', variant: 'destructive' });
    if (!ok) return;
    try {
      await teamApi.deleteRole(shopId, r.id);
      notify('Role deleted');
      load();
    } catch (err) {
      notify(errMsg(err, 'Could not delete the role.'), 'error');
    }
  };

  const summary = (r: TeamRole) => {
    const manage = r.permissions.filter((p) => p.endsWith('.manage')).map((p) => p.split('.')[0]);
    const viewOnly = r.permissions.filter((p) => p.endsWith('.view')).map((p) => p.split('.')[0]).filter((a) => !manage.includes(a));
    return { manage, viewOnly };
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed right-4 top-4 z-[70] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <Link href="/dashboard/staff" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Team
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Roles &amp; permissions</h1>
          <p className="text-sm text-muted-foreground">You decide what each role can see and change. Billing, settings, connected accounts and this team screen always stay with you.</p>
        </div>
        <Button onClick={openNew} disabled={loading}><Plus className="h-4 w-4" /> New role</Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : roles.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No roles yet</p>
            <p className="mx-auto mb-4 mt-1 max-w-sm text-xs text-muted-foreground">
              Create a role like &ldquo;Warehouse&rdquo; or &ldquo;Support desk&rdquo;, tick what it can do, then invite people into it.
            </p>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Create your first role</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => {
            const { manage, viewOnly } = summary(r);
            return (
              <Card key={r.id}>
                <CardContent className="flex h-full flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{r.name}</p>
                      {r.description && <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="my-3 flex flex-1 flex-wrap content-start gap-1.5">
                    {manage.map((a) => <Badge key={a} variant="success">{areaLabel[a] ?? a} · edit</Badge>)}
                    {viewOnly.map((a) => <Badge key={a} variant="muted">{areaLabel[a] ?? a} · view</Badge>)}
                    {manage.length + viewOnly.length === 0 && <span className="text-xs text-muted-foreground">No permissions yet</span>}
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {r.member_count === 0 ? 'No one has this role' : `${r.member_count} member${r.member_count === 1 ? '' : 's'}`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit role' : 'New role'}</DialogTitle>
            <DialogDescription>Tick what people with this role are allowed to do. <span className="font-medium">View</span> lets them look; <span className="font-medium">Edit</span> also lets them add, change and delete.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={save} className="space-y-4 p-5">
              {formError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="role-name">Role name</Label>
                  <Input id="role-name" required maxLength={60} value={draft.name} placeholder="e.g. Warehouse"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="role-desc" maxLength={200} value={draft.description} placeholder="Who is this for?"
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Label>Permissions <span className="text-muted-foreground">· {draft.permissions.size} selected</span></Label>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAll('none')}>Clear</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAll('view')}>View everything</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAll('manage')}>Full access</Button>
                  </div>
                </div>
                <div className="divide-y divide-border rounded-xl border border-border">
                  <div className="hidden grid-cols-[1fr_64px_64px] gap-3 bg-muted/50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                    <span>Area</span><span className="text-center">View</span><span className="text-center">Edit</span>
                  </div>
                  {areas.map((a) => {
                    const canManage = draft.permissions.has(`${a.key}.manage`);
                    const canView = draft.permissions.has(`${a.key}.view`);
                    return (
                      <div key={a.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_64px_64px]">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{a.label}</p>
                          <p className="text-xs text-muted-foreground">{a.description}</p>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-muted-foreground sm:hidden">View</span>
                          <Switch checked={canView} disabled={canManage} aria-label={`View ${a.label}`}
                            onCheckedChange={(on) => toggle(a.key, 'view', on)} />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-muted-foreground sm:hidden">Edit</span>
                          <Switch checked={canManage} aria-label={`Edit ${a.label}`}
                            onCheckedChange={(on) => toggle(a.key, 'manage', on)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} {draft.id ? 'Save changes' : 'Create role'}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
