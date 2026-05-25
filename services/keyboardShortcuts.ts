
export type ShortcutAction = string;

export interface ShortcutDef {
  key: string;
  description: string;
  action: ShortcutAction;
  category: 'Global' | 'Navigation' | 'Actions' | 'Dialogs' | 'List';
}

export const shortcuts: ShortcutDef[] = [
  // Global shortcuts
  { key: '?', description: 'Show keyboard shortcuts', action: 'showShortcuts', category: 'Global' },
  { key: '/', description: 'Open command palette', action: 'openCommand', category: 'Global' },
  { key: 'Esc', description: 'Close modal / Cancel', action: 'close', category: 'Global' },
  
  // Navigation shortcuts
  { key: 'g d', description: 'Go to Dashboard', action: 'goToDashboard', category: 'Navigation' },
  { key: 'g s', description: 'Go to Schedule', action: 'goToSchedule', category: 'Navigation' },
  { key: 'g a', description: 'Go to Appointments', action: 'goToAppointments', category: 'Navigation' },
  { key: 'g t', description: 'Go to Team Management', action: 'goToTeam', category: 'Navigation' },
  { key: 'g l', description: 'Go to Logs', action: 'goToLogs', category: 'Navigation' },
  
  // Action shortcuts
  { key: 'n', description: 'New Meeting', action: 'newMeeting', category: 'Actions' },
  { key: 'q', description: 'Quick Book (Next Available)', action: 'quickBook', category: 'Actions' },
  { key: 'r', description: 'Refresh', action: 'refresh', category: 'Actions' },
  
  // List navigation shortcuts (for appointments/meetings list)
  { key: 'j', description: 'Next item in list', action: 'listNext', category: 'List' },
  { key: 'k', description: 'Previous item in list', action: 'listPrev', category: 'List' },
  { key: 'a', description: 'Approve selected meeting', action: 'listApprove', category: 'List' },
  { key: 'x', description: 'Reject selected meeting', action: 'listReject', category: 'List' },
  { key: 'c', description: 'Cancel selected meeting', action: 'listCancel', category: 'List' },
  { key: 't', description: 'Jump to today', action: 'jumpToToday', category: 'List' },
  { key: 'Enter', description: 'Open selected item', action: 'listOpen', category: 'List' },
  
  // Dialog shortcuts
  { key: 'Cmd+Enter', description: 'Submit form', action: 'submitForm', category: 'Dialogs' },
];

// List navigation state
interface ListNavigationState {
  items: string[]; // Array of item IDs
  selectedIndex: number;
  enabled: boolean;
}

class KeyboardShortcutManager {
  private handlers: Record<string, () => void> = {};
  private sequenceBuffer: string[] = [];
  private sequenceTimeout: any = null;
  enabled: boolean = true;
  
  // List navigation state
  private listState: ListNavigationState = {
    items: [],
    selectedIndex: -1,
    enabled: false
  };

  constructor() {
    this.enabled = localStorage.getItem('keyboardShortcuts') !== 'false';
  }

  register(action: string, handler: () => void) {
    this.handlers[action] = handler;
  }

  unregister(action: string) {
    delete this.handlers[action];
  }

  // ============================================
  // LIST NAVIGATION API
  // ============================================
  
  /**
   * Set up list navigation with item IDs
   */
  setListItems(itemIds: string[]) {
    this.listState.items = itemIds;
    this.listState.selectedIndex = itemIds.length > 0 ? 0 : -1;
    this.listState.enabled = true;
  }
  
  /**
   * Disable list navigation
   */
  clearListItems() {
    this.listState.items = [];
    this.listState.selectedIndex = -1;
    this.listState.enabled = false;
  }
  
  /**
   * Get currently selected item ID
   */
  getSelectedItem(): string | null {
    if (!this.listState.enabled || this.listState.selectedIndex < 0) return null;
    return this.listState.items[this.listState.selectedIndex] || null;
  }
  
  /**
   * Get current selection index
   */
  getSelectedIndex(): number {
    return this.listState.selectedIndex;
  }
  
  /**
   * Set selection by index
   */
  setSelectedIndex(index: number) {
    if (index >= 0 && index < this.listState.items.length) {
      this.listState.selectedIndex = index;
    }
  }
  
  /**
   * Move selection down (j key)
   */
  selectNext(): string | null {
    if (!this.listState.enabled || this.listState.items.length === 0) return null;
    
    if (this.listState.selectedIndex < this.listState.items.length - 1) {
      this.listState.selectedIndex++;
    }
    return this.getSelectedItem();
  }
  
  /**
   * Move selection up (k key)
   */
  selectPrev(): string | null {
    if (!this.listState.enabled || this.listState.items.length === 0) return null;
    
    if (this.listState.selectedIndex > 0) {
      this.listState.selectedIndex--;
    }
    return this.getSelectedItem();
  }
  
  /**
   * Check if list navigation is active
   */
  isListNavigationEnabled(): boolean {
    return this.listState.enabled && this.listState.items.length > 0;
  }

  handleKeyDown(e: KeyboardEvent) {
    if (!this.enabled) return;

    // Ignore inputs
    const target = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      if (e.key === 'Escape') {
         target.blur(); 
         if (this.handlers['close']) this.handlers['close']();
      }
      return;
    }

    // Single Key or Modifier
    let keyString = e.key;
    if (e.metaKey || e.ctrlKey) keyString = 'Cmd+' + keyString;
    
    // Sequence Handling (e.g. "g d")
    if (keyString.length === 1 && /[a-zA-Z]/.test(keyString)) {
        this.sequenceBuffer.push(keyString.toLowerCase());
        
        if (this.sequenceTimeout) clearTimeout(this.sequenceTimeout);
        this.sequenceTimeout = setTimeout(() => {
            this.sequenceBuffer = [];
        }, 800);
    } else {
        this.sequenceBuffer = []; // Reset on special keys
    }

    const sequence = this.sequenceBuffer.join(' ');

    // Find match
    const match = shortcuts.find(s => 
        s.key === keyString || 
        s.key === keyString.toLowerCase() ||
        s.key === sequence ||
        (s.key === 'Esc' && e.key === 'Escape') ||
        (s.key === 'Enter' && e.key === 'Enter') ||
        (s.key === 'Cmd+Enter' && (e.metaKey || e.ctrlKey) && e.key === 'Enter')
    );

    if (match) {
      // Handle built-in list navigation
      if (match.category === 'List' && this.listState.enabled) {
        e.preventDefault();
        
        switch (match.action) {
          case 'listNext':
            this.selectNext();
            if (this.handlers['listSelectionChanged']) {
              this.handlers['listSelectionChanged']();
            }
            break;
          case 'listPrev':
            this.selectPrev();
            if (this.handlers['listSelectionChanged']) {
              this.handlers['listSelectionChanged']();
            }
            break;
          default:
            // Other list actions are handled by registered handlers
            if (this.handlers[match.action]) {
              this.handlers[match.action]();
            }
        }
        this.sequenceBuffer = [];
        return;
      }
      
      // Handle registered handlers
      if (this.handlers[match.action]) {
        e.preventDefault();
        this.handlers[match.action]();
        this.sequenceBuffer = []; // Reset after success
      }
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('keyboardShortcuts', String(this.enabled));
    return this.enabled;
  }
  
  /**
   * Get shortcuts grouped by category
   */
  getShortcutsByCategory(): Record<string, ShortcutDef[]> {
    return shortcuts.reduce((acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    }, {} as Record<string, ShortcutDef[]>);
  }
}

export const shortcutManager = new KeyboardShortcutManager();
