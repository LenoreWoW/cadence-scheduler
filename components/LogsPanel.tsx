import React from 'react';
import { LogEntry } from '../types';

interface LogsPanelProps {
  logs: LogEntry[];
  t: (key: string) => string;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({ logs, t }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-dune/20 overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-2xl font-serif font-bold text-charcoal">{t('logsTitle')}</h2>
        <p className="text-sm text-gray-500 font-mono mt-1">{t('logsSubtitle')}</p>
      </div>
      
      <div className="flex-1 overflow-auto p-0">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th scope="col" className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('logTime')}</th>
              <th scope="col" className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('logUser')}</th>
              <th scope="col" className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('logAction')}</th>
              <th scope="col" className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('logDetails')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-400">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-charcoal">
                  {log.performedBy} <span className="text-xs font-normal text-gray-400">({log.role})</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold uppercase tracking-wider rounded-full 
                    ${log.action === 'CANCEL' ? 'bg-dune/10 text-dune' : 
                      log.action === 'BOOK' ? 'bg-palm/10 text-palm' : 
                      log.action === 'APPROVE' ? 'bg-palm/10 text-palm' :
                      log.action === 'REJECT' ? 'bg-salmon/10 text-salmon' :
                      log.action === 'LOGIN' ? 'bg-sea/10 text-sea' : 'bg-gray-100 text-gray-800'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs" title={log.details}>
                  {log.details}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
               <tr>
                 <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm italic font-mono">
                   {t('noLogs')}
                 </td>
               </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};