import React, { useEffect, useRef, useState } from 'react';
import { apiJson, apiFetch } from '../services/api';

interface Attachment {
  id: string;
  filename: string;
  size: number;
  uploaderId?: string;
  uploaderName?: string;
  createdAt: string;
  contentType?: string;
}

interface MeetingAttachmentsPanelProps {
  meetingId: string;
  currentUserId?: string;
  lang?: 'en' | 'ar';
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

/**
 * MeetingAttachmentsPanel
 *
 * Lists, uploads, downloads, and deletes attachments on a meeting.
 * Client-side cap of 5 MB; uploads use base64 over JSON to match the rest
 * of the API.
 */
export const MeetingAttachmentsPanel: React.FC<MeetingAttachmentsPanelProps> = ({ meetingId, currentUserId, lang = 'en' }) => {
  const isRTL = lang === 'ar';
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<Attachment[]>(`/api/meetings/${meetingId}/attachments`);
      setAttachments(Array.isArray(data) ? data : []);
    } catch {
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (meetingId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(lang === 'ar' ? 'الحد الأقصى 5 ميغابايت.' : 'Files must be 5 MB or smaller.');
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // result is "data:<contentType>;base64,<data>"
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await apiJson(`/api/meetings/${meetingId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          data: base64,
        }),
      });
      load();
    } catch (err: any) {
      setError(err?.body?.error || err?.message || (lang === 'ar' ? 'فشل التحميل' : 'Upload failed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (att: Attachment) => {
    try {
      const res = await apiFetch(`/api/meetings/${meetingId}/attachments/${att.id}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      /* swallow */
    }
  };

  const handleDelete = async (att: Attachment) => {
    if (!window.confirm(lang === 'ar' ? 'حذف هذا المرفق؟' : 'Delete this attachment?')) return;
    try {
      await apiJson(`/api/meetings/${meetingId}/attachments/${att.id}`, { method: 'DELETE' });
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    } catch {
      /* swallow */
    }
  };

  const labels = {
    title: lang === 'ar' ? 'المرفقات' : 'Attachments',
    upload: lang === 'ar' ? 'تحميل ملف' : 'Upload file',
    uploading: lang === 'ar' ? 'جارٍ التحميل...' : 'Uploading...',
    none: lang === 'ar' ? 'لا توجد مرفقات بعد.' : 'No attachments yet.',
    download: lang === 'ar' ? 'تحميل' : 'Download',
    delete: lang === 'ar' ? 'حذف' : 'Delete',
    limit: lang === 'ar' ? 'الحد الأقصى 5 ميغابايت' : '5 MB limit',
  };

  return (
    <div className="border-t border-gray-100 pt-6 mt-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">{labels.title}</h4>
        <span className="text-[10px] font-mono text-gray-400">{labels.limit}</span>
      </div>

      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="hidden"
          id={`attach-${meetingId}`}
        />
        <label
          htmlFor={`attach-${meetingId}`}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-colors ${
            uploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#8A1538] text-white hover:bg-[#5f0e26]'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {uploading ? labels.uploading : labels.upload}
        </label>
      </div>

      {error && (
        <div className="mb-3 text-salmon text-xs font-bold p-2 bg-salmon/5 border-l-2 border-salmon rounded-r">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />
          <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-4">{labels.none}</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg"
            >
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-charcoal truncate">{att.filename}</p>
                  <p className="text-[10px] font-mono text-gray-400">
                    {formatSize(att.size)} · {att.uploaderName || '—'} · {new Date(att.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => handleDownload(att)}
                  className="text-xs font-bold text-[#8A1538] hover:text-[#5f0e26] uppercase tracking-wider"
                >
                  {labels.download}
                </button>
                {currentUserId && att.uploaderId === currentUserId && (
                  <button
                    onClick={() => handleDelete(att)}
                    className="text-xs font-bold text-salmon hover:text-red-700 uppercase tracking-wider"
                  >
                    {labels.delete}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MeetingAttachmentsPanel;
