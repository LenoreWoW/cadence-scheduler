
import React, { useState, useEffect } from 'react';
import { User, Team, Role, Language } from '../types';
import { Button } from './Button';
import { storageService } from '../services/storageService';
import { TeamInvitationsPanel } from './TeamInvitationsPanel';
import { DepartmentsPanel } from './DepartmentsPanel';
import { ResourcesPanel } from './ResourcesPanel';
import { ApprovalQueue } from './ApprovalQueue';
import { BulkUserImportModal } from './BulkUserImportModal';
import { WorkflowsPanel } from './WorkflowsPanel';

interface TeamManagementProps {
  t: (key: string) => string;
  lang: Language;
  currentUser?: User; // Current logged-in user for permission checks
}

// Extended Team interface with leader info
interface TeamWithLeader extends Team {
  leaderName?: string;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ t, lang, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'invitations' | 'departments' | 'resources' | 'approvals' | 'workflows'>('users');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<TeamWithLeader[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for managing members of a specific team
  const [selectedTeamForMembers, setSelectedTeamForMembers] = useState<TeamWithLeader | null>(null);

  // Permission helpers
  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager';
  const canCreateTeam = isAdmin || isManager;
  
  const canManageTeam = (team: TeamWithLeader): boolean => {
    if (isAdmin) return true;
    if (isManager && team.leaderId === currentUser?.id) return true;
    return false;
  };

  const canDeleteTeam = (team: TeamWithLeader): boolean => {
    // Only admins can delete teams
    return isAdmin;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const loadedUsers = storageService.getUsers();
    const loadedTeams = storageService.getTeams();
    
    // Enrich teams with leader names
    const enrichedTeams = loadedTeams.map(team => ({
      ...team,
      leaderName: team.leaderId ? loadedUsers.find(u => u.id === team.leaderId)?.name : undefined
    }));
    
    setUsers(loadedUsers);
    setTeams(enrichedTeams);
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTeams = teams.filter(tm => 
    tm.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteUser = (id: string) => {
    if (window.confirm(t('confirmDelete'))) {
      const updated = users.filter(u => u.id !== id);
      storageService.saveUsers(updated);
      setUsers(updated);
    }
  };

  const handleDeleteTeam = (id: string) => {
    if (window.confirm(t('confirmDelete'))) {
      const updated = teams.filter(tm => tm.id !== id);
      storageService.saveTeams(updated);
      setTeams(updated);
      const updatedUsers = users.map(u => u.teamId === id ? { ...u, teamId: undefined } : u);
      storageService.saveUsers(updatedUsers);
      setUsers(updatedUsers);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleManageMembers = (team: Team) => {
    setSelectedTeamForMembers(team);
    setIsMemberModalOpen(true);
  };

  const handleAddMemberToTeam = (userId: string) => {
    if (!selectedTeamForMembers) return;
    const updatedUsers = users.map(u => u.id === userId ? { ...u, teamId: selectedTeamForMembers.id } : u);
    storageService.saveUsers(updatedUsers);
    setUsers(updatedUsers);
  };

  const handleRemoveMemberFromTeam = (userId: string) => {
    const updatedUsers = users.map(u => u.id === userId ? { ...u, teamId: undefined } : u);
    storageService.saveUsers(updatedUsers);
    setUsers(updatedUsers);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    if (activeTab === 'users') {
      const newUser: User = {
        id: editingItem ? editingItem.id : Math.random().toString(36).substr(2, 9),
        username: formData.get('username') as string,
        name: formData.get('name') as string,
        role: formData.get('role') as Role,
        title: formData.get('title') as string,
        teamId: formData.get('teamId') as string,
        avatar: formData.get('avatar') as string
      };

      const updatedUsers = editingItem 
        ? users.map(u => u.id === newUser.id ? newUser : u)
        : [...users, newUser];
      
      storageService.saveUsers(updatedUsers);
      setUsers(updatedUsers);
    } else {
      const newTeam: TeamWithLeader = {
        id: editingItem ? editingItem.id : Math.random().toString(36).substr(2, 9),
        name: formData.get('name') as string,
        color: formData.get('color') as string,
        image: formData.get('image') as string,
        // Managers become leaders of teams they create
        leaderId: editingItem?.leaderId ?? (isManager ? currentUser?.id : undefined),
        leaderName: editingItem?.leaderName ?? (isManager ? currentUser?.name : undefined)
      };

      const updatedTeams = editingItem
        ? teams.map(tm => tm.id === newTeam.id ? { ...newTeam, leaderName: tm.leaderName } : tm)
        : [...teams, newTeam];
        
      storageService.saveTeams(updatedTeams);
      setTeams(updatedTeams);
    }
    
    setIsModalOpen(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-dune/20 overflow-hidden min-h-[600px] animate-fade-in">
       {/* Tab Header */}
       <div className="border-b border-gray-200">
          <nav className="flex flex-wrap space-x-4 sm:space-x-8 px-6 rtl:space-x-reverse" aria-label="Tabs">
            {([
              { id: 'users', label: t('users'), show: true },
              { id: 'teams', label: t('teams'), show: true },
              { id: 'invitations', label: lang === 'ar' ? 'الدعوات' : 'Invitations', show: isAdmin || isManager },
              { id: 'departments', label: lang === 'ar' ? 'الأقسام' : 'Departments', show: isAdmin },
              { id: 'resources', label: lang === 'ar' ? 'الموارد' : 'Resources', show: isAdmin || isManager },
              { id: 'approvals', label: lang === 'ar' ? 'الموافقات' : 'Approvals', show: isAdmin || isManager },
              { id: 'workflows', label: lang === 'ar' ? 'سير العمل' : 'Workflows', show: isAdmin || isManager },
            ] as const).map(tab => tab.show && (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setSearchQuery(''); }}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-300 ${
                  activeTab === tab.id
                    ? 'border-al-adaam text-al-adaam'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
       </div>

       <div className="p-6">
          {activeTab === 'invitations' ? (
             <TeamInvitationsPanel teamId={currentUser?.teamId} lang={lang} />
          ) : activeTab === 'departments' ? (
             <DepartmentsPanel lang={lang} />
          ) : activeTab === 'resources' ? (
             <ResourcesPanel lang={lang} teamId={currentUser?.teamId} />
          ) : activeTab === 'approvals' ? (
             <ApprovalQueue lang={lang} />
          ) : activeTab === 'workflows' ? (
             <WorkflowsPanel lang={lang} scope="team" teamId={currentUser?.teamId} />
          ) : (<>
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="relative w-full md:w-64">
               <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               <input
                 type="text"
                 placeholder={`Search ${activeTab}...`}
                 className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none transition-colors"
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
               />
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'users' && isAdmin && (
                <Button onClick={() => setShowBulkImport(true)} variant="secondary">
                   {lang === 'ar' ? 'استيراد CSV' : 'Bulk Import'}
                </Button>
              )}
              {(activeTab === 'users' ? isAdmin : canCreateTeam) && (
                <Button onClick={handleAddNew} variant="primary">
                   + {activeTab === 'users' ? t('addUser') : t('addTeam')}
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-100">
            {activeTab === 'users' ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('fullName')}</th>
                    <th className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('username')}</th>
                    <th className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('role')}</th>
                    <th className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('team')}</th>
                    <th className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <img className="h-10 w-10 rounded-full object-cover border border-gray-200" src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}`} alt="" />
                          </div>
                          <div className="ml-4 rtl:mr-4 rtl:ml-0">
                            <div className="text-sm font-medium text-gray-900">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.title}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{u.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full uppercase tracking-wide
                          ${u.role === 'admin' ? 'bg-al-adaam/10 text-al-adaam' : 
                            u.role === 'manager' ? 'bg-skyline/10 text-skyline' : 
                            u.role === 'subordinate' ? 'bg-palm/10 text-palm' : 'bg-gray-100 text-gray-800'}`}>
                          {t(`role${u.role.charAt(0).toUpperCase() + u.role.slice(1)}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {teams.find(t => t.id === u.teamId)?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button onClick={() => handleEdit(u)} className="text-al-adaam hover:text-charcoal mx-2 font-bold transition-colors">{t('edit')}</button>
                        <button onClick={() => handleDeleteUser(u.id)} className="text-salmon hover:text-red-900 mx-2 font-bold transition-colors">{t('delete')}</button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No users found matching "{searchQuery}"</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                 <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('team')}</th>
                    <th className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('leader') || 'Leader'}</th>
                    <th className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('members')}</th>
                    <th className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('colorHex')}</th>
                    <th className="px-6 py-4 text-left rtl:text-right text-xs font-bold text-dune uppercase tracking-wider">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTeams.map(tm => {
                    const teamMembers = users.filter(u => u.teamId === tm.id);
                    const canManage = canManageTeam(tm);
                    const canDelete = canDeleteTeam(tm);
                    const isMyTeam = tm.leaderId === currentUser?.id;
                    
                    return (
                      <tr key={tm.id} className={`hover:bg-gray-50 transition-colors ${isMyTeam ? 'bg-al-adaam/5' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{tm.name}</span>
                            {isMyTeam && (
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-al-adaam/10 text-al-adaam rounded-full">
                                {t('yourTeam') || 'Your Team'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {tm.leaderName || <span className="text-gray-400 italic">-</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                           <div className="flex -space-x-2 rtl:space-x-reverse overflow-hidden">
                             {teamMembers.slice(0, 5).map(m => (
                               <img key={m.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover" src={m.avatar || `https://ui-avatars.com/api/?name=${m.name}`} alt={m.name} title={m.name} />
                             ))}
                             {teamMembers.length > 5 && (
                               <span className="inline-flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 text-xs text-gray-500">+{teamMembers.length - 5}</span>
                             )}
                             {teamMembers.length === 0 && <span className="text-xs text-gray-400 italic">No members</span>}
                           </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                           <div className="flex items-center">
                             <div className="w-6 h-6 rounded border shadow-sm" style={{ backgroundColor: tm.color }}></div>
                             <span className="ml-2 rtl:mr-2 rtl:ml-0 text-xs font-mono text-gray-500">{tm.color}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {canManage && (
                            <>
                              <button onClick={() => handleManageMembers(tm)} className="text-skyline hover:text-blue-800 mx-2 font-bold text-xs uppercase tracking-wide border border-skyline px-3 py-1 rounded-md hover:bg-skyline hover:text-white transition-colors">Members</button>
                              <button onClick={() => handleEdit(tm)} className="text-al-adaam hover:text-charcoal mx-2 font-bold transition-colors">{t('edit')}</button>
                            </>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDeleteTeam(tm.id)} className="text-salmon hover:text-red-900 mx-2 font-bold transition-colors">{t('delete')}</button>
                          )}
                          {!canManage && !canDelete && (
                            <span className="text-gray-400 text-xs italic">{t('viewOnly') || 'View only'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                   {filteredTeams.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No teams found matching "{searchQuery}"</td></tr>}
                </tbody>
              </table>
            )}
          </div>
          </>)}
       </div>

       {/* Edit/Add Modal */}
       {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-xl text-left rtl:text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full p-8 animate-scale-in">
                <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6">
                  {editingItem ? t('edit') : (activeTab === 'users' ? t('addUser') : t('addTeam'))}
                </h3>
                <form onSubmit={handleSave} className="space-y-4">
                  
                  {activeTab === 'users' ? (
                    <>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">{t('fullName')}</label>
                        <input name="name" defaultValue={editingItem?.name} required className="block w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">{t('username')}</label>
                        <input name="username" defaultValue={editingItem?.username} required className="block w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">{t('role')}</label>
                        <select name="role" defaultValue={editingItem?.role || 'guest'} className="block w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none">
                          <option value="admin">{t('roleAdmin')}</option>
                          <option value="manager">{t('roleManager')}</option>
                          <option value="subordinate">{t('roleSubordinate')}</option>
                          <option value="guest">{t('roleGuest')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">{t('title')}</label>
                        <input name="title" defaultValue={editingItem?.title} className="block w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none" />
                      </div>
                       <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">{t('team')}</label>
                        <select name="teamId" defaultValue={editingItem?.teamId || ''} className="block w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none">
                          <option value="">- {t('none')} -</option>
                          {teams.map(tm => (
                            <option key={tm.id} value={tm.id}>{tm.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">{t('avatarUrl')}</label>
                        <input name="avatar" defaultValue={editingItem?.avatar} className="block w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">{t('team')}</label>
                        <input name="name" defaultValue={editingItem?.name} required className="block w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">{t('colorHex')}</label>
                        <div className="flex gap-2 items-center">
                           <input name="color" type="color" defaultValue={editingItem?.color || '#000000'} required className="block h-12 w-12 border border-gray-300 rounded-lg p-1 cursor-pointer" />
                           <span className="text-sm text-gray-500 font-mono">Select a brand color</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-dune mb-2">Cover Image URL</label>
                        <input name="image" defaultValue={editingItem?.image} className="block w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-al-adaam focus:ring-1 focus:ring-al-adaam outline-none" placeholder="https://..." />
                      </div>
                    </>
                  )}

                  <div className="mt-8 flex gap-3">
                    <Button type="submit" fullWidth>{t('save')}</Button>
                    <Button type="button" variant="secondary" fullWidth onClick={() => setIsModalOpen(false)}>{t('cancel')}</Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
       )}

       {/* Manage Members Modal */}
       {isMemberModalOpen && selectedTeamForMembers && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm transition-opacity" onClick={() => setIsMemberModalOpen(false)}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-xl text-left rtl:text-right overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full p-8 animate-scale-in">
                {/* ... (Same content as previous, logic is solid) ... */}
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-2xl font-serif font-bold text-gray-900">
                      Manage Members
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 font-mono uppercase tracking-widest">{selectedTeamForMembers.name}</p>
                  </div>
                  <button onClick={() => setIsMemberModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 h-96">
                   {/* Left: Current Members */}
                   <div className="border border-gray-200 rounded-lg flex flex-col overflow-hidden">
                      <div className="bg-gray-50 p-3 border-b border-gray-200 font-bold text-xs uppercase text-dune">
                         Current Members
                      </div>
                      <div className="overflow-y-auto flex-1 p-3 space-y-2 bg-gray-50/50">
                        {users.filter(u => u.teamId === selectedTeamForMembers.id).length === 0 && <p className="text-xs text-gray-400 p-2 italic">No members in this team.</p>}
                        {users.filter(u => u.teamId === selectedTeamForMembers.id).map(member => (
                           <div key={member.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-3">
                                <img src={member.avatar || `https://ui-avatars.com/api/?name=${member.name}`} className="w-8 h-8 rounded-full" alt="" />
                                <div>
                                  <p className="text-sm font-bold text-charcoal">{member.name}</p>
                                  <p className="text-[10px] text-gray-500 uppercase">{member.role}</p>
                                </div>
                              </div>
                              <button onClick={() => handleRemoveMemberFromTeam(member.id)} className="text-gray-400 hover:text-salmon p-1 rounded transition-colors">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                           </div>
                        ))}
                      </div>
                   </div>

                   {/* Right: Available Users */}
                   <div className="border border-gray-200 rounded-lg flex flex-col overflow-hidden">
                      <div className="bg-gray-50 p-3 border-b border-gray-200 font-bold text-xs uppercase text-dune">
                         Add Users
                      </div>
                      <div className="overflow-y-auto flex-1 p-3 space-y-2 bg-gray-50/50">
                         {users.filter(u => u.teamId !== selectedTeamForMembers.id && u.role !== 'guest').map(user => (
                           <div key={user.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-3">
                                <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} className="w-8 h-8 rounded-full" alt="" />
                                <div>
                                  <p className="text-sm font-bold text-charcoal">{user.name}</p>
                                  <p className="text-[10px] text-gray-500 uppercase">
                                     {user.teamId ? (teams.find(t => t.id === user.teamId)?.name || 'Other Team') : 'Unassigned'}
                                  </p>
                                </div>
                              </div>
                              <button onClick={() => handleAddMemberToTeam(user.id)} className="text-al-adaam hover:bg-al-adaam/10 w-8 h-8 flex items-center justify-center rounded-full font-bold text-lg leading-none transition-colors">
                                 +
                              </button>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>

                <div className="mt-6 flex justify-end">
                   <Button onClick={() => setIsMemberModalOpen(false)}>Done</Button>
                </div>
              </div>
            </div>
          </div>
       )}

       {/* Bulk import */}
       <BulkUserImportModal
         isOpen={showBulkImport}
         onClose={() => setShowBulkImport(false)}
         onImported={loadData}
         lang={lang}
       />
    </div>
  );
};
