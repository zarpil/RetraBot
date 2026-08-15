import React from 'react';
import {
  Crown,
  Shield,
  TrendingUp,
  Volume2,
  Coins,
  Users,
  Cake,
  Settings,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import type { Tab, Guild, ServerStats } from '../types';

interface SidebarProps {
  tab: Tab;
  setTab: (tab: Tab) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  currentGuild: Guild | undefined;
  stats: ServerStats;
  isOnline: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  tab,
  setTab,
  sidebarOpen,
  setSidebarOpen,
  currentGuild,
  stats,
  isOnline
}) => {
  return (
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🤖</div>
        <div className="sidebar-logo-text">
          <strong>RetraBot</strong>
          <span>v2 panel</span>
        </div>
      </div>

      <div className="sidebar-guild">
        <div className="sidebar-guild-card">
          <img
            className="sidebar-guild-icon"
            src={currentGuild?.icon || 'https://cdn.discordapp.com/embed/avatars/0.png'}
            alt="icon"
          />
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-guild-name">{stats.name}</div>
            <div className="sidebar-guild-sub">{stats.memberCount} miembros</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-label">Módulos</div>

        {([
          ['dashboard', 'Inicio / Resumen', <Crown size={14} />],
          ['general', 'Ajustes Generales', <Settings size={14} />],
          ['clans', 'Clanes', <Shield size={14} />],
          ['leveling', 'Niveles', <TrendingUp size={14} />],
          ['tempvc', 'Canales de Voz', <Volume2 size={14} />],
          ['casino', 'Casino & Economía', <Coins size={14} />],
          ['leaderboard', 'Clasificación', <Users size={14} />],
          ['birthdays', 'Cumpleaños', <Cake size={14} />],
          ['triggers', 'Mensajes Auto', <MessageSquare size={14} />],
        ] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => (
          <div
            key={id}
            className={`nav-item ${tab === id ? 'active' : ''}`}
            onClick={() => { setTab(id); setSidebarOpen(false); }}
          >
            {icon}
            <span>{label}</span>
            {tab === id && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="status-pill">
          <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          <span>{isOnline ? 'API conectada' : 'Modo demo'}</span>
        </div>
      </div>
    </aside>
  );
};
