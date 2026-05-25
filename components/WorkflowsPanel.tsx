import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { apiJson } from '../services/api';
import { WorkflowBuilder, Workflow } from './WorkflowBuilder';

interface WorkflowsPanelProps {
  lang?: 'en' | 'ar';
  teamId?: string;
  scope?: 'user' | 'team';
}

/**
 * WorkflowsPanel
 *
 * Lists user (or team) workflows. Inline toggle for active, edit/delete,
 * "Create" opens WorkflowBuilder.
 */
export const WorkflowsPanel: React.FC<WorkflowsPanelProps> = ({
  lang = 'en',
  teamId,
  scope = 'user',
}) => {
  const isRTL = lang === 'ar';
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const qs = scope === 'team' && teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
      const data = await apiJson<Workflow[]>(`/api/workflows${qs}`);
      setWorkflows(Array.isArray(data) ? data : []);
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, scope]);

  const handleToggleActive = async (w: Workflow) => {
    if (!w.id) return;
    try {
      await apiJson(`/api/workflows/${w.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...w, active: !w.active }),
      });
      setWorkflows((ws) => ws.map((x) => (x.id === w.id ? { ...x, active: !x.active } : x)));
    } catch {
      /* swallow */
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await apiJson(`/api/workflows/${pendingDelete}`, { method: 'DELETE' });
      setWorkflows((ws) => ws.filter((x) => x.id !== pendingDelete));
    } finally {
      setPendingDelete(null);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'سير العمل' : 'Workflows',
    subtitle:
      lang === 'ar'
        ? 'الأتمتة على أحداث الحجز.'
        : 'Automation on booking events.',
    create: lang === 'ar' ? '+ سير عمل جديد' : '+ New workflow',
    none: lang === 'ar' ? 'لا توجد سير عمل بعد.' : 'No workflows yet.',
    edit: lang === 'ar' ? 'تعديل' : 'Edit',
    delete: lang === 'ar' ? 'حذف' : 'Delete',
    confirmDelete: lang === 'ar' ? 'حذف سير العمل؟' : 'Delete this workflow?',
    confirmDeleteMsg:
      lang === 'ar' ? 'لن يتم تنفيذه بعد ذلك.' : 'It will no longer run.',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
    actions: lang === 'ar' ? 'إجراءات' : 'actions',
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-charcoal">{labels.title}</h3>
          <p className="text-xs text-gray-500 mt-1">{labels.subtitle}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setBuilderOpen(true);
          }}
        >
          {labels.create}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">{labels.none}</p>
      ) : (
        <div className="space-y-3">
          {workflows.map((w) => (
            <div key={w.id} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-charcoal truncate">{w.name}</p>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                      {w.triggerType}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {(w.actions || []).length} {labels.actions}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!w.active}
                      onChange={() => handleToggleActive(w)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8A1538]"></div>
                  </label>
                  <button
                    onClick={() => {
                      setEditing(w);
                      setBuilderOpen(true);
                    }}
                    className="text-xs font-bold text-[#8A1538] hover:text-[#5f0e26] uppercase tracking-wider"
                  >
                    {labels.edit}
                  </button>
                  <button
                    onClick={() => setPendingDelete(w.id!)}
                    className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                  >
                    {labels.delete}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {builderOpen && (
        <WorkflowBuilder
          workflow={editing || undefined}
          scope={scope}
          teamId={teamId}
          lang={lang}
          onClose={() => setBuilderOpen(false)}
          onSave={() => {
            setBuilderOpen(false);
            load();
          }}
        />
      )}

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={labels.confirmDelete}
        message={labels.confirmDeleteMsg}
        confirmLabel={labels.delete}
        cancelLabel={labels.cancel}
        isRTL={isRTL}
      />
    </div>
  );
};

export default WorkflowsPanel;
