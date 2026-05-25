/**
 * Database Configuration - SQLite with better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/scheduler.db');

class DatabaseManager {
  private db: Database.Database | null = null;

  async initialize(): Promise<void> {
    // Ensure data directory exists
    const fs = await import('fs');
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    await this.runMigrations();
    await this.seedDefaultData();
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Migration tracking table — created first so we can skip already-applied
    // migrations on subsequent runs (prevents repeat-failure ALTERs).
    this.db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    const applied = new Set(
      (this.db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map(r => r.name)
    );
    const runOnce = (name: string, sql: string) => {
      if (applied.has(name)) return;
      try {
        this.db!.exec(sql);
      } catch (e) {
        // Column/constraint may already exist from a pre-tracking run.
        // Still record the migration to avoid re-running it on every boot.
      }
      this.db!.prepare('INSERT OR IGNORE INTO schema_migrations (name) VALUES (?)').run(name);
      applied.add(name);
    };

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'guest',
        title TEXT,
        avatar TEXT,
        team_id TEXT,
        timezone TEXT DEFAULT 'Asia/Qatar',
        onboarding_completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
      )
    `);

    // User Availability table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_availability (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        start_hour INTEGER DEFAULT 9,
        end_hour INTEGER DEFAULT 17,
        slot_duration INTEGER DEFAULT 30,
        buffer_minutes INTEGER DEFAULT 0,
        min_notice_minutes INTEGER DEFAULT 120,
        working_days TEXT DEFAULT '[0,1,2,3,4]',
        time_off TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // User Meeting Settings table (for video conferencing preferences)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_meeting_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        preferred_platform TEXT DEFAULT NULL,
        meeting_link TEXT DEFAULT NULL,
        custom_platform_name TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Teams table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        image TEXT,
        leader_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Add leader_id column if it doesn't exist (migration for existing DBs)
    runOnce(
      '20240101_teams_add_leader_id',
      `ALTER TABLE teams ADD COLUMN leader_id TEXT REFERENCES users(id) ON DELETE SET NULL`
    );
    runOnce(
      '20240101_meetings_add_reminder_24h_sent',
      `ALTER TABLE meetings ADD COLUMN reminder_24h_sent INTEGER DEFAULT 0`
    );
    runOnce(
      '20240101_meetings_add_reminder_1h_sent',
      `ALTER TABLE meetings ADD COLUMN reminder_1h_sent INTEGER DEFAULT 0`
    );
    runOnce(
      '20240102_meetings_add_host_reminder_24h_sent',
      `ALTER TABLE meetings ADD COLUMN host_reminder_24h_sent INTEGER DEFAULT 0`
    );
    runOnce(
      '20240102_meetings_add_host_reminder_1h_sent',
      `ALTER TABLE meetings ADD COLUMN host_reminder_1h_sent INTEGER DEFAULT 0`
    );
    runOnce(
      '20240103_meetings_add_attendee_token',
      `ALTER TABLE meetings ADD COLUMN attendee_token TEXT`
    );
    runOnce(
      '20240104_booking_links_add_questions',
      `ALTER TABLE booking_links ADD COLUMN questions TEXT DEFAULT '[]'`
    );
    runOnce(
      '20240105_booking_links_add_view_count',
      `ALTER TABLE booking_links ADD COLUMN view_count INTEGER DEFAULT 0`
    );
    runOnce(
      '20240106_users_add_email_verified',
      `ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`
    );
    runOnce(
      '20240107_password_reset_tokens',
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    );
    runOnce(
      '20240108_notification_prefs',
      `CREATE TABLE IF NOT EXISTS notification_prefs (
        user_id TEXT PRIMARY KEY,
        attendee_reminders INTEGER DEFAULT 1,
        host_reminders INTEGER DEFAULT 1,
        booking_approved INTEGER DEFAULT 1,
        booking_cancelled INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    );
    runOnce(
      '20240109_in_app_notifications',
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        link TEXT,
        read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    );
    runOnce(
      '20240110_notifications_index',
      `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at)`
    );
    runOnce(
      '20240111_ical_feed_tokens',
      `ALTER TABLE users ADD COLUMN ical_feed_token TEXT`
    );
    runOnce(
      '20240112_team_booking_links',
      `CREATE TABLE IF NOT EXISTS team_booking_links (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        token TEXT UNIQUE NOT NULL,
        title TEXT DEFAULT 'Book a meeting with our team',
        description TEXT,
        duration_options TEXT DEFAULT '[15, 30, 45, 60]',
        default_duration INTEGER DEFAULT 30,
        is_active INTEGER DEFAULT 1,
        expires_at TEXT,
        max_bookings_per_day INTEGER,
        custom_message TEXT,
        view_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      )`
    );

    // Meetings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 30,
        attendee_name TEXT NOT NULL,
        attendee_email TEXT NOT NULL,
        additional_attendees TEXT,
        user_id TEXT,
        host_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        booked_by TEXT NOT NULL,
        notes TEXT,
        category TEXT DEFAULT 'general',
        meeting_format TEXT DEFAULT 'in-person',
        meeting_link TEXT,
        meeting_platform TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Activity Logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        details TEXT,
        performed_by TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User Stats (for gamification)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_stats (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        total_bookings INTEGER DEFAULT 0,
        total_cancellations INTEGER DEFAULT 0,
        meetings_attended INTEGER DEFAULT 0,
        last_login TEXT,
        login_streak INTEGER DEFAULT 0,
        unlocked_achievements TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Sessions table (for JWT refresh tokens)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Booking Links table (for Calendly-style public booking)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS booking_links (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        token TEXT UNIQUE NOT NULL,
        title TEXT DEFAULT 'Book a Meeting',
        description TEXT,
        duration_options TEXT DEFAULT '[15, 30, 45, 60]',
        default_duration INTEGER DEFAULT 30,
        is_active INTEGER DEFAULT 1,
        expires_at TEXT,
        max_bookings_per_day INTEGER,
        buffer_before INTEGER DEFAULT 0,
        buffer_after INTEGER DEFAULT 0,
        custom_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
      CREATE INDEX IF NOT EXISTS idx_meetings_host ON meetings(host_id);
      CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
      CREATE INDEX IF NOT EXISTS idx_meetings_format ON meetings(meeting_format);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_meeting_settings_user ON user_meeting_settings(user_id);
      CREATE INDEX IF NOT EXISTS idx_booking_links_slug ON booking_links(slug);
      CREATE INDEX IF NOT EXISTS idx_booking_links_token ON booking_links(token);
      CREATE INDEX IF NOT EXISTS idx_booking_links_user ON booking_links(user_id);
    `);

    // Init tables owned by other modules. Lazy-import to avoid circular
    // import issues (these modules import { db } from this file).
    try {
      const { initCalendarTables } = await import('./services/calendarSync');
      initCalendarTables();
    } catch (e) {
      console.error('Failed to initialize calendar sync tables:', e);
    }
    try {
      const { initRoundRobinTable } = await import('./routes/roundRobin');
      initRoundRobinTable();
    } catch (e) {
      console.error('Failed to initialize round-robin table:', e);
    }

    console.log('📦 Database migrations completed');
  }

  private async seedDefaultData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Production safety: never seed demo accounts in production unless
    // explicitly enabled. Demo accounts use the password "password" and
    // include an admin role — they are a serious risk if leaked into prod.
    const isProd = process.env.NODE_ENV === 'production';
    const seedAllowed = process.env.SEED_DEMO_DATA === 'true';
    if (isProd && !seedAllowed) {
      console.log('⏭️  Skipping demo data seed (NODE_ENV=production and SEED_DEMO_DATA!=true)');
      return;
    }

    // Check if we already have users
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

    if (userCount.count === 0) {
      console.log('🌱 Seeding default data...');

      // Create default teams
      const teams = [
        { id: 't1', name: 'Executive', color: '#8A1538', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1000' },
        { id: 't2', name: 'Finance', color: '#129b82', image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1000' },
        { id: 't3', name: 'Legal', color: '#0d4261', image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=1000' },
        { id: 't4', name: 'Creative', color: '#e9c56b', image: 'https://images.unsplash.com/photo-1502945015378-0e284ca1a543?auto=format&fit=crop&q=80&w=1000' }
      ];

      const insertTeam = this.db.prepare(`
        INSERT INTO teams (id, name, color, image) VALUES (?, ?, ?, ?)
      `);

      for (const team of teams) {
        insertTeam.run(team.id, team.name, team.color, team.image);
      }

      // Create default users with hashed passwords
      const passwordHash = await bcrypt.hash('password', 12);

      const users = [
        { id: '0', username: 'admin', name: 'System Admin', role: 'admin', title: 'Administrator', teamId: 't1' },
        { id: '1', username: 'manager', name: 'Abdul Rahman', role: 'manager', title: 'Senior Consultant', teamId: 't1' },
        { id: '4', username: 'sarah', name: 'Sarah Al-Mahmoud', role: 'manager', title: 'Financial Advisor', teamId: 't2' },
        { id: '5', username: 'khalid', name: 'Khalid Bin Zaid', role: 'manager', title: 'Legal Expert', teamId: 't3' },
        { id: '2', username: 'sub', name: 'Fatima (Assistant)', role: 'subordinate', title: 'Executive Assistant', teamId: 't1' },
        { id: '3', username: 'user1', name: 'Ahmed (Client)', role: 'guest', title: null, teamId: null }
      ];

      const insertUser = this.db.prepare(`
        INSERT INTO users (id, username, password_hash, name, role, title, team_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertAvailability = this.db.prepare(`
        INSERT INTO user_availability (id, user_id) VALUES (?, ?)
      `);

      const insertMeetingSettings = this.db.prepare(`
        INSERT INTO user_meeting_settings (id, user_id, preferred_platform, meeting_link) VALUES (?, ?, ?, ?)
      `);

      // Default meeting settings for managers
      const managerMeetingSettings: Record<string, { platform: string, link: string }> = {
        '1': { platform: 'zoom', link: 'https://zoom.us/j/abdul-rahman' },
        '4': { platform: 'teams', link: 'https://teams.microsoft.com/l/meetup-join/sarah' },
        '5': { platform: 'google-meet', link: 'https://meet.google.com/khalid-legal' }
      };

      for (const user of users) {
        insertUser.run(user.id, user.username, passwordHash, user.name, user.role, user.title, user.teamId);
        insertAvailability.run(`avail_${user.id}`, user.id);
        
        // Add meeting settings for managers
        const settings = managerMeetingSettings[user.id];
        if (settings) {
          insertMeetingSettings.run(`msettings_${user.id}`, user.id, settings.platform, settings.link);
        } else {
          insertMeetingSettings.run(`msettings_${user.id}`, user.id, null, null);
        }
      }

      console.log('✅ Default data seeded');
    }
  }

  get connection(): Database.Database {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const db = new DatabaseManager();
