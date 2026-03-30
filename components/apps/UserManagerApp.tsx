
import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../utils/api';

interface User {
  uid: number;
  gid: number;
  username: string;
  fullName: string;
  homeDir: string;
  shell: string;
  groups: string[];
  locked: boolean;
  lastLogin?: number;
  createdAt: number;
  sudoer: boolean;
  sshKeys: string[];
}

interface Group {
  gid: number;
  name: string;
  members: string[];
  system: boolean;
}

interface Session {
  sessionId: string;
  uid: number;
  username: string;
  loginTime: number;
  active: boolean;
}

const UserManagerApp: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'groups' | 'sessions'>('users');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', fullName: '', password: '', sudoer: false });

  const fetchData = () => {
    fetch(getApiUrl('/api/users'))
      .then(res => res.json())
      .then(data => {
        setUsers(data.users ?? []);
        setGroups(data.groups ?? []);
        setSessions(data.sessions ?? []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const createUser = () => {
    if (!newUser.username || !newUser.fullName || !newUser.password) return;
    fetch(getApiUrl('/api/users'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    }).then(() => {
      fetchData();
      setShowCreateUser(false);
      setNewUser({ username: '', fullName: '', password: '', sudoer: false });
    });
  };

  const deleteUser = (uid: number) => {
    fetch(getApiUrl(`/api/users/${uid}`), { method: 'DELETE' })
      .then(() => fetchData());
  };

  const tabs = [
    { id: 'users' as const, label: 'Users', icon: '👤', count: users.length },
    { id: 'groups' as const, label: 'Groups', icon: '👥', count: groups.length },
    { id: 'sessions' as const, label: 'Sessions', icon: '🔐', count: sessions.length },
  ];

  return (
    <div className="flex h-full bg-slate-900/40">
      {/* Sidebar */}
      <div className="w-48 bg-black/20 border-r border-white/5 p-4 flex flex-col gap-1">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">User Management</h2>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all ${activeTab === tab.id ? 'bg-blue-600/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className="ml-auto text-xs text-slate-500">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-white uppercase tracking-tight">User Accounts</h1>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase rounded-xl transition-all" onClick={() => setShowCreateUser(!showCreateUser)}>
                {showCreateUser ? 'Cancel' : '+ Add User'}
              </button>
            </div>

            {showCreateUser && (
              <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-600/5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500" placeholder="Username" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                  <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500" placeholder="Full Name" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} />
                  <input className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500" placeholder="Password" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={newUser.sudoer} onChange={e => setNewUser({ ...newUser, sudoer: e.target.checked })} className="rounded" />
                    Sudoer (Admin)
                  </label>
                </div>
                <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded-xl" onClick={createUser}>Create User</button>
              </div>
            )}

            <div className="space-y-2">
              {users.filter(u => u.uid >= 1000 || u.uid === 0).map(user => (
                <div key={user.uid} className="p-4 rounded-2xl border border-white/5 bg-black/20 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {user.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{user.fullName}</span>
                      <span className="text-slate-500 text-xs">@{user.username}</span>
                      {user.sudoer && <span className="px-1.5 py-0.5 bg-yellow-600/20 text-yellow-300 rounded text-[10px] font-bold">SUDO</span>}
                      {user.locked && <span className="px-1.5 py-0.5 bg-red-600/20 text-red-300 rounded text-[10px] font-bold">LOCKED</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      UID: {user.uid} | Home: {user.homeDir} | Shell: {user.shell} | Groups: {user.groups.slice(0, 3).join(', ')}{user.groups.length > 3 ? '...' : ''}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {user.lastLogin ? `Last login: ${new Date(user.lastLogin).toLocaleString()}` : 'Never logged in'}
                  </div>
                  {user.uid >= 1000 && (
                    <button className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg text-xs" onClick={() => deleteUser(user.uid)}>Delete</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Groups</h1>
            <div className="grid grid-cols-2 gap-3">
              {groups.map(group => (
                <div key={group.gid} className="p-3 rounded-xl border border-white/5 bg-black/20">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium text-sm">{group.name}</span>
                    <span className="text-xs text-slate-500">GID: {group.gid}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {group.members.length > 0 ? group.members.join(', ') : 'No members'}
                  </div>
                  {group.system && <span className="text-[10px] text-slate-600">System group</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Active Sessions</h1>
            {sessions.length === 0 ? (
              <div className="text-slate-500 text-sm p-4">No active sessions</div>
            ) : (
              sessions.map(session => (
                <div key={session.sessionId} className="p-4 rounded-2xl border border-white/5 bg-black/20 flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${session.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <div className="flex-1">
                    <span className="text-white font-medium">{session.username}</span>
                    <span className="text-xs text-slate-500 ml-2">UID: {session.uid}</span>
                  </div>
                  <span className="text-xs text-slate-500">Since: {new Date(session.loginTime).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagerApp;
