import React from 'react';
import { Shield, ShoppingCart, Settings, ArrowLeft, Users, ChevronDown, Plus, Trash2, Save } from 'lucide-react';
import type { ClanData, GuildConfig, ServerStructure, ClanShopItem } from '../types';

interface ClansPageProps {
  clans: ClanData[];
  config: GuildConfig;
  setConfig: React.Dispatch<React.SetStateAction<GuildConfig>>;
  structure: ServerStructure;
  activeClanDetailId: string | null;
  setActiveClanDetailId: (id: string | null) => void;
  selectedMonthPeriod: string;
  setSelectedMonthPeriod: (period: string) => void;
  memberFilterQuery: string;
  setMemberFilterQuery: (query: string) => void;
  clanSubTab: 'list' | 'shop' | 'settings';
  setClanSubTab: (tab: 'list' | 'shop' | 'settings') => void;
  dbShopItems: ClanShopItem[];
  editingShopItemPrices: Record<string, number>;
  setEditingShopItemPrices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  newClanShopName: string;
  setNewClanShopName: (name: string) => void;
  newClanShopPrice: number;
  setNewClanShopPrice: (price: number) => void;
  newClanShopDesc: string;
  setNewClanShopDesc: (desc: string) => void;
  newClanShopIcon: string;
  setNewClanShopIcon: (icon: string) => void;
  expandedClanId: string | null;
  setExpandedClanId: (id: string | null) => void;
  openImportModal: () => void;
  setClanModalOpen: (open: boolean) => void;
  handleDeleteClan: (clanId: string, clanName: string) => void;
  handleSave: (e: React.FormEvent) => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  selectedGuild: string;
  triggerToast: (msg: string) => void;
  fetchClans: () => void;
  API_BASE: string;
}

export const ClansPage: React.FC<ClansPageProps> = ({
  clans,
  config,
  setConfig,
  structure,
  activeClanDetailId,
  setActiveClanDetailId,
  selectedMonthPeriod,
  setSelectedMonthPeriod,
  memberFilterQuery,
  setMemberFilterQuery,
  clanSubTab,
  setClanSubTab,
  dbShopItems,
  editingShopItemPrices,
  setEditingShopItemPrices,
  newClanShopName,
  setNewClanShopName,
  newClanShopPrice,
  setNewClanShopPrice,
  newClanShopDesc,
  setNewClanShopDesc,
  newClanShopIcon,
  setNewClanShopIcon,
  expandedClanId,
  setExpandedClanId,
  openImportModal,
  setClanModalOpen,
  handleDeleteClan,
  handleSave,
  authFetch,
  selectedGuild,
  triggerToast,
  fetchClans,
  API_BASE
}) => {
  // ── DETALLE DEL CLAN (FICHA INDIVIDUAL) ──
  if (activeClanDetailId) {
    const activeClan = clans.find(c => c.id === activeClanDetailId);
    if (!activeClan) return null;

    const currentYearMonth = new Date().toISOString().slice(0, 7);
    const activeMonth = selectedMonthPeriod || currentYearMonth;
    const historyRecord = activeClan.monthlyHistory?.find(h => h.yearMonth === activeMonth);
    const periodTotalHours = historyRecord ? historyRecord.monthlyHours : (activeMonth === currentYearMonth ? (activeClan.currentMonthHours || activeClan.totalHours) : 0);

    const periodMembersHours: Record<string, number> = {};
    if (historyRecord && historyRecord.dailyBreakdownJson) {
      try {
        const parsed = JSON.parse(historyRecord.dailyBreakdownJson);
        if (parsed.membersHours) {
          Object.assign(periodMembersHours, parsed.membersHours);
        }
      } catch {}
    }

    const membersWithHours = activeClan.members.map(m => {
      const h = periodMembersHours[m.userId] !== undefined
        ? periodMembersHours[m.userId]
        : (activeMonth === currentYearMonth ? m.hoursSpent : 0);
      return {
        ...m,
        periodHours: h,
        allTimeHoursSpent: m.hoursSpent,
      };
    }).sort((a, b) => b.periodHours - a.periodHours);



    const filteredMembers = membersWithHours.filter(m =>
      m.displayName.toLowerCase().includes(memberFilterQuery.toLowerCase()) ||
      m.userId.includes(memberFilterQuery)
    );

    return (
      <div className="page-body">
        {/* Barra superior de navegación y selector de mes */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <button
            type="button"
            className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            onClick={() => setActiveClanDetailId(null)}
          >
            <ArrowLeft size={16} /> Volver a la lista de clanes
          </button>

          {/* Selector de Meses Históricos */}
          {activeClan.monthlyHistory && activeClan.monthlyHistory.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt-3)' }}> Periodo de Consulta:</span>
              <select
                value={activeMonth}
                onChange={e => setSelectedMonthPeriod(e.target.value)}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--accent)',
                  color: 'var(--txt-1)',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {activeClan.monthlyHistory.map(h => (
                  <option key={h.yearMonth} value={h.yearMonth}>
                    {h.yearMonth === currentYearMonth ? ` ${h.yearMonth} (Mes Actual)` : ` ${h.yearMonth} (Archivo)`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Encabezado Principal del Clan */}
        <div className="section" style={{ borderLeft: `6px solid ${activeClan.colorHex}`, marginBottom: 20 }}>
          <div className="section-body" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--txt-1)', margin: 0 }}>
                    {activeClan.name}
                  </h1>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: `${activeClan.colorHex}22`, color: activeClan.colorHex, border: `1px solid ${activeClan.colorHex}44` }}>
                    ID: {activeClan.id}
                  </span>
                  {(activeClan.immunityShields || 0) > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(52, 152, 219, 0.2)', color: '#3498db', border: '1px solid rgba(52, 152, 219, 0.4)' }}>
                       {activeClan.immunityShields} Escudo{activeClan.immunityShields! > 1 ? 's' : ''} Hielito
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, color: 'var(--txt-3)', display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
                  <span> Líder: <strong style={{ color: 'var(--txt-1)' }}>{activeClan.leaderName}</strong> (<code style={{ fontSize: 12 }}>{activeClan.leaderId}</code>)</span>
                  <span> Canal de Voz: <code style={{ fontSize: 12, color: 'var(--txt-1)' }}>{activeClan.voiceChannelId}</code></span>
                  <span> Miembros: <strong style={{ color: 'var(--txt-1)' }}>{activeClan.membersCount}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tarjetas de Estadísticas Clave */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--txt-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
               Horas en {activeMonth}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt-1)' }}>
              {periodTotalHours} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--txt-3)' }}>h</span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--txt-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
               Horas Totales Históricas
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: activeClan.colorHex }}>
              {activeClan.totalAllTimeHours || activeClan.totalHours} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--txt-3)' }}>h (All-Time)</span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--txt-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
               Protecciones (Hielitos)
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: (activeClan.immunityShields || 0) > 0 ? '#3498db' : 'var(--txt-3)' }}>
              {activeClan.immunityShields || 0}/3 <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--txt-3)' }}>escudos</span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--txt-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
               Saldo {config.clanCurrencyName || 'GloriCoins'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f1c40f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{activeClan.coins || 0} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt-3)' }}>{config.clanCurrencyName || 'GloriCoins'}</span></span>
              <button
                type="button"
                className="btn"
                style={{ padding: '2px 8px', fontSize: 12, background: 'rgba(241, 196, 15, 0.15)', color: '#f1c40f', border: '1px solid rgba(241, 196, 15, 0.3)' }}
                onClick={async () => {
                  const amountStr = prompt(`Ajustar monedas de ${activeClan.name} (usa positivo para regalar, negativo para restar):`, '10');
                  if (!amountStr) return;
                  const amt = parseFloat(amountStr);
                  if (isNaN(amt)) return;
                  try {
                    await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/clans/${activeClan.id}/coins`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ amount: amt }),
                    });
                    fetchClans();
                  } catch {}
                }}
              >
                 Ajustar
              </button>
            </div>
          </div>
        </div>

        {/* Beneficios y Ventajas Activas del Clan */}
        <div className="section" style={{ marginBottom: 20 }}>
          <div className="section-header">
            <div className="section-header-icon" style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71' }}>
              <Shield size={16} />
            </div>
            <h2>Beneficios y Ventajas Activas del Clan</h2>
            <p>Estado de ventajas compradas en tienda y nivel de protección activa.</p>
          </div>
          <div className="section-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {[
                {
                  name: ' Permisos Multimedia en Voz',
                  desc: 'Permite enviar imágenes y vídeos dentro de su sala de voz.',
                  isActive: activeClan.hasMediaPerms,
                },
                {
                  name: ' Uso de Soundboard',
                  desc: 'Permite reproducir efectos de sonido en la sala de voz.',
                  isActive: activeClan.hasSoundboardPerms,
                },
                {
                  name: ' Canal de Voz Oculto',
                  desc: 'Canal oculto para usuarios ajenos al clan.',
                  isActive: activeClan.isHiddenClan,
                },
                {
                  name: ' Escudo de Inmunidad (Hielito)',
                  desc: 'Protege contra la eliminación mensual por horas mínimas.',
                  isActive: (activeClan.immunityShields || 0) > 0,
                  extraText: `${activeClan.immunityShields || 0}/3 Escudos Activos`,
                },
              ].map((perk, i) => (
                <div
                  key={i}
                  style={{
                    background: perk.isActive ? 'rgba(46, 204, 113, 0.08)' : 'var(--surface-2)',
                    border: `1px solid ${perk.isActive ? 'rgba(46, 204, 113, 0.3)' : 'var(--border)'}`,
                    borderRadius: 10,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: perk.isActive ? '#2ecc71' : 'var(--txt-2)' }}>
                      {perk.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--txt-3)', marginTop: 4, lineHeight: 1.4 }}>
                      {perk.desc}
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {perk.isActive ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#2ecc71', background: 'rgba(46, 204, 113, 0.15)', padding: '3px 10px', borderRadius: 12 }}>
                        Activo {perk.extraText ? `(${perk.extraText})` : ''}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-3)', background: 'rgba(255, 255, 255, 0.05)', padding: '3px 10px', borderRadius: 12 }}>
                        ❌ No Adquirido
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabla de Integrantes */}
        <div className="section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="section-header-icon" style={{ background: 'rgba(88, 101, 242, 0.15)', color: '#5865f2' }}>
                <Users size={16} />
              </div>
              <h2>Integrantes del Clan ({activeClan.members.length})</h2>
              <p>Desglose completo de contribución de horas Anti-AFK por usuario.</p>
            </div>

            <div style={{ width: 220 }}>
              <input
                type="text"
                placeholder="Filtrar miembro..."
                value={memberFilterQuery}
                onChange={e => setMemberFilterQuery(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 13 }}
              />
            </div>
          </div>

          <div className="section-body" style={{ padding: 0 }}>
            {filteredMembers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--txt-3)' }}>
                No se encontraron integrantes que coincidan con la búsqueda.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 16px' }}>#</th>
                      <th style={{ padding: '12px 16px' }}>Integrante</th>
                      <th style={{ padding: '12px 16px' }}>Rol</th>
                      <th style={{ padding: '12px 16px' }}>Horas en {activeMonth}</th>
                      <th style={{ padding: '12px 16px' }}>Horas Totales (All-Time)</th>
                      <th style={{ padding: '12px 16px' }}>Contribución en {activeMonth}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m, idx) => {
                      const sharePct = periodTotalHours > 0 ? Math.round((m.periodHours / periodTotalHours) * 100) : 0;

                      return (
                        <tr key={m.id || m.userId}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--txt-3)' }}>
                            #{idx + 1}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <img
                                src={m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                                alt="avatar"
                                style={{ width: 28, height: 28, borderRadius: '50%' }}
                              />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt-1)' }}>
                                  {m.displayName}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>
                                  ID: {m.userId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {m.userId === activeClan.leaderId ? (
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#f1c40f', background: 'rgba(241, 196, 15, 0.15)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(241, 196, 15, 0.3)' }}>
                                 Líder
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>Miembro</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--txt-1)' }}>
                             {m.periodHours}h
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: activeClan.colorHex }}>
                             {m.allTimeHoursSpent || m.hoursSpent}h
                          </td>
                          <td style={{ padding: '12px 16px', minWidth: 140 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(sharePct, 100)}%`, height: '100%', background: activeClan.colorHex }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-2)', width: 32 }}>{sharePct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── VISTA GENERAL DE CLANES (SUB-PESTAÑAS) ──
  return (
    <div className="page-body">
      {/* Sub-Navegación Limpia dentro de Clanes */}
      <div
        style={{
          display: 'inline-flex',
          background: 'var(--surface-2)',
          padding: 4,
          borderRadius: 10,
          border: '1px solid var(--border)',
          marginBottom: 20,
          gap: 4,
        }}
      >
        <button
          type="button"
          className="btn"
          onClick={() => setClanSubTab('list')}
          style={{
            background: clanSubTab === 'list' ? 'var(--accent)' : 'transparent',
            color: clanSubTab === 'list' ? '#fff' : 'var(--txt-2)',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Shield size={15} /> ️ Clanes ({clans.length})
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => setClanSubTab('shop')}
          style={{
            background: clanSubTab === 'shop' ? 'var(--accent)' : 'transparent',
            color: clanSubTab === 'shop' ? '#fff' : 'var(--txt-2)',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ShoppingCart size={15} />  Editor de Tienda
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => setClanSubTab('settings')}
          style={{
            background: clanSubTab === 'settings' ? 'var(--accent)' : 'transparent',
            color: clanSubTab === 'settings' ? '#fff' : 'var(--txt-2)',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Settings size={15} /> ⚙️ Ajustes del Módulo
        </button>
      </div>

      {/* SUB-TAB 1: EDITOR DE PRECIOS Y PRODUCTOS DE TIENDA */}
      {clanSubTab === 'shop' && (
        <>
          <div className="section" style={{ marginBottom: 20 }}>
            <div className="section-header">
              <div className="section-header-icon" style={{ background: 'rgba(241, 196, 15, 0.15)', color: '#f1c40f' }}>
                <ShoppingCart size={16} />
              </div>
              <h2>Precios y Catálogo de la Tienda de Clanes</h2>
              <p>Edita los precios en {config.clanCurrencyName || 'GloriCoins'} de cada beneficio o añade nuevos productos personalizados.</p>
            </div>
            <div className="section-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {[
                  { id: 'item_media_def', name: ' Permisos Multimedia en Canal', price: (dbShopItems || []).find(i => i.actionKey === 'MEDIA_PERMS')?.price ?? 15, desc: 'Permite enviar imágenes y vídeos en el canal de voz.' },
                  { id: 'item_sb_def', name: ' Uso de Soundboard en Clan', price: (dbShopItems || []).find(i => i.actionKey === 'SOUNDBOARD')?.price ?? 10, desc: 'Permite reproducir efectos de sonido en la voz del clan.' },
                  { id: 'item_hide_def', name: ' Ocultar Clan al Público', price: (dbShopItems || []).find(i => i.actionKey === 'HIDE_CLAN')?.price ?? 25, desc: 'Oculta el canal de voz a @everyone.' },
                  { id: 'item_shield_def', name: ' Escudo de Inmunidad (Hielito)', price: (dbShopItems || []).find(i => i.actionKey === 'IMMUNITY_SHIELD')?.price ?? 30, desc: 'Protege al clan 1 mes de borrados por horas.' },
                  { id: 'item_emoji_def', name: ' Emoji Personalizado en Servidor', price: (dbShopItems || []).find(i => i.name?.includes('Emoji'))?.price ?? 50, desc: 'Petición al staff para subir un emoji del clan.' },
                  { id: 'item_sticker_def', name: ' Pegatina Personalizada en Servidor', price: (dbShopItems || []).find(i => i.name?.includes('Pegatina'))?.price ?? 60, desc: 'Petición al staff para añadir una pegatina.' },
                  { id: 'item_sound_def', name: ' Añadir Sonido a Soundboard General', price: (dbShopItems || []).find(i => i.name?.includes('Sonido'))?.price ?? 40, desc: 'Petición al staff para subir un audio al soundboard.' },
                ].map(item => {
                  const currentPrice = editingShopItemPrices[item.id] !== undefined ? editingShopItemPrices[item.id] : item.price;

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt-1)', marginBottom: 4 }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--txt-3)', lineHeight: 1.4 }}>
                          {item.desc}
                        </div>
                      </div>

                      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-2)' }}>Precio:</span>
                          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 6, padding: '2px 8px' }}>
                            <span style={{ fontSize: 14 }}></span>
                            <input
                              type="number"
                              min="0"
                              value={currentPrice}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setEditingShopItemPrices(prev => ({ ...prev, [item.id]: val }));
                              }}
                              style={{
                                width: 60,
                                background: 'transparent',
                                border: 'none',
                                color: '#f1c40f',
                                fontWeight: 700,
                                fontSize: 14,
                                padding: '2px 4px',
                                textAlign: 'right',
                              }}
                            />
                            <span style={{ fontSize: 11, color: 'var(--txt-3)', marginLeft: 4 }}>{config.clanCurrencyName || 'GloriCoins'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      for (const [id, price] of Object.entries(editingShopItemPrices)) {
                        await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/clans/shop/${id}/price`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ price }),
                        });
                      }
                      triggerToast(' Precios de la tienda de clanes guardados exitosamente');
                      fetchClans();
                    } catch {
                      triggerToast('✏️ Precios guardados (modo demo)');
                    }
                  }}
                >
                  <Save size={14} /> Guardar Todos los Precios
                </button>
              </div>
            </div>
          </div>

          {/* Formulario para Añadir Producto Personalizado */}
          <div className="section" style={{ marginBottom: 20 }}>
            <div className="section-header">
              <div className="section-header-icon" style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71' }}>
                <Plus size={16} />
              </div>
              <h2>Añadir Nuevo Producto Personalizado a la Tienda</h2>
              <p>Crea ventajas adicionales que tus clanes podrán canjear.</p>
            </div>
            <div className="section-body">
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  if (!newClanShopName.trim()) return;
                  try {
                    await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/clans/shop`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: newClanShopName,
                        price: newClanShopPrice,
                        description: newClanShopDesc,
                        icon: newClanShopIcon,
                      }),
                    });
                    triggerToast(' Nuevo producto añadido a la tienda de clanes');
                    setNewClanShopName('');
                    setNewClanShopDesc('');
                  } catch {
                    triggerToast('Producto simulado añadido');
                  }
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <div className="field">
                    <label>Nombre del Producto</label>
                    <input
                      type="text"
                      placeholder="Ej. Rol Personalizado para Clan"
                      value={newClanShopName}
                      onChange={e => setNewClanShopName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Precio ({config.clanCurrencyName || 'GloriCoins'})</label>
                    <input
                      type="number"
                      min="1"
                      value={newClanShopPrice}
                      onChange={e => setNewClanShopPrice(parseFloat(e.target.value) || 1)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Emoji / Icono Representativo</label>
                    <input
                      type="text"
                      placeholder="Ej. ✨, 🎨, 📜"
                      value={newClanShopIcon}
                      onChange={e => setNewClanShopIcon(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Descripción del Beneficio</label>
                    <input
                      type="text"
                      placeholder="Explicación breve de lo que otorga..."
                      value={newClanShopDesc}
                      onChange={e => setNewClanShopDesc(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" style={{ background: '#2ecc71', borderColor: '#2ecc71' }}>
                    <Plus size={14} /> Añadir Producto a la Tienda
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* SUB-TAB 2: AJUSTES DEL MÓDULO DE CLANES */}
      {clanSubTab === 'settings' && (
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon" style={{ background: 'rgba(88, 101, 242, 0.15)', color: '#5865f2' }}>
              <Shield size={16} />
            </div>
            <h2>Ajustes Generales de Clanes</h2>
            <p>Configura la categoría de voz, el rol máster de líderes y las reglas de horas.</p>
          </div>
          <div className="section-body">
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-1)', margin: 0, height: 20, display: 'flex', alignItems: 'center' }}>
                    Categoría de Voz de Clanes en Discord
                  </label>
                  {structure.categories.length > 0 ? (
                    <select
                      value={config.clansCategoryId || ''}
                      onChange={e => setConfig({ ...config, clansCategoryId: e.target.value })}
                      style={{ height: 42, padding: '0 12px', fontSize: 13, borderRadius: 8 }}
                    >
                      <option value="">Selecciona la categoría</option>
                      {structure.categories.map(cat => (
                        <option key={cat.id} value={cat.id}> {cat.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="ID de la categoría de clanes"
                      value={config.clansCategoryId || ''}
                      onChange={e => setConfig({ ...config, clansCategoryId: e.target.value })}
                      style={{ height: 42, padding: '0 12px', fontSize: 13, borderRadius: 8 }}
                    />
                  )}
                  <span className="hint" style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.3 }}>Categoría donde se ubican las salas de voz de los clanes.</span>
                </div>

                <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-1)', margin: 0, height: 20, display: 'flex', alignItems: 'center' }}>
                    Rol Máster "Líder de Clan"
                  </label>
                  {structure.roles.length > 0 ? (
                    <select
                      value={config.clanLeaderRoleId || ''}
                      onChange={e => setConfig({ ...config, clanLeaderRoleId: e.target.value })}
                      style={{ height: 42, padding: '0 12px', fontSize: 13, borderRadius: 8 }}
                    >
                      <option value="">Selecciona el rol de líder</option>
                      {structure.roles.map(r => (
                        <option key={r.id} value={r.id}> {r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="ID del rol de líder de clan"
                      value={config.clanLeaderRoleId || ''}
                      onChange={e => setConfig({ ...config, clanLeaderRoleId: e.target.value })}
                      style={{ height: 42, padding: '0 12px', fontSize: 13, borderRadius: 8 }}
                    />
                  )}
                  <span className="hint" style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.3 }}>Rol otorgado automáticamente a los líderes de clanes.</span>
                </div>

                <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-1)', margin: 0, height: 20, display: 'flex', alignItems: 'center' }}>
                    Canal de Logs de Clanes
                  </label>
                  {structure.textChannels.length > 0 ? (
                    <select
                      value={config.clansLogChannelId || ''}
                      onChange={e => setConfig({ ...config, clansLogChannelId: e.target.value || null })}
                      style={{ height: 42, padding: '0 12px', fontSize: 13, borderRadius: 8 }}
                    >
                      <option value="">Desactivado (sin canal de logs)</option>
                      {structure.textChannels.map(c => (
                        <option key={c.id} value={c.id}> #{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="ID del canal de logs"
                      value={config.clansLogChannelId || ''}
                      onChange={e => setConfig({ ...config, clansLogChannelId: e.target.value || null })}
                      style={{ height: 42, padding: '0 12px', fontSize: 13, borderRadius: 8 }}
                    />
                  )}
                  <span className="hint" style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.3 }}>Canal donde se notificarán compras en tienda y avisos.</span>
                </div>

                <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-1)', margin: 0, height: 20, display: 'flex', alignItems: 'center' }}>
                    Nombre de la Moneda del Clan
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. GloriCoins"
                    value={config.clanCurrencyName || 'GloriCoins'}
                    onChange={e => setConfig({ ...config, clanCurrencyName: e.target.value })}
                    style={{ height: 42, padding: '0 12px', fontSize: 13, borderRadius: 8 }}
                  />
                  <span className="hint" style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.3 }}>Divisa utilizada para comprar ventajas en la tienda de clanes.</span>
                </div>

                <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-1)', margin: 0, height: 20, display: 'flex', alignItems: 'center' }}>
                    Monedas Ganadas por Hora
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Ej. 1"
                    value={config.clanCoinsPerHour ?? 1}
                    onChange={e => setConfig({ ...config, clanCoinsPerHour: parseFloat(e.target.value) || 0 })}
                    style={{ height: 42, padding: '0 12px', fontSize: 13, borderRadius: 8 }}
                  />
                  <span className="hint" style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.3 }}>Monedas generadas por cada hora acumulada en llamada de voz.</span>
                </div>

                <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-1)', margin: 0, height: 20, display: 'flex', alignItems: 'center' }}>
                    Mensaje de Reclamación en Ticket (Tienda)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. ️ Abre un ticket de soporte para reclamar tu ítem..."
                    value={config.clanShopTicketMessage ?? '️ Abre un ticket de soporte con el Staff para entregar los archivos de tu item comprado.'}
                    onChange={e => setConfig({ ...config, clanShopTicketMessage: e.target.value })}
                    style={{ height: 42, padding: '0 12px', fontSize: 13, borderRadius: 8 }}
                  />
                  <span className="hint" style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.3 }}>Mensaje mostrado al líder tras comprar ítems que requieren staff (Emoji, Pegatina, Soundboard).</span>
                </div>

                <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-1)', margin: 0, height: 20, display: 'flex', alignItems: 'center' }}>
                    Modo de Cálculo de Meta Mensual de Horas
                  </label>
                  <div style={{ display: 'flex', gap: 8, height: 42, alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setConfig({ ...config, clanGoalMode: 'FIXED' })}
                      style={{
                        flex: 1,
                        height: '100%',
                        background: (config.clanGoalMode || 'FIXED') === 'FIXED' ? 'var(--accent)' : 'var(--surface-2)',
                        color: (config.clanGoalMode || 'FIXED') === 'FIXED' ? '#fff' : 'var(--txt-2)',
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 8,
                        whiteSpace: 'nowrap',
                      }}
                    >
                       Fijas / Clan
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={() => setConfig({ ...config, clanGoalMode: 'PER_MEMBER' })}
                      style={{
                        flex: 1,
                        height: '100%',
                        background: config.clanGoalMode === 'PER_MEMBER' ? 'var(--accent)' : 'var(--surface-2)',
                        color: config.clanGoalMode === 'PER_MEMBER' ? '#fff' : 'var(--txt-2)',
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 8,
                        whiteSpace: 'nowrap',
                      }}
                    >
                       Por Miembro
                    </button>
                  </div>
                  <span className="hint" style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.3 }}>
                    {(config.clanGoalMode || 'FIXED') === 'FIXED'
                      ? ' Meta fija global.'
                      : ' Meta según número de miembros.'}
                  </span>
                </div>

                {(config.clanGoalMode || 'FIXED') === 'FIXED' ? (
                  <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-1)', margin: 0, height: 20, display: 'flex', alignItems: 'center' }}>
                      Horas Mínimas Fijas por Clan (Mes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ej. 100"
                      value={config.monthlyClanHoursGoal ?? 100}
                      onChange={e => setConfig({ ...config, monthlyClanHoursGoal: parseInt(e.target.value, 10) || 0 })}
                      style={{ height: 42, padding: '0 12px', fontSize: 13, borderRadius: 8 }}
                    />
                    <span className="hint" style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.3 }}>Meta fija que todo clan debe cumplir al mes para mantener su rol/canal.</span>
                  </div>
                ) : (
                  <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-1)', margin: 0, height: 20, display: 'flex', alignItems: 'center' }}>
                      Horas Mínimas Exigidas por Cada Miembro
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ej. 10"
                      value={config.clanHoursPerMember ?? 10}
                      onChange={e => setConfig({ ...config, clanHoursPerMember: parseInt(e.target.value, 10) || 0 })}
                      style={{ height: 42, padding: '0 12px', fontSize: 13, borderRadius: 8 }}
                    />
                    <span className="hint" style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.3 }}>Meta dinámica (ej. 10 miembros x 10h = 100h mínimas requeridas).</span>
                  </div>
                )}
              </div>

              <div className="actions" style={{ marginTop: 20 }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> Guardar Ajustes de Clanes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: LISTA Y ADMINISTRACIÓN DE CLANES */}
      {clanSubTab === 'list' && (
        <div className="section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="section-header-icon"><Shield size={16} /></div>
              <h2>Administración de Clanes ({clans.length})</h2>
              <p>Monitorea las horas acumuladas, miembros registrados y añade o importa clanes.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn" style={{ background: 'rgba(52, 152, 219, 0.15)', color: '#3498db', border: '1px solid rgba(52, 152, 219, 0.3)' }} onClick={openImportModal}>
                 Importar Clan Existente
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setClanModalOpen(true)}>
                <Plus size={14} /> Crear Nuevo Clan
              </button>
            </div>
          </div>

          <div className="section-body" style={{ padding: 0 }}>
            {clans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--txt-3)' }}>
                No hay clanes registrados en este servidor. ¡Crea o importa uno para empezar!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                {clans.map(clan => {
                  const isExpanded = expandedClanId === clan.id;

                  return (
                    <div
                      key={clan.id}
                      style={{
                        background: 'var(--surface-2)',
                        border: `1px solid ${isExpanded ? clan.colorHex : 'var(--border)'}`,
                        borderRadius: 10,
                        padding: 16,
                        transition: 'all 0.2s',
                      }}
                    >
                      {/* Encabezado del Clan */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 14,
                              height: 40,
                              borderRadius: 6,
                              background: clan.colorHex,
                              boxShadow: `0 0 10px ${clan.colorHex}88`,
                            }}
                          />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt-1)', margin: 0 }}>
                                {clan.name}
                              </h3>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  background: `${clan.colorHex}22`,
                                  color: clan.colorHex,
                                  border: `1px solid ${clan.colorHex}44`,
                                }}
                              >
                                Rol: {clan.roleId}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--txt-3)', marginTop: 2 }}>
                               Líder: <strong>{clan.leaderName}</strong> |  <strong>{clan.membersCount} miembro(s)</strong> |  Canal: <code style={{ fontSize: 11 }}>{clan.voiceChannelId}</code>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ background: `${clan.colorHex}dd`, borderColor: clan.colorHex }}
                            onClick={() => setActiveClanDetailId(clan.id)}
                          >
                             Abrir Ficha del Clan
                          </button>

                          <button
                            type="button"
                            className="btn"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}
                            onClick={() => setExpandedClanId(isExpanded ? null : clan.id)}
                          >
                            <Users size={14} />
                            {isExpanded ? 'Ocultar' : 'Miembros'}
                            <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '8px 10px' }}
                            title="Eliminar Clan de Discord y Base de Datos"
                            onClick={() => handleDeleteClan(clan.id, clan.name)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Desglose Desplegable de Integrantes */}
                      {isExpanded && (
                        <div
                          style={{
                            marginTop: 16,
                            paddingTop: 16,
                            borderTop: '1px solid var(--border)',
                          }}
                        >
                          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt-2)', marginBottom: 10 }}>
                             Desglose de Horas por Miembro (Mes Actual)
                          </h4>
                          {clan.members.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--txt-3)' }}>Sin datos de miembros registrados.</p>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                              {clan.members.map(m => (
                                <div
                                  key={m.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    background: 'var(--surface)',
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--border-2)',
                                  }}
                                >
                                  <img
                                    src={m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                                    alt="avatar"
                                    style={{ width: 28, height: 28, borderRadius: '50%' }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {m.displayName} {m.userId === clan.leaderId ? '' : ''}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>
                                       <strong>{m.hoursSpent}h</strong> acumuladas
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
