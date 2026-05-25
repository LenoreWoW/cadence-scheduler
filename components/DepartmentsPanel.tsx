import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { apiJson } from '../services/api';

interface Department {
  id: string;
  name: string;
  parentId?: string | null;
  description?: string | null;
}

interface DepartmentsPanelProps {
  lang?: 'en' | 'ar';
}

/**
 * DepartmentsPanel
 *
 * Admin CRUD for departments with parent_id hierarchy. Lists departments
 * tree-style, indenting children under their parent.
 */
export const DepartmentsPanel: React.FC<DepartmentsPanelProps> = ({ lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', parentId: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<Department[]>('/api/departments');
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Build a tree-ordered list (BFS by parent)
  const tree = useMemo(() => {
    const byParent = new Map<string | null, Department[]>();
    for (const d of departments) {
      const key = d.parentId || null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(d);
    }
    const ordered: Array<{ dept: Department; depth: number }> = [];
    const walk = (parent: string | null, depth: number) => {
      const children = byParent.get(parent) || [];
      for (const c of children.sort((a, b) => a.name.localeCompare(b.name))) {
        ordered.push({ dept: c, depth });
        walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    return ordered;
  }, [departments]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', parentId: '', description: '' });
    setShowForm(true);
    setError(null);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({ name: d.name, parentId: d.parentId || '', description: d.description || '' });
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        parentId: form.parentId || null,
        description: form.description.trim() || null,
      };
      if (editing) {
        await apiJson(`/api/departments/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await apiJson('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || (lang === 'ar' ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await apiJson(`/api/departments/${pendingDelete}`, { method: 'DELETE' });
      setDepartments((prev) => prev.filter((d) => d.id !== pendingDelete));
    } finally {
      setPendingDelete(null);
    }
  };

  const labels = {
    title: lang === 'ar' ? 'الأقسام' : 'Departments',
    addBtn: lang === 'ar' ? '+ قسم جديد' : '+ New department',
    name: lang === 'ar' ? 'الاسم' : 'Name',
    parent: lang === 'ar' ? 'القسم الأم' : 'Parent department',
    none: lang === 'ar' ? '— لا يوجد —' : '— None —',
    description: lang === 'ar' ? 'الوصف' : 'Description',
    save: lang === 'ar' ? 'حفظ' : 'Save',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
    edit: lang === 'ar' ? 'تعديل' : 'Edit',
    delete: lang === 'ar' ? 'حذف' : 'Delete',
    empty: lang === 'ar' ? 'لا توجد أقسام بعد. أنشئ قسمك الأول.' : 'No departments yet. Create your first.',
    confirmDelete: lang === 'ar' ? 'حذف هذا القسم؟' : 'Delete this department?',
    confirmDeleteMsg: lang === 'ar' ? 'سيتم إلغاء ربط الأعضاء.' : 'Members will be unlinked.',
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-charcoal">{labels.title}</h3>
        <Button onClick={openCreate}>{labels.addBtn}</Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">{labels.empty}</p>
      ) : (
        <div className="space-y-1">
          {tree.map(({ dept, depth }) => (
            <div
              key={dept.id}
              className="flex justify-between items-center px-3 py-2.5 rounded-lg hover:bg-gray-50 group"
              style={{ paddingInlineStart: 12 + depth * 24 }}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-charcoal truncate">
                  {depth > 0 && <span className="text-gray-300 mr-2 rtl:ml-2">└</span>}
                  {dept.name}
                </p>
                {dept.description && <p className="text-[11px] text-gray-500 truncate">{dept.description}</p>}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => openEdit(dept)}
                  className="text-xs font-bold text-[#8A1538] hover:text-[#5f0e26] uppercase tracking-wider"
                >
                  {labels.edit}
                </button>
                <button
                  onClick={() => setPendingDelete(dept.id)}
                  className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                >
                  {labels.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-xl font-display font-bold text-charcoal mb-6">
              {editing ? labels.edit : labels.addBtn}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  {labels.name}
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  {labels.parent}
                </label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
                >
                  <option value="">{labels.none}</option>
                  {departments
                    .filter((d) => d.id !== editing?.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  {labels.description}
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none resize-none"
                />
              </div>
              {error && (
                <div className="text-salmon text-xs font-bold p-3 bg-salmon/5 border-l-2 border-salmon rounded-r">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  {labels.cancel}
                </Button>
                <Button type="submit" loading={submitting}>
                  {labels.save}
                </Button>
              </div>
            </form>
          </div>
        </div>
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

export default DepartmentsPanel;
