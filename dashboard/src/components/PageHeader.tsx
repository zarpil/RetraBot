import React from 'react';
import { Menu, X } from 'lucide-react';
import type { Tab, ServerStats } from '../types';

interface PageHeaderProps {
  tab: Tab;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  stats: ServerStats;
  lbLength: number;
  authUser: any;
  handleLogout: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  tab,
  sidebarOpen,
  setSidebarOpen,
  stats,
  lbLength,
  authUser,
  handleLogout
}) => {
  return (
    <div className="page-header">
      {/* Hamburger solo visible en móvil/tablet */}
      <button
        className="menu-btn"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Abrir menú"
      >
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <div className="page-header-left">
        <h1>
          {tab === 'general'     && 'Configuración General'}
          {tab === 'leveling'    && 'Módulo de Niveles'}
          {tab === 'tempvc'      && 'Canales de Voz Temporales'}
          {tab === 'casino'      && 'Casino & Economía por Temporadas'}
          {tab === 'leaderboard' && 'Clasificación del Servidor'}
          {tab === 'birthdays'   && 'Módulo de Cumpleaños'}
          {tab === 'clans'       && 'Gestión de Clanes'}
          {tab === 'dashboard'   && 'Resumen General'}
        </h1>
        <p>
          {tab === 'general'     && 'Activa módulos y configura los permisos de administrador.'}
          {tab === 'leveling'    && 'Ajusta XP, cooldowns y recompensas por nivel.'}
          {tab === 'tempvc'      && 'Canales de voz creados al momento por los usuarios.'}
          {tab === 'casino'      && 'Configura ganancias, cooldowns, robos e ingresos por roles.'}
          {tab === 'leaderboard' && `Top ${lbLength} usuarios del servidor ${stats.name}.`}
          {tab === 'birthdays'   && 'Configura el sistema de felicitación, mensajes y recompensas de cumpleaños.'}
          {tab === 'clans'       && 'Administra los clanes activos, la tienda de ventajas y la meta de horas.'}
          {tab === 'dashboard'   && `Panel de control y métricas clave de ${stats.name}.`}
        </p>
      </div>

      {/* User Profile & Logout */}
      {authUser && (
        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '6px 14px 6px 8px',
          borderRadius: 30,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <img
            src={authUser.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
            alt="Avatar"
            style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #5865F2' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {authUser.global_name || authUser.username}
            </span>
            <span style={{ fontSize: 10, color: '#5865F2', fontWeight: 600 }}>
              Staff Admin
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar Sesión"
            style={{
              background: 'rgba(231, 76, 60, 0.15)',
              color: '#e74c3c',
              border: 'none',
              padding: '6px 10px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: 6,
              transition: 'background 0.2s',
            }}
          >
            Salir
          </button>
        </div>
      )}
    </div>
  );
};
