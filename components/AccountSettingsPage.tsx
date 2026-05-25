import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { apiJson, apiFetch } from '../services/api';

interface AccountSettingsPageProps {
  userEmail?: string;
  lang?: 'en' | 'ar';
  section?: 'all' | 'password' | 'tokens' | 'export' | 'delete';
}

interface PersonalAccessToken {
  id: string;
  name: string;
  lastUsedAt?: string | null;
  createdAt: string;
}

interface CreateTokenResponse {
  id: string;
  name: string;
  token: string; // plaintext, shown once
}

/**
 * AccountSettingsPage
 *
 * Four sub-sections: password change, personal access tokens, data export,
 * and account deletion. Renders all of them by default, or just one if
 * `section` is provided (used by ProfileSettingsModal tabs).
 */
export const AccountSettingsPage: React.FC<AccountSettingsPageProps> = ({
  userEmail,
  lang = 'en',
  section = 'all',
}) => {
  const isRTL = lang === 'ar';

  // Password change
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // Tokens
  const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [revealedToken, setRevealedToken] = useState<CreateTokenResponse | null>(null);
  const [revealCopied, setRevealCopied] = useState(false);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);

  // Delete account
  const [emailConfirm, setEmailConfirm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Export
  const [exporting, setExporting] = useState(false);

  const loadTokens = async () => {
    setTokensLoading(true);
    try {
      const data = await apiJson<PersonalAccessToken[]>('/api/auth/tokens');
      setTokens(Array.isArray(data) ? data : []);
    } catch {
      /* swallow */
    } finally {
      setTokensLoading(false);
    }
  };

  useEffect(() => {
    if (section === 'all' || section === 'tokens') {
      loadTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== confirmPwd) {
      setPwdMsg({
        kind: 'error',
        text: lang === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'New passwords do not match',
      });
      return;
    }
    setPwdSubmitting(true);
    try {
      await apiJson('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      setPwdMsg({ kind: 'success', text: lang === 'ar' ? 'تم تحديث كلمة المرور.' : 'Password updated.' });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err: any) {
      setPwdMsg({
        kind: 'error',
        text: err?.body?.error || err?.message || (lang === 'ar' ? 'فشل التحديث' : 'Update failed'),
      });
    } finally {
      setPwdSubmitting(false);
    }
  };

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) return;
    setCreatingToken(true);
    try {
      const res = await apiJson<CreateTokenResponse>('/api/auth/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.trim() }),
      });
      setRevealedToken(res);
      setNewTokenName('');
      loadTokens();
    } catch {
      /* swallow */
    } finally {
      setCreatingToken(false);
    }
  };

  const handleRevokeToken = async () => {
    if (!pendingRevokeId) return;
    try {
      await apiJson(`/api/auth/tokens/${pendingRevokeId}`, { method: 'DELETE' });
      setTokens((prev) => prev.filter((t) => t.id !== pendingRevokeId));
    } finally {
      setPendingRevokeId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await apiFetch('/api/data-export/my-data');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cadence-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      /* swallow */
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiJson('/api/data-export/account', { method: 'DELETE' });
      localStorage.clear();
      window.location.href = '/';
    } catch (err: any) {
      setDeleteError(err?.body?.error || err?.message || (lang === 'ar' ? 'فشل الحذف' : 'Delete failed'));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const showAll = section === 'all';

  const labels = {
    sectionPwd: lang === 'ar' ? 'تغيير كلمة المرور' : 'Change password',
    current: lang === 'ar' ? 'كلمة المرور الحالية' : 'Current password',
    newPwd: lang === 'ar' ? 'كلمة المرور الجديدة' : 'New password',
    confirm: lang === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password',
    updatePwd: lang === 'ar' ? 'تحديث' : 'Update',
    tokens: lang === 'ar' ? 'رموز الوصول الشخصية' : 'Personal access tokens',
    tokensHint:
      lang === 'ar'
        ? 'استخدم هذه الرموز للوصول إلى Cadence عبر الأدوات الخارجية. تُعرض القيمة مرة واحدة فقط.'
        : 'Use these tokens to access Cadence from external tools. The token value is shown once only.',
    tokenName: lang === 'ar' ? 'اسم الرمز' : 'Token name',
    create: lang === 'ar' ? 'إنشاء رمز' : 'Create token',
    revoke: lang === 'ar' ? 'إلغاء' : 'Revoke',
    noTokens: lang === 'ar' ? 'لا توجد رموز نشطة' : 'No active tokens',
    lastUsed: lang === 'ar' ? 'آخر استخدام' : 'Last used',
    never: lang === 'ar' ? 'لم يُستخدم' : 'Never',
    export: lang === 'ar' ? 'تصدير البيانات' : 'Export your data',
    exportHint:
      lang === 'ar'
        ? 'قم بتنزيل نسخة JSON من جميع بياناتك في Cadence.'
        : 'Download a JSON copy of all your data in Cadence.',
    exportBtn: lang === 'ar' ? 'تنزيل JSON' : 'Download JSON',
    danger: lang === 'ar' ? 'حذف الحساب' : 'Delete account',
    dangerHint:
      lang === 'ar'
        ? 'حذف حسابك يزيل بياناتك نهائياً. اكتب بريدك الإلكتروني للتأكيد.'
        : 'Deleting your account permanently removes your data. Type your email to confirm.',
    deleteBtn: lang === 'ar' ? 'حذف حسابي' : 'Delete my account',
    typeEmail: lang === 'ar' ? 'اكتب بريدك الإلكتروني' : 'Type your email',
    confirmTitle: lang === 'ar' ? 'تأكيد الحذف' : 'Confirm deletion',
    confirmMsg:
      lang === 'ar'
        ? 'لا يمكن التراجع عن هذا الإجراء. سيتم حذف جميع بياناتك.'
        : 'This cannot be undone. All your data will be deleted.',
    yes: lang === 'ar' ? 'نعم، احذف' : 'Yes, delete',
    no: lang === 'ar' ? 'إلغاء' : 'Cancel',
    copyToken: lang === 'ar' ? 'نسخ' : 'Copy',
    copiedToken: lang === 'ar' ? 'تم النسخ!' : 'Copied!',
    saveOnce: lang === 'ar' ? 'احفظ هذا الرمز الآن — لن يُعرض مرة أخرى.' : 'Save this token now — it will not be shown again.',
  };

  return (
    <div className="space-y-10" dir={isRTL ? 'rtl' : 'ltr'}>
      {(showAll || section === 'password') && (
        <section>
          <h3 className="text-lg font-bold text-charcoal mb-4">{labels.sectionPwd}</h3>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {labels.current}
              </label>
              <input
                type="password"
                required
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {labels.newPwd}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {labels.confirm}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
              />
            </div>
            {pwdMsg && (
              <div
                className={`text-xs font-bold p-3 rounded-r border-l-2 ${
                  pwdMsg.kind === 'success' ? 'border-palm text-palm bg-palm/5' : 'border-salmon text-salmon bg-salmon/5'
                }`}
              >
                {pwdMsg.text}
              </div>
            )}
            <Button type="submit" loading={pwdSubmitting}>
              {labels.updatePwd}
            </Button>
          </form>
        </section>
      )}

      {(showAll || section === 'tokens') && (
        <section>
          <h3 className="text-lg font-bold text-charcoal mb-2">{labels.tokens}</h3>
          <p className="text-xs text-gray-500 mb-4">{labels.tokensHint}</p>

          <div className="flex gap-2 mb-6 max-w-md">
            <input
              type="text"
              placeholder={labels.tokenName}
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#8A1538] focus:ring-1 focus:ring-[#8A1538] outline-none"
            />
            <Button onClick={handleCreateToken} loading={creatingToken} disabled={!newTokenName.trim()}>
              {labels.create}
            </Button>
          </div>

          {tokensLoading ? (
            <div className="h-16 bg-gray-50 rounded-lg animate-pulse" />
          ) : tokens.length === 0 ? (
            <p className="text-sm text-gray-400 italic">{labels.noTokens}</p>
          ) : (
            <div className="space-y-2">
              {tokens.map((tok) => (
                <div
                  key={tok.id}
                  className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm"
                >
                  <div>
                    <p className="text-sm font-bold text-charcoal">{tok.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {labels.lastUsed}: {tok.lastUsedAt ? new Date(tok.lastUsedAt).toLocaleString() : labels.never} · {new Date(tok.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setPendingRevokeId(tok.id)}
                    className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider transition-colors"
                  >
                    {labels.revoke}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {(showAll || section === 'export') && (
        <section>
          <h3 className="text-lg font-bold text-charcoal mb-2">{labels.export}</h3>
          <p className="text-xs text-gray-500 mb-4">{labels.exportHint}</p>
          <Button variant="secondary" onClick={handleExport} loading={exporting}>
            {labels.exportBtn}
          </Button>
        </section>
      )}

      {(showAll || section === 'delete') && (
        <section className="border border-salmon/20 bg-salmon/5 rounded-xl p-6">
          <h3 className="text-lg font-bold text-salmon mb-2">{labels.danger}</h3>
          <p className="text-xs text-gray-600 mb-4">{labels.dangerHint}</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center max-w-lg">
            <input
              type="email"
              placeholder={userEmail || labels.typeEmail}
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              className="flex-1 bg-white border border-salmon/30 rounded-lg px-3 py-2 text-sm focus:border-salmon focus:ring-1 focus:ring-salmon outline-none"
            />
            <Button
              variant="danger"
              disabled={!userEmail || emailConfirm.trim().toLowerCase() !== userEmail.toLowerCase()}
              onClick={() => setShowDeleteConfirm(true)}
            >
              {labels.deleteBtn}
            </Button>
          </div>
          {deleteError && (
            <div className="mt-3 text-xs font-bold text-salmon">{deleteError}</div>
          )}
        </section>
      )}

      {/* Reveal-once token modal */}
      {revealedToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setRevealedToken(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
            <h3 className="text-xl font-display font-bold text-charcoal mb-2">{revealedToken.name}</h3>
            <p className="text-xs text-salmon font-bold mb-4">{labels.saveOnce}</p>
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 text-xs font-mono p-4 rounded-lg overflow-x-auto break-all whitespace-pre-wrap" dir="ltr">
                {revealedToken.token}
              </pre>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(revealedToken.token);
                    setRevealCopied(true);
                    setTimeout(() => setRevealCopied(false), 1500);
                  } catch {
                    /* swallow */
                  }
                }}
                className="absolute top-2 right-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider rounded"
              >
                {revealCopied ? labels.copiedToken : labels.copyToken}
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setRevealedToken(null)}>
                {lang === 'ar' ? 'تم' : 'Done'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingRevokeId}
        onClose={() => setPendingRevokeId(null)}
        onConfirm={handleRevokeToken}
        title={lang === 'ar' ? 'إلغاء الرمز' : 'Revoke token'}
        message={lang === 'ar' ? 'لن يعمل هذا الرمز بعد الآن.' : 'This token will stop working immediately.'}
        confirmLabel={labels.revoke}
        cancelLabel={labels.no}
        isRTL={isRTL}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title={labels.confirmTitle}
        message={labels.confirmMsg + (deleting ? '...' : '')}
        confirmLabel={labels.yes}
        cancelLabel={labels.no}
        isRTL={isRTL}
      />
    </div>
  );
};

export default AccountSettingsPage;
