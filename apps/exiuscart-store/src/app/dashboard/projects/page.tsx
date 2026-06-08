'use client';
import { useState, useEffect } from 'react';
import { Plus, FolderOpen, CheckSquare, Trash2, Edit2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { projectsApi } from '@/lib/api';

const PROJECT_STATUS = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'];
const TASK_STAGES = ['todo', 'in_progress', 'review', 'done'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const STAGE_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  review: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  planning: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  on_hold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-400', normal: 'text-blue-500', high: 'text-orange-500', urgent: 'text-red-500',
};

export default function ProjectsPage() {
  const [shopId, setShopId] = useState<string>('');
  const [projects, setProjects] = useState<any[]>([]);
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || '1'); }, []);
  const [tasks, setTasks] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState<number | null>(null);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [projectForm, setProjectForm] = useState<any>({ name: '', description: '', deadline: '' });
  const [taskForm, setTaskForm] = useState<any>({ title: '', description: '', stage: 'todo', priority: 'normal', assigned_to: '', due_date: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try { const r = await projectsApi.getProjects(shopId); setProjects(r.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId]);

  const loadTasks = async (pid: number) => {
    try { const r = await projectsApi.getTasks(shopId!, pid); setTasks(t => ({ ...t, [pid]: r.data })); }
    catch {}
  };

  const toggleExpand = (pid: number) => {
    if (expanded === pid) setExpanded(null);
    else { setExpanded(pid); loadTasks(pid); }
  };

  const openNewProject = () => { setEditingProject(null); setProjectForm({ name: '', description: '', deadline: '' }); setShowProjectModal(true); };
  const openEditProject = (p: any) => {
    setEditingProject(p);
    setProjectForm({ name: p.name, description: p.description || '', deadline: p.deadline || '' });
    setShowProjectModal(true);
  };

  const saveProject = async () => {
    if (!projectForm.name.trim()) return;
    setSaving(true);
    try {
      if (editingProject) await projectsApi.updateProject(shopId!, editingProject.id, projectForm);
      else await projectsApi.createProject(shopId!, projectForm);
      setShowProjectModal(false); load();
    } catch {} finally { setSaving(false); }
  };

  const delProject = async (p: any) => {
    if (!confirm(`Delete project "${p.name}"?`)) return;
    try { await projectsApi.deleteProject(shopId!, p.id); load(); } catch {}
  };

  const openNewTask = (pid: number) => {
    setEditingTask(null);
    setShowTaskModal(pid);
    setTaskForm({ title: '', description: '', stage: 'todo', priority: 'normal', assigned_to: '', due_date: '' });
  };

  const saveTask = async () => {
    const pid = showTaskModal!;
    if (!taskForm.title.trim()) return;
    setSaving(true);
    try {
      if (editingTask) await projectsApi.updateTask(shopId!, editingTask.id, taskForm);
      else await projectsApi.createTask(shopId!, pid, taskForm);
      setShowTaskModal(null); loadTasks(pid);
    } catch {} finally { setSaving(false); }
  };

  const updateTaskStage = async (pid: number, tid: number, stage: string) => {
    try { await projectsApi.updateTask(shopId!, tid, { stage }); loadTasks(pid); } catch {}
  };

  const delTask = async (pid: number, tid: number) => {
    try { await projectsApi.deleteTask(shopId!, tid); loadTasks(pid); } catch {}
  };

  const pfld = (k: string, v: any) => setProjectForm((f: any) => ({ ...f, [k]: v }));
  const tfld = (k: string, v: any) => setTaskForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your projects and task boards</p>
        </div>
        <button onClick={openNewProject} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Projects', value: projects.length },
          { label: 'In Progress', value: projects.filter(p => p.status === 'in_progress').length },
          { label: 'Completed', value: projects.filter(p => p.status === 'completed').length },
          { label: 'Total Tasks', value: projects.reduce((s, p) => s + p.task_count, 0) },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        : projects.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <FolderOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No projects yet. Create your first project.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(p => {
              const progress = p.task_count > 0 ? Math.round((p.done_count / p.task_count) * 100) : 0;
              return (
                <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{p.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[p.status]}`}>{p.status?.replace('_', ' ')}</span>
                          {p.deadline && <span className="text-xs text-gray-400">Due: {p.deadline}</span>}
                        </div>
                        {p.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{p.description}</p>}
                        {p.task_count > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{p.done_count}/{p.task_count}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openNewTask(p.id)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Add Task">
                          <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEditProject(p)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => delProject(p)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                        <button onClick={() => toggleExpand(p.id)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                          {expanded === p.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  {expanded === p.id && (
                    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tasks</h4>
                        <button onClick={() => openNewTask(p.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Task</button>
                      </div>
                      {(tasks[p.id] || []).length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 py-2">No tasks yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(tasks[p.id] || []).map((t: any) => (
                            <div key={t.id} className="flex items-center gap-2 py-1.5 group">
                              <select value={t.stage} onChange={e => updateTaskStage(p.id, t.id, e.target.value)}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${STAGE_COLORS[t.stage]}`}>
                                {TASK_STAGES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                              </select>
                              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{t.title}</span>
                              {t.assigned_to && <span className="text-xs text-gray-400">{t.assigned_to}</span>}
                              <span className={`text-xs font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                              {t.due_date && <span className="text-xs text-gray-400">{t.due_date}</span>}
                              <button onClick={() => delTask(p.id, t.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingProject ? 'Edit Project' : 'New Project'}</h2>
              <button onClick={() => setShowProjectModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name *</label>
                <input value={projectForm.name} onChange={e => pfld('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Website Redesign" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={projectForm.description} onChange={e => pfld('description', e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deadline</label>
                <input type="date" value={projectForm.deadline} onChange={e => pfld('deadline', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              {editingProject && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select value={projectForm.status || editingProject.status} onChange={e => pfld('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                    {PROJECT_STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={saveProject} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Task</h2>
              <button onClick={() => setShowTaskModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Title *</label>
                <input value={taskForm.title} onChange={e => tfld('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Design mockups" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stage</label>
                  <select value={taskForm.stage} onChange={e => tfld('stage', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                    {TASK_STAGES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select value={taskForm.priority} onChange={e => tfld('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned To</label>
                  <input value={taskForm.assigned_to} onChange={e => tfld('assigned_to', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="Team member" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                  <input type="date" value={taskForm.due_date} onChange={e => tfld('due_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowTaskModal(null)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={saveTask} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Add Task'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
