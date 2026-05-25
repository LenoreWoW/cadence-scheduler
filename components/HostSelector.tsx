import React, { useState, useMemo } from 'react';
import { User, Language, Team } from '../types';
import { Button } from './Button';

interface HostSelectorProps {
  hosts: User[];
  teams: Team[];
  selectedHost: User | null;
  onSelectHost: (host: User) => void;
  t: (key: string) => string;
  lang: Language;
  currentUser?: User | null; // Added current user for filtering
}

export const HostSelector: React.FC<HostSelectorProps> = ({
  hosts,
  teams,
  selectedHost,
  onSelectHost,
  t,
  lang,
  currentUser
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Filter teams based on user role
  const visibleTeams = useMemo(() => {
    if (!currentUser) return teams; // Should not happen if logged in
    
    // Admins and Guests see all teams
    if (currentUser.role === 'admin' || currentUser.role === 'guest') {
       return teams;
    }
    
    // Managers and Subordinates only see their own team
    if (currentUser.teamId) {
       return teams.filter(t => t.id === currentUser.teamId);
    }
    
    // Fallback if user has no team assigned
    return teams;
  }, [teams, currentUser]);

  const displayedHosts = useMemo(() => {
    if (!selectedTeamId) return [];
    return hosts.filter(h => h.teamId === selectedTeamId);
  }, [hosts, selectedTeamId]);

  const isInternal = currentUser && (currentUser.role === 'manager' || currentUser.role === 'subordinate' || currentUser.role === 'admin');

  return (
    <div className="min-h-[50vh] md:min-h-[60vh] flex flex-col justify-center">
      {!selectedTeamId ? (
         <div className="space-y-6 md:space-y-12 animate-fade-in">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-medium text-center text-charcoal dark:text-white">{t('ourTeam')}</h2>
            
            {/* Mobile: Horizontal Scroll | Desktop: Grid */}
            <div className="md:hidden -mx-4 px-4">
              <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar scroll-smooth-mobile">
                {/* My Calendar Option for Internal Users - Mobile */}
                {isInternal && (
                  <button 
                    onClick={() => onSelectHost(currentUser)}
                    className="group flex-shrink-0 w-[200px] h-[140px] relative overflow-hidden rounded-xl shadow-md active:scale-95 transition-transform"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-al-adaam to-dark-purple"></div>
                    <div className="absolute inset-0 flex flex-col justify-end p-4 z-10">
                      <span className="text-[9px] font-mono font-bold text-white/70 uppercase tracking-widest mb-1">Personal</span>
                      <h3 className="text-lg font-serif text-white leading-tight">My Calendar</h3>
                      <span className="text-white/80 text-[10px] font-medium mt-1 flex items-center gap-1">
                        Manage / Book Me
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </span>
                    </div>
                  </button>
                )}
                
                {visibleTeams.map((team, index) => (
                  <button 
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className="group flex-shrink-0 w-[200px] h-[140px] relative overflow-hidden rounded-xl shadow-md active:scale-95 transition-transform"
                  >
                    <div className="absolute inset-0">
                      <img 
                        src={team.image || `https://source.unsplash.com/random/400x300?office,${team.name}`} 
                        alt={team.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                    </div>
                    <div className="absolute inset-0 flex flex-col justify-end p-4 z-10">
                      <span className="text-[9px] font-mono font-bold text-white/70 uppercase tracking-widest mb-1">Department</span>
                      <h3 className="text-lg font-serif text-white leading-tight">{team.name}</h3>
                      <span className="text-white/80 text-[10px] font-medium mt-1 flex items-center gap-1">
                        View Members
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Desktop Grid */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
                 {/* My Calendar Option for Internal Users */}
                 {isInternal && (
                   <button 
                     onClick={() => onSelectHost(currentUser)}
                     className="group relative h-[320px] lg:h-[400px] overflow-hidden rounded-2xl shadow-lg transition-all duration-500 hover:shadow-2xl border border-dune/20"
                   >
                     {/* Self Avatar or default image */}
                     <div className="absolute inset-0 bg-gradient-to-br from-al-adaam to-dark-purple group-hover:scale-105 transition-transform duration-700"></div>
                     <div className="absolute inset-0 flex items-center justify-center opacity-20">
                        <img 
                           src={currentUser.avatar || "https://ui-avatars.com/api/?name=" + currentUser.name}
                           className="w-48 h-48 rounded-full mix-blend-overlay filter blur-sm"
                           alt=""
                        />
                     </div>

                     <div className="absolute bottom-0 left-0 p-6 lg:p-8 text-left w-full z-10">
                        <span className="text-xs font-mono font-bold text-white/70 uppercase tracking-widest mb-2 block border-l-2 border-white/50 pl-3">Personal</span>
                        <h3 className="text-xl lg:text-2xl font-serif text-white mb-2 leading-tight">My Calendar</h3>
                        <div className="flex items-center gap-2 opacity-100 transform translate-y-0 transition-all duration-500 group-hover:translate-x-2">
                           <span className="text-white text-xs font-bold uppercase tracking-widest">Manage / Book Me</span>
                           <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </div>
                     </div>
                   </button>
                 )}

                 {visibleTeams.length === 0 && !isInternal && (
                    <div className="col-span-full text-center text-dune font-mono mt-12">
                       No teams available for your view.
                    </div>
                 )}

                 {visibleTeams.map((team, index) => (
                   <button 
                     key={team.id}
                     onClick={() => setSelectedTeamId(team.id)}
                     className="group relative h-[320px] lg:h-[400px] overflow-hidden rounded-2xl shadow-md transition-all duration-500 hover:shadow-2xl"
                   >
                     {/* Image Background with Scale Animation */}
                     <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-110">
                        <img 
                          src={team.image || `https://source.unsplash.com/random/800x600?office,${team.name}`} 
                          alt={team.name}
                          className="w-full h-full object-cover"
                        />
                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                     </div>

                     <div className="absolute bottom-0 left-0 p-6 lg:p-8 text-left w-full z-10">
                        <span className="text-xs font-mono font-bold text-white/70 uppercase tracking-widest mb-2 block pl-1">Department</span>
                        <h3 className="text-2xl lg:text-3xl font-serif text-white mb-2 leading-tight shadow-black drop-shadow-md">{team.name}</h3>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-100">
                           <span className="text-white text-xs font-bold uppercase tracking-widest">View Members</span>
                           <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H7" /></svg>
                        </div>
                     </div>
                   </button>
                 ))}
              </div>
         </div>
      ) : (
         <div className="space-y-6 md:space-y-12">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 animate-fade-in">
               <Button variant="ghost" onClick={() => setSelectedTeamId(null)} className="pl-0 hover:pl-2 transition-all self-start">
                 <span className="text-lg rtl:rotate-180">←</span> Back
               </Button>
               <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-medium text-charcoal dark:text-white sm:border-l sm:border-dune sm:pl-6">{teams.find(t => t.id === selectedTeamId)?.name}</h2>
            </div>
            
            {/* Mobile: 2-column compact grid | Desktop: 4-column */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 lg:gap-8">
               {displayedHosts.map((host, idx) => (
                 <button
                   key={host.id}
                   onClick={() => onSelectHost(host)}
                   className="group text-left animate-slide-up bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl p-4 md:p-6 border border-gray-100 dark:border-gray-700 hover:border-al-adaam hover:shadow-xl active:scale-[0.98] transition-all duration-300"
                   style={{ animationDelay: `${idx * 50}ms` }}
                 >
                   <div className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-3 md:mb-6 relative">
                      <img 
                        src={host.avatar || `https://ui-avatars.com/api/?name=${host.name}`} 
                        className="w-full h-full object-cover rounded-full border-2 border-gray-100 dark:border-gray-700 group-hover:border-al-adaam transition-colors duration-300"
                        alt={host.name} 
                      />
                   </div>
                   <div className="text-center">
                     <h3 className="text-sm md:text-xl font-medium text-charcoal dark:text-white group-hover:text-al-adaam transition-colors line-clamp-1">{host.name}</h3>
                     <p className="text-[10px] md:text-sm font-mono text-dune uppercase tracking-wider md:tracking-widest mt-1 md:mt-2 line-clamp-1">{host.title || host.role}</p>
                     
                     {/* Mobile: Always visible | Desktop: Hover */}
                     <div className="mt-3 md:mt-6 md:opacity-0 md:group-hover:opacity-100 md:transform md:translate-y-2 md:group-hover:translate-y-0 transition-all duration-300">
                        <span className="inline-block bg-charcoal dark:bg-white text-white dark:text-charcoal px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Book</span>
                     </div>
                   </div>
                 </button>
               ))}
            </div>
         </div>
      )}
    </div>
  );
};