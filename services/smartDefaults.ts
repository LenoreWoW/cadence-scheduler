import { User, Meeting, TimeSlot, MeetingCategory } from '../types';

interface UserPattern {
  hostAffinity: Record<string, number>; // hostId -> score (frequency)
  durationPreference: Record<string, number>; // duration -> count
  timePreference: Record<string, number>; // hour -> count
  categoryPreference: Record<string, Record<string, number>>; // hostId -> category -> count
  titleHistory: TitleHistoryEntry[]; // Recent meeting titles for suggestions
  lastHostId?: string;
  recentHosts: string[];
}

interface TitleHistoryEntry {
  title: string;
  hostId: string;
  category: MeetingCategory;
  timestamp: number;
}

interface ScoredTimeSlot extends TimeSlot {
  score: number;
  scoreReasons: string[];
}

const STORAGE_KEY = 'al_adaam_smart_defaults';
const MAX_TITLE_HISTORY = 50;

export const smartDefaults = {
  getPatterns(): UserPattern {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const defaults: UserPattern = {
        hostAffinity: {},
        durationPreference: {},
        timePreference: {},
        categoryPreference: {},
        titleHistory: [],
        recentHosts: []
      };
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return {
        hostAffinity: {},
        durationPreference: {},
        timePreference: {},
        categoryPreference: {},
        titleHistory: [],
        recentHosts: []
      };
    }
  },

  savePatterns(patterns: UserPattern) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
  },

  trackAction(action: 'login' | 'view_host' | 'book_slot', data: any) {
    const patterns = this.getPatterns();

    if (action === 'view_host' && data.hostId) {
      patterns.lastHostId = data.hostId;
      // Boost affinity slightly just for viewing
      patterns.hostAffinity[data.hostId] = (patterns.hostAffinity[data.hostId] || 0) + 1;
      
      // Update recent hosts (keep last 5)
      patterns.recentHosts = [data.hostId, ...patterns.recentHosts.filter(id => id !== data.hostId)].slice(0, 5);
    }

    if (action === 'book_slot' && data.hostId) {
      // Significant boost for booking
      patterns.hostAffinity[data.hostId] = (patterns.hostAffinity[data.hostId] || 0) + 5;
      
      if (data.duration) {
        patterns.durationPreference[data.duration] = (patterns.durationPreference[data.duration] || 0) + 1;
      }

      if (data.time) {
        // Extract hour from "09:30"
        const hour = data.time.split(':')[0];
        patterns.timePreference[hour] = (patterns.timePreference[hour] || 0) + 1;
      }

      // Track category preference per host
      if (data.category) {
        if (!patterns.categoryPreference[data.hostId]) {
          patterns.categoryPreference[data.hostId] = {};
        }
        patterns.categoryPreference[data.hostId][data.category] = 
          (patterns.categoryPreference[data.hostId][data.category] || 0) + 1;
      }

      // Store title in history for suggestions
      if (data.title && data.title.trim()) {
        patterns.titleHistory = [
          {
            title: data.title.trim(),
            hostId: data.hostId,
            category: data.category || 'general',
            timestamp: Date.now()
          },
          ...patterns.titleHistory
        ].slice(0, MAX_TITLE_HISTORY);
      }
    }

    this.savePatterns(patterns);
  },

  // ============================================
  // TITLE SUGGESTIONS
  // ============================================
  
  /**
   * Get title suggestions based on history
   * Prioritizes titles used with the same host
   */
  getTitleSuggestions(hostId?: string, query?: string, limit: number = 5): string[] {
    const patterns = this.getPatterns();
    
    // Get unique titles, prioritizing by recency and host match
    const titleScores = new Map<string, number>();
    
    patterns.titleHistory.forEach((entry, index) => {
      const recencyScore = MAX_TITLE_HISTORY - index; // More recent = higher score
      const hostMatchScore = entry.hostId === hostId ? 50 : 0; // Bonus for same host
      
      const currentScore = titleScores.get(entry.title) || 0;
      titleScores.set(entry.title, currentScore + recencyScore + hostMatchScore);
    });
    
    // Sort by score and filter by query if provided
    let titles = Array.from(titleScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([title]) => title);
    
    // Filter by query if provided
    if (query && query.trim()) {
      const lowerQuery = query.toLowerCase();
      titles = titles.filter(t => t.toLowerCase().includes(lowerQuery));
    }
    
    return titles.slice(0, limit);
  },

  /**
   * Get common title templates based on category
   */
  getTitleTemplates(category: MeetingCategory): string[] {
    const templates: Record<MeetingCategory, string[]> = {
      strategy: [
        'Strategy Review',
        'Strategic Planning Session',
        'Quarterly Strategy Discussion',
        'Strategic Initiative Review'
      ],
      operation: [
        'Operations Update',
        'Weekly Operations Review',
        'Operations Planning',
        'Operational Status Meeting'
      ],
      client: [
        'Client Meeting',
        'Client Review Session',
        'Client Onboarding',
        'Client Status Update'
      ],
      hr: [
        'HR Discussion',
        'Performance Review',
        'Team Feedback Session',
        'HR Policy Review'
      ],
      general: [
        'Team Sync',
        'Quick Discussion',
        'Follow-up Meeting',
        'Catch Up'
      ]
    };
    
    return templates[category] || templates.general;
  },

  // ============================================
  // CATEGORY SUGGESTIONS
  // ============================================
  
  /**
   * Suggest category based on host and title keywords
   */
  getSuggestedCategory(hostId: string, title?: string): MeetingCategory {
    const patterns = this.getPatterns();
    
    // 1. Check title keywords first (highest priority)
    if (title) {
      const lowerTitle = title.toLowerCase();
      
      const categoryKeywords: Record<MeetingCategory, string[]> = {
        strategy: ['strategy', 'strategic', 'planning', 'roadmap', 'vision', 'quarterly', 'annual'],
        operation: ['operations', 'ops', 'operational', 'status', 'update', 'weekly', 'daily'],
        client: ['client', 'customer', 'vendor', 'partner', 'external', 'sales'],
        hr: ['hr', 'human resources', 'performance', 'review', 'feedback', 'hiring', 'interview'],
        general: ['sync', 'catch up', 'discussion', 'meeting', 'chat']
      };
      
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => lowerTitle.includes(kw))) {
          return category as MeetingCategory;
        }
      }
    }
    
    // 2. Check host preference (what category is most common with this host)
    if (patterns.categoryPreference[hostId]) {
      const hostCategories = patterns.categoryPreference[hostId];
      let bestCategory: MeetingCategory = 'general';
      let maxCount = 0;
      
      for (const [cat, count] of Object.entries(hostCategories)) {
        const countNum = count as number;
        if (countNum > maxCount) {
          maxCount = countNum;
          bestCategory = cat as MeetingCategory;
        }
      }
      
      if (maxCount >= 2) { // Only suggest if used at least twice
        return bestCategory;
      }
    }
    
    // 3. Default
    return 'general';
  },

  // ============================================
  // TIME SLOT SCORING
  // ============================================
  
  /**
   * Score time slots based on user preferences
   * Higher score = more aligned with user's booking patterns
   */
  scoreTimeSlots(slots: TimeSlot[], hostId?: string): ScoredTimeSlot[] {
    const patterns = this.getPatterns();
    
    return slots.map(slot => {
      let score = 50; // Base score
      const scoreReasons: string[] = [];
      
      if (!slot.available) {
        return { ...slot, score: 0, scoreReasons: ['Unavailable'], time: slot.label, isAvailable: slot.available };
      }
      
      const hourStr = slot.hour.toString().padStart(2, '0');
      
      // 1. Time preference bonus (based on booking history)
      const timeCount = patterns.timePreference[hourStr] || 0;
      if (timeCount > 0) {
        const timeBonus = Math.min(timeCount * 5, 25); // Max 25 bonus
        score += timeBonus;
        scoreReasons.push(`Preferred time (+${timeBonus})`);
      }
      
      // 2. Morning preference bonus (9-11 AM often preferred)
      if (slot.hour >= 9 && slot.hour <= 11) {
        score += 10;
        scoreReasons.push('Morning slot (+10)');
      }
      
      // 3. Avoid lunch hour penalty
      if (slot.hour === 12 || slot.hour === 13) {
        score -= 15;
        scoreReasons.push('Lunch hour (-15)');
      }
      
      // 4. End of day penalty (after 4 PM)
      if (slot.hour >= 16) {
        score -= 5;
        scoreReasons.push('Late afternoon (-5)');
      }
      
      // 5. Round hour bonus (people prefer :00 over :30)
      if (slot.minute === 0) {
        score += 5;
        scoreReasons.push('On the hour (+5)');
      }
      
      return { 
        ...slot, 
        score, 
        scoreReasons,
        time: slot.label,
        isAvailable: slot.available
      };
    }).sort((a, b) => {
      // Sort available slots by score (highest first), then by time
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      if (a.score !== b.score) return b.score - a.score;
      return a.hour * 60 + a.minute - (b.hour * 60 + b.minute);
    });
  },

  /**
   * Get the best available time slot for a host
   */
  getBestTimeSlot(slots: TimeSlot[], hostId?: string): TimeSlot | null {
    const scoredSlots = this.scoreTimeSlots(slots, hostId);
    const available = scoredSlots.filter(s => s.available);
    return available.length > 0 ? available[0] : null;
  },

  getRecommendedDuration(hostId?: string): number {
    const patterns = this.getPatterns();
    
    // 1. Find most frequent duration globally
    let bestDuration = 30; // Default
    let maxCount = 0;
    
    Object.entries(patterns.durationPreference).forEach(([dur, count]) => {
      const countNum = count as number;
      if (countNum > maxCount) {
        maxCount = countNum;
        bestDuration = parseInt(dur);
      }
    });

    return bestDuration;
  },

  getPreferredHosts(hosts: User[]): User[] {
    const patterns = this.getPatterns();
    
    return [...hosts].sort((a, b) => {
      const scoreA = patterns.hostAffinity[a.id] || 0;
      const scoreB = patterns.hostAffinity[b.id] || 0;
      return scoreB - scoreA; // Descending order
    });
  },
  
  getRecentHosts(allHosts: User[]): User[] {
      const patterns = this.getPatterns();
      if (!patterns.recentHosts || patterns.recentHosts.length === 0) return [];
      
      return patterns.recentHosts
        .map(id => allHosts.find(h => h.id === id))
        .filter((h): h is User => !!h);
  },

  // ============================================
  // CLEAR DATA
  // ============================================
  
  clearAllData() {
    localStorage.removeItem(STORAGE_KEY);
  }
};

