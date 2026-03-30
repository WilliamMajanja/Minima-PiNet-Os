/**
 * PiNet-OS User Management Service
 * Manages user accounts, groups, sessions, and authentication.
 * Provides a PAM-like authentication layer for the operating system.
 */

import crypto from 'crypto';
import type { UserAccount, GroupInfo, UserSession, AuthResult } from '../types/kernel.js';

// ─── Password Hashing ───────────────────────────────────────────────────────

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, s, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: s };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const result = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(result), Buffer.from(hash));
}

// ─── User Service ───────────────────────────────────────────────────────────

class UserService {
  private users = new Map<number, UserAccount>();
  private groups = new Map<number, GroupInfo>();
  private sessions = new Map<string, UserSession>();
  private passwordStore = new Map<number, { hash: string; salt: string }>();
  private nextUid = 1000;
  private nextGid = 1000;
  private listeners: Array<() => void> = [];

  constructor() {
    this.initSystemUsersAndGroups();
  }

  private initSystemUsersAndGroups(): void {
    // System groups
    const sysGroups: Array<Omit<GroupInfo, 'gid'> & { gid: number }> = [
      { gid: 0, name: 'root', members: ['root'], system: true },
      { gid: 1, name: 'daemon', members: [], system: true },
      { gid: 5, name: 'tty', members: [], system: true },
      { gid: 20, name: 'dialout', members: ['pi'], system: true },
      { gid: 27, name: 'sudo', members: ['pi'], system: true },
      { gid: 29, name: 'audio', members: ['pi'], system: true },
      { gid: 44, name: 'video', members: ['pi'], system: true },
      { gid: 46, name: 'plugdev', members: ['pi'], system: true },
      { gid: 100, name: 'users', members: ['pi'], system: true },
      { gid: 101, name: 'gpio', members: ['pi'], system: true },
      { gid: 102, name: 'i2c', members: ['pi'], system: true },
      { gid: 103, name: 'spi', members: ['pi'], system: true },
      { gid: 104, name: 'pinet', members: ['pi'], system: true },
      { gid: 65534, name: 'nogroup', members: ['nobody'], system: true },
    ];

    for (const g of sysGroups) {
      this.groups.set(g.gid, g);
    }

    // System users
    this.users.set(0, {
      uid: 0, gid: 0, username: 'root', fullName: 'Root',
      homeDir: '/root', shell: '/bin/bash',
      groups: ['root', 'sudo'], locked: true,
      createdAt: Date.now(), sudoer: true, sshKeys: [],
    });
    this.users.set(65534, {
      uid: 65534, gid: 65534, username: 'nobody', fullName: 'Nobody',
      homeDir: '/nonexistent', shell: '/usr/sbin/nologin',
      groups: ['nogroup'], locked: true,
      createdAt: Date.now(), sudoer: false, sshKeys: [],
    });

    // Default user: pi
    this.users.set(1000, {
      uid: 1000, gid: 1000, username: 'pi', fullName: 'PiNet User',
      homeDir: '/home/pi', shell: '/bin/bash',
      groups: ['users', 'sudo', 'gpio', 'i2c', 'spi', 'pinet', 'audio', 'video', 'dialout', 'plugdev'],
      locked: false, lastLogin: Date.now(),
      createdAt: Date.now(), sudoer: true, sshKeys: [],
    });
    this.groups.set(1000, { gid: 1000, name: 'pi', members: ['pi'], system: false });
    this.nextUid = 1001;
    this.nextGid = 1001;

    // Set default password for pi user (pinet)
    const { hash, salt } = hashPassword('pinet');
    this.passwordStore.set(1000, { hash, salt });
  }

  // ─── User Management ──────────────────────────────────────────────────

  /** Create a new user account. */
  createUser(
    username: string,
    fullName: string,
    password: string,
    options?: { shell?: string; groups?: string[]; sudoer?: boolean },
  ): UserAccount | null {
    // Check for duplicate username
    for (const u of this.users.values()) {
      if (u.username === username) return null;
    }

    const uid = this.nextUid++;
    const gid = this.nextGid++;

    // Create user's primary group
    this.groups.set(gid, { gid, name: username, members: [username], system: false });

    const groups = [username, 'users', ...(options?.groups ?? [])];

    const user: UserAccount = {
      uid, gid, username, fullName,
      homeDir: `/home/${username}`,
      shell: options?.shell ?? '/bin/bash',
      groups,
      locked: false,
      createdAt: Date.now(),
      sudoer: options?.sudoer ?? false,
      sshKeys: [],
    };

    this.users.set(uid, user);

    // Store password
    const { hash, salt } = hashPassword(password);
    this.passwordStore.set(uid, { hash, salt });

    // Add user to requested groups
    for (const gName of groups) {
      for (const [, g] of this.groups) {
        if (g.name === gName && !g.members.includes(username)) {
          g.members.push(username);
        }
      }
    }

    this.notify();
    return user;
  }

  /** Delete a user account. */
  deleteUser(uid: number): boolean {
    if (uid === 0 || uid === 65534) return false; // can't delete root/nobody
    const user = this.users.get(uid);
    if (!user) return false;

    // Remove from all groups
    for (const [, g] of this.groups) {
      g.members = g.members.filter(m => m !== user.username);
    }

    // Remove primary group
    this.groups.delete(user.gid);

    // End all sessions
    for (const [sid, session] of this.sessions) {
      if (session.uid === uid) this.sessions.delete(sid);
    }

    this.users.delete(uid);
    this.passwordStore.delete(uid);
    this.notify();
    return true;
  }

  /** Update user properties. */
  updateUser(uid: number, updates: Partial<Pick<UserAccount, 'fullName' | 'shell' | 'locked' | 'sudoer'>>): boolean {
    const user = this.users.get(uid);
    if (!user) return false;
    if (updates.fullName !== undefined) user.fullName = updates.fullName;
    if (updates.shell !== undefined) user.shell = updates.shell;
    if (updates.locked !== undefined) user.locked = updates.locked;
    if (updates.sudoer !== undefined) user.sudoer = updates.sudoer;
    this.notify();
    return true;
  }

  /** Change user password. */
  changePassword(uid: number, newPassword: string): boolean {
    if (!this.users.has(uid)) return false;
    const { hash, salt } = hashPassword(newPassword);
    this.passwordStore.set(uid, { hash, salt });
    return true;
  }

  /** Add SSH key. */
  addSshKey(uid: number, key: string): boolean {
    const user = this.users.get(uid);
    if (!user) return false;
    if (user.sshKeys.includes(key)) return false;
    user.sshKeys.push(key);
    this.notify();
    return true;
  }

  /** Remove SSH key. */
  removeSshKey(uid: number, key: string): boolean {
    const user = this.users.get(uid);
    if (!user) return false;
    user.sshKeys = user.sshKeys.filter(k => k !== key);
    this.notify();
    return true;
  }

  // ─── Group Management ─────────────────────────────────────────────────

  /** Create a group. */
  createGroup(name: string, system = false): GroupInfo | null {
    for (const g of this.groups.values()) {
      if (g.name === name) return null;
    }
    const gid = this.nextGid++;
    const group: GroupInfo = { gid, name, members: [], system };
    this.groups.set(gid, group);
    this.notify();
    return group;
  }

  /** Delete a group. */
  deleteGroup(gid: number): boolean {
    if (gid <= 104 || gid === 65534) return false; // can't delete system groups
    this.groups.delete(gid);
    this.notify();
    return true;
  }

  /** Add user to group. */
  addToGroup(username: string, groupName: string): boolean {
    const group = this.getGroupByName(groupName);
    if (!group || group.members.includes(username)) return false;
    group.members.push(username);
    const user = this.getUserByName(username);
    if (user && !user.groups.includes(groupName)) user.groups.push(groupName);
    this.notify();
    return true;
  }

  /** Remove user from group. */
  removeFromGroup(username: string, groupName: string): boolean {
    const group = this.getGroupByName(groupName);
    if (!group) return false;
    group.members = group.members.filter(m => m !== username);
    const user = this.getUserByName(username);
    if (user) user.groups = user.groups.filter(g => g !== groupName);
    this.notify();
    return true;
  }

  // ─── Authentication ───────────────────────────────────────────────────

  /** Authenticate a user by username and password. */
  authenticate(username: string, password: string): AuthResult {
    const user = this.getUserByName(username);
    if (!user) return { success: false, error: 'User not found' };
    if (user.locked) return { success: false, error: 'Account locked' };

    const stored = this.passwordStore.get(user.uid);
    if (!stored) return { success: false, error: 'No password set' };

    if (!verifyPassword(password, stored.hash, stored.salt)) {
      return { success: false, error: 'Invalid password' };
    }

    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session: UserSession = {
      sessionId, uid: user.uid, username: user.username,
      loginTime: Date.now(), lastActivity: Date.now(), active: true,
    };
    this.sessions.set(sessionId, session);
    user.lastLogin = Date.now();
    this.notify();

    return { success: true, uid: user.uid, sessionId };
  }

  /** Validate a session token. */
  validateSession(sessionId: string): UserSession | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) return null;
    session.lastActivity = Date.now();
    return session;
  }

  /** End a session. */
  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.active = false;
    this.sessions.delete(sessionId);
    this.notify();
    return true;
  }

  // ─── Queries ──────────────────────────────────────────────────────────

  getUser(uid: number): UserAccount | undefined {
    const user = this.users.get(uid);
    if (!user) return undefined;
    return { ...user, passwordHash: undefined }; // never expose hash
  }

  getUserByName(username: string): UserAccount | undefined {
    for (const u of this.users.values()) {
      if (u.username === username) return u;
    }
    return undefined;
  }

  listUsers(): UserAccount[] {
    return Array.from(this.users.values()).map(u => ({ ...u, passwordHash: undefined }));
  }

  getGroup(gid: number): GroupInfo | undefined {
    return this.groups.get(gid);
  }

  getGroupByName(name: string): GroupInfo | undefined {
    for (const g of this.groups.values()) {
      if (g.name === name) return g;
    }
    return undefined;
  }

  listGroups(): GroupInfo[] {
    return Array.from(this.groups.values());
  }

  listSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): UserSession[] {
    return this.listSessions().filter(s => s.active);
  }

  // ─── Observer ─────────────────────────────────────────────────────────

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private notify(): void {
    for (const l of this.listeners) { try { l(); } catch { /* noop */ } }
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const userService = new UserService();
