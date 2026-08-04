import React from 'react';
import { Crown, Shield, Users, Coins } from 'lucide-react';
import type { ServerStats, GuildConfig, ClanData, UserXP, Tab } from '../types';

interface DashboardOverviewProps {
  stats: ServerStats;
  config: GuildConfig;
  clans: ClanData[];
  lb: UserXP[];
  economyLb: { userId: string; cash: number; bank: number; total: number; displayName?: string; avatar?: string }[];
  setTab: (tab: Tab) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  config,
  clans,
  lb,
  economyLb,
  setTab
}) => {
  return (
    <div className="page-body">
      {/* Banner de Bienvenida y KPIs */}
      <div style={{ background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.15) 0%, rgba(46, 204, 113, 0.15) 100%)', border: '1px solid rgba(88, 101, 242, 0.3)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px 0', color: 'var(--txt-1)' }}>
              Bienvenido al Panel de Control de {stats.name}!
            </h1>
            <p style={{ fontSize: 13, color: 'var(--txt-3)', margin: 0 }}>
              Resumen general de actividad, métricas del servidor y acceso rápido a tus módulos.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-primary" onClick={() => setTab('clans')}>
              <Shield size={14} /> Ir a Clanes
            </button>
            <button type="button" className="btn" style={{ background: 'var(--bg-box)', border: '1px solid var(--border)' }} onClick={() => setTab('leaderboard')}>
              <Users size={14} /> Clasificación
            </button>
          </div>
        </div>
      </div>

      {/* Cuadrícula de Tarjetas Métricas (KPIs) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--txt-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} style={{ color: '#5865F2' }} /> Miembros Totales
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--txt-1)' }}>
            {stats.memberCount.toLocaleString()}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--txt-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={14} style={{ color: '#3498db' }} /> Clanes Registrados
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#3498db' }}>
            {clans.length}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--txt-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Crown size={14} style={{ color: '#2ecc71' }} /> Usuarios con Nivel
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#2ecc71' }}>
            {stats.registeredUsersCount}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--txt-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Coins size={14} style={{ color: '#f1c40f' }} /> Moneda {config.clanCurrencyName || 'GloriCoins'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f1c40f' }}>
            {clans.reduce((acc, c) => acc + (c.coins || 0), 0).toFixed(1)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt-3)' }}>en circulación</span>
          </div>
        </div>
      </div>

      {/* Cuadrícula de Tablas Destacadas (Top Clanes y Top Usuarios) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {/* Top Clanes del Mes */}
        <div className="section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Top Clanes del Mes
            </h2>
            <button type="button" className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setTab('clans')}>
              Ver Todos ➔
            </button>
          </div>
          <div className="section-body" style={{ padding: 0 }}>
            {clans.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--txt-3)' }}>No hay clanes registrados aún.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px' }}>#</th>
                      <th style={{ padding: '10px 14px' }}>Clan</th>
                      <th style={{ padding: '10px 14px' }}>Horas Mes</th>
                      <th style={{ padding: '10px 14px' }}>Integrantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clans.slice(0, 5).map((clan, idx) => (
                      <tr key={clan.id}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: idx === 0 ? '#f1c40f' : idx === 1 ? '#bdc3c7' : idx === 2 ? '#e67e22' : 'var(--txt-3)' }}>
                          #{idx + 1}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: clan.colorHex }} />
                            <span style={{ fontWeight: 600, color: 'var(--txt-1)' }}>{clan.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--txt-1)' }}>
                          {clan.currentMonthHours || clan.totalHours}h
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--txt-2)' }}>
                          {clan.membersCount} miembros
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Usuarios Nivel */}
        <div className="section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              ⭐ Top 5 Usuarios Nivel
            </h2>
            <button type="button" className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setTab('leaderboard')}>
              Ver Todos ➔
            </button>
          </div>
          <div className="section-body" style={{ padding: 0 }}>
            {lb.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--txt-3)' }}>No hay datos de clasificación.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px' }}>#</th>
                      <th style={{ padding: '10px 14px' }}>Usuario</th>
                      <th style={{ padding: '10px 14px' }}>Nivel Texto</th>
                      <th style={{ padding: '10px 14px' }}>Nivel Voz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lb.slice(0, 5).map((user, idx) => (
                      <tr key={user.id}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: idx === 0 ? '#f1c40f' : idx === 1 ? '#bdc3c7' : idx === 2 ? '#e67e22' : 'var(--txt-3)' }}>
                          #{idx + 1}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img src={user.avatar} alt="avatar" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                            <span style={{ fontWeight: 600, color: 'var(--txt-1)' }}>{user.displayName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#5865F2' }}>
                          Lvl {user.textLevel}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#a78bfa' }}>
                          Lvl {user.voiceLevel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Fortuna Casino / Economía */}
        <div className="section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Top 5 Casino & Economía
            </h2>
            <button type="button" className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setTab('casino')}>
              Ir a Economía ➔
            </button>
          </div>
          <div className="section-body" style={{ padding: 0 }}>
            {economyLb.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--txt-3)' }}>Sin registros en el ranking de economía.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px' }}>#</th>
                      <th style={{ padding: '10px 14px' }}>Usuario</th>
                      <th style={{ padding: '10px 14px' }}>En Efectivo</th>
                      <th style={{ padding: '10px 14px' }}>Total Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {economyLb.slice(0, 5).map((u, idx) => (
                      <tr key={u.userId}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: idx === 0 ? '#f1c40f' : idx === 1 ? '#bdc3c7' : idx === 2 ? '#e67e22' : 'var(--txt-3)' }}>
                          #{idx + 1}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img src={u.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'} alt="avatar" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                            <span style={{ fontWeight: 600, color: 'var(--txt-1)' }}>{u.displayName || `ID: ${u.userId}`}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#2ecc71' }}>
                          {config.currencySymbol || ''} {u.cash.toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 800, color: '#f1c40f' }}>
                          {config.currencySymbol || ''} {u.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
