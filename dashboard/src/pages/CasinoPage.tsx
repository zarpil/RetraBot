import React from 'react';
import type { CasinoSubTab, GuildConfig, ServerStructure } from '../types';
import { Save, Trash2, Plus } from 'lucide-react';

interface CasinoPageProps {
  casinoSubTab: CasinoSubTab;
  setCasinoSubTab: (tab: CasinoSubTab) => void;
  config: GuildConfig;
  setConfig: React.Dispatch<React.SetStateAction<GuildConfig>>;
  structure: ServerStructure;
  handleSave: (e: React.FormEvent) => void;
  getCsvArray: (csvString?: string | null) => string[];
  addCsvItem: (csvString: string | null | undefined, newId: string) => string;
  removeCsvItem: (csvString: string | null | undefined, targetId: string) => string;
  shopCategory: 'roles' | 'items';
  setShopCategory: (cat: 'roles' | 'items') => void;
  handleAddShopRole: (e: React.FormEvent) => void;
  handleDeleteShopRole: (id?: string) => void;
  handleAddShopItem: (e: React.FormEvent) => void;
  handleDeleteShopItem: (id?: string) => void;
  handleAddRoleIncome: (e: React.FormEvent) => void;
  handleDeleteRoleIncome: (id?: string) => void;
  handleSeasonReset: () => void;
  newShopIcon: string;
  setNewShopIcon: (icon: string) => void;
  newShopRoleId: string;
  setNewShopRoleId: (roleId: string) => void;
  newShopPrice: number;
  setNewShopPrice: (price: number) => void;
  newShopDescription: string;
  setNewShopDescription: (desc: string) => void;
  newShopItemIcon: string;
  setNewShopItemIcon: (icon: string) => void;
  newShopItemName: string;
  setNewShopItemName: (name: string) => void;
  newShopItemPrice: number;
  setNewShopItemPrice: (price: number) => void;
  newShopItemRarity: string;
  setNewShopItemRarity: (rarity: string) => void;
  newShopItemDesc: string;
  setNewShopItemDesc: (desc: string) => void;
  newIncomeRoleId: string;
  setNewIncomeRoleId: (roleId: string) => void;
  newIncomeAmount: number;
  setNewIncomeAmount: (amount: number) => void;
  newIncomeHours: number;
  setNewIncomeHours: (hours: number) => void;
  newIncomeIsSeasonal: boolean;
  setNewIncomeIsSeasonal: (isSeasonal: boolean) => void;
  seasonalEdits: Record<string, { name: string; color: string; icon?: string; price?: number; description?: string; incomeAmount?: number }>;
  setSeasonalEdits: React.Dispatch<React.SetStateAction<Record<string, { name: string; color: string; icon?: string; price?: number; description?: string; incomeAmount?: number }>>>;
  resetConfirmed: boolean;
  setResetConfirmed: (confirmed: boolean) => void;
}

export const CasinoPage: React.FC<CasinoPageProps> = ({
  casinoSubTab,
  setCasinoSubTab,
  config,
  setConfig,
  structure,
  handleSave,
  getCsvArray,
  addCsvItem,
  removeCsvItem,
  shopCategory,
  setShopCategory,
  handleAddShopRole,
  handleDeleteShopRole,
  handleAddShopItem,
  handleDeleteShopItem,
  handleAddRoleIncome,
  handleDeleteRoleIncome,
  handleSeasonReset,
  newShopIcon,
  setNewShopIcon,
  newShopRoleId,
  setNewShopRoleId,
  newShopPrice,
  setNewShopPrice,
  newShopDescription,
  setNewShopDescription,
  newShopItemIcon,
  setNewShopItemIcon,
  newShopItemName,
  setNewShopItemName,
  newShopItemPrice,
  setNewShopItemPrice,
  newShopItemRarity,
  setNewShopItemRarity,
  newShopItemDesc,
  setNewShopItemDesc,
  newIncomeRoleId,
  setNewIncomeRoleId,
  newIncomeAmount,
  setNewIncomeAmount,
  newIncomeHours,
  setNewIncomeHours,
  newIncomeIsSeasonal,
  setNewIncomeIsSeasonal,
  seasonalEdits,
  setSeasonalEdits,
  resetConfirmed,
  setResetConfirmed,
}) => {
  return (
    <div className="page-body">
      {/* Sub-Pestañas Superiores de Navegación Rápida */}
      <div className="subtab-bar">
        {([
          ['general', '⚙️ General & Canales'],
          ['work', ' Work (!work)'],
          ['crime', '️ Crime (!crime)'],
          ['slut', ' Slut (!slut)'],
          ['rob', ' Robos (!rob)'],
          ['chicken', ' Pelea de Gallos'],
          ['shop', ' Tienda de Roles (!shop)'],
          ['income', ' Ingresos por Roles'],
          ['reset', '⚠️ Nueva Temporada'],
        ] as [CasinoSubTab, string][]).map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={`subtab-btn ${casinoSubTab === id ? 'active' : ''}`}
            onClick={() => setCasinoSubTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 1. SUBTAB: GENERAL & CANALES */}
      {casinoSubTab === 'general' && (
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon" style={{ background: 'rgba(241, 196, 15, 0.15)', color: '#f1c40f' }}></div>
            <h2>Configuración General & Canales</h2>
            <p>Activa el módulo, ajusta la divisa del servidor y restringe las salas de juego.</p>
          </div>
          <div className="section-body">
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="field">
                  <label>Estado del Módulo</label>
                  <div className="toggle-wrapper">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={config.economyEnabled ?? true}
                        onChange={e => setConfig({ ...config, economyEnabled: e.target.checked })}
                      />
                      <span className="slider" />
                    </label>
                    <span className="hint">Habilitar/Deshabilitar casino y economía global</span>
                  </div>
                </div>

                <div className="field">
                  <label>Símbolo de Moneda</label>
                  <input
                    type="text"
                    value={config.currencySymbol || ''}
                    onChange={e => setConfig({ ...config, currencySymbol: e.target.value })}
                    placeholder="ej. , , , "
                  />
                </div>

                <div className="field">
                  <label>Dinero Inicial de Nuevos Usuarios / Reinicio ({config.currencySymbol || ''})</label>
                  <input
                    type="number"
                    step={100}
                    value={config.startingBalance ?? 1000}
                    onChange={e => setConfig({ ...config, startingBalance: +e.target.value })}
                  />
                </div>
              </div>

              <div className="field" style={{ marginTop: 16 }}>
                <label>Canales Permitidos para Jugar (opcional)</label>
                <div className="tag-group" style={{ marginBottom: 8 }}>
                  {getCsvArray(config.casinoChannels).length === 0 ? (
                    <span className="hint">Sin restricción (todos los canales de texto permitidos)</span>
                  ) : (
                    getCsvArray(config.casinoChannels).map(chId => {
                      const ch = structure.textChannels.find(c => c.id === chId);
                      return (
                        <span className="tag-chip" key={chId}>
                          #{ch ? ch.name : chId}
                          <button
                            type="button"
                            className="tag-chip-remove"
                            onClick={() => setConfig({ ...config, casinoChannels: removeCsvItem(config.casinoChannels, chId) })}
                          >
                            ✖
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>

                {structure.textChannels && structure.textChannels.length > 0 && (
                  <select
                    value=""
                    onChange={e => {
                      if (e.target.value) {
                        setConfig({ ...config, casinoChannels: addCsvItem(config.casinoChannels, e.target.value) });
                      }
                    }}
                  >
                    <option value="">➕ Añadir canal de juego...</option>
                    {structure.textChannels
                      .filter(c => !getCsvArray(config.casinoChannels).includes(c.id))
                      .map(c => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                  </select>
                )}
                <span className="hint">
                  Si añades canales, los comandos <code>!work</code>, <code>!bj</code>, <code>!dep</code>, <code>!rob</code>, etc., solo funcionarán en esas salas. El Staff puede usarlos en cualquier sitio.
                </span>
              </div>

              <div className="field" style={{ marginTop: 16 }}>
                <label> Dificultad y Recompensas de la Tragaperras (`!sm` / `!slot`)</label>
                <select
                  value={config.slotMachineDifficulty || 'NORMAL'}
                  onChange={e => setConfig({ ...config, slotMachineDifficulty: e.target.value })}
                  style={{ height: 42, fontSize: 14 }}
                >
                  <option value="NORMAL">⚖️ Modo Normal (Estándar Casino: Multiplicadores x2 a x10)</option>
                  <option value="EASY"> Modo Fácil (Más Premios: Multiplicadores x2.5 a x15 + 25% Ayuda de Reroll)</option>
                  <option value="VERY_EASY"> Modo Súper Fácil (Modo Regalo: Multiplicadores x3 a x25 + 50% Ayuda de Reroll)</option>
                </select>
                <span className="hint">
                  Cambia las probabilidades de ganar dinero en la tragaperras (<code>!sm</code>) y ajusta automáticamente la cuantía de los premios.
                </span>
              </div>

              <div className="field" style={{ marginTop: 16 }}>
                <label> Rol de Ganador de Temporada</label>
                {structure.roles && structure.roles.length > 0 ? (
                  <select
                    value={config.seasonWinnerRoleId || ''}
                    onChange={e => setConfig({ ...config, seasonWinnerRoleId: e.target.value || null })}
                    style={{ height: 42, fontSize: 14 }}
                  >
                    <option value=""> Ningún rol (No otorgar rol de ganador)</option>
                    {structure.roles.map(r => (
                      <option key={r.id} value={r.id}>@{r.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="ID del rol de ganador de temporada"
                    value={config.seasonWinnerRoleId || ''}
                    onChange={e => setConfig({ ...config, seasonWinnerRoleId: e.target.value || null })}
                  />
                )}
                <span className="hint">
                  Este rol se otorgará automáticamente al usuario #1 en la clasificación de economía al ejecutar <b>"Iniciar Nueva Temporada"</b>.
                </span>
              </div>

              <div className="actions" style={{ marginTop: 20 }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> Guardar Ajustes Generales
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. SUBTAB: WORK (!work) */}
      {casinoSubTab === 'work' && (
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon" style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71' }}></div>
            <h2>Comando Trabajar (`!work`)</h2>
            <p>Ajusta el sueldo aleatorio, el tiempo de espera y las frases de respuesta.</p>
          </div>
          <div className="section-body">
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="field">
                  <label>Ganancia Mínima ({config.currencySymbol || ''})</label>
                  <input
                    type="number"
                    value={config.workMinPayout ?? 1000}
                    onChange={e => setConfig({ ...config, workMinPayout: +e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Ganancia Máxima ({config.currencySymbol || ''})</label>
                  <input
                    type="number"
                    value={config.workMaxPayout ?? 5000}
                    onChange={e => setConfig({ ...config, workMaxPayout: +e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Cooldown (segundos)</label>
                  <input
                    type="number"
                    value={config.workCooldownSec ?? 1800}
                    onChange={e => setConfig({ ...config, workCooldownSec: +e.target.value })}
                  />
                  <span className="hint">1800s = 30 min por defecto</span>
                </div>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label>Mensajes Personalizados de Respuesta para `!work` (uno por línea)</label>
                <textarea
                  rows={6}
                  placeholder={`Has trabajado de camarero en la discoteca\nHas limpiado el canal de voz\nHas vendido bocadillos y has ganado {amount}`}
                  value={config.workMessages || ''}
                  onChange={e => setConfig({ ...config, workMessages: e.target.value })}
                />
                <span className="hint">
                  Escribe un mensaje por línea. El bot elegirá uno al azar cada vez. Puedes incluir la variable <code>{"{amount}"}</code> para posicionar el dinero exacto ganado.
                </span>
              </div>

              <div className="actions" style={{ marginTop: 16 }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> Guardar Ajustes de Trabajar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. SUBTAB: CRIME (!crime) */}
      {casinoSubTab === 'crime' && (
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon" style={{ background: 'rgba(231, 76, 60, 0.15)', color: '#e74c3c' }}>️</div>
            <h2>Comando Delito (`!crime`)</h2>
            <p>Ajusta el botún aleatorio, tiempo de recarga y mensajes personalizados de victoria y fracaso.</p>
          </div>
          <div className="section-body">
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="field">
                  <label>Botón Mínimo ({config.currencySymbol || ''})</label>
                  <input
                    type="number"
                    value={config.crimeMinPayout ?? 1500}
                    onChange={e => setConfig({ ...config, crimeMinPayout: +e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Botón Máximo ({config.currencySymbol || ''})</label>
                  <input
                    type="number"
                    value={config.crimeMaxPayout ?? 5500}
                    onChange={e => setConfig({ ...config, crimeMaxPayout: +e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Probabilidad Éxito (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.crimeSuccessPercent ?? 55}
                    onChange={e => setConfig({ ...config, crimeSuccessPercent: +e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Cooldown (segundos)</label>
                  <input
                    type="number"
                    value={config.crimeCooldownSec ?? 3600}
                    onChange={e => setConfig({ ...config, crimeCooldownSec: +e.target.value })}
                  />
                  <span className="hint">3600s = 1 hora por defecto</span>
                </div>
              </div>

              <div className="form-row" style={{ marginTop: 12 }}>
                <div className="field">
                  <label> Frases de XITO / GANAR (uno por línea)</label>
                  <textarea
                    rows={5}
                    placeholder={`Has atracado un banco y has conseguido {amount}\nHas hackeado el cajero automático y te has llevado {amount}`}
                    value={config.crimeMessages || ''}
                    onChange={e => setConfig({ ...config, crimeMessages: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label> Frases de FRACASO / PERDER (uno por línea)</label>
                  <textarea
                    rows={5}
                    placeholder={`La policía te tenía acorralado y te ha multado con {amount}\nUn dron policial te ha cazado e incautado {amount}`}
                    value={config.crimeFailMessages || ''}
                    onChange={e => setConfig({ ...config, crimeFailMessages: e.target.value })}
                  />
                </div>
              </div>

              <div className="actions" style={{ marginTop: 16 }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> Guardar Ajustes de Crimen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. SUBTAB: SLUT (!slut) */}
      {casinoSubTab === 'slut' && (
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon" style={{ background: 'rgba(155, 89, 182, 0.15)', color: '#9b59b6' }}></div>
            <h2>Comando Trabajo Nocturno (`!slut`)</h2>
            <p>Ajusta las propinas, cooldown y respuestas personalizadas de victoria y fracaso.</p>
          </div>
          <div className="section-body">
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="field">
                  <label>Propina Mínima ({config.currencySymbol || ''})</label>
                  <input
                    type="number"
                    value={config.slutMinPayout ?? 1200}
                    onChange={e => setConfig({ ...config, slutMinPayout: +e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Propina Máxima ({config.currencySymbol || ''})</label>
                  <input
                    type="number"
                    value={config.slutMaxPayout ?? 4700}
                    onChange={e => setConfig({ ...config, slutMaxPayout: +e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Probabilidad Éxito (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.slutSuccessPercent ?? 60}
                    onChange={e => setConfig({ ...config, slutSuccessPercent: +e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Cooldown (segundos)</label>
                  <input
                    type="number"
                    value={config.slutCooldownSec ?? 2700}
                    onChange={e => setConfig({ ...config, slutCooldownSec: +e.target.value })}
                  />
                  <span className="hint">2700s = 45 min por defecto</span>
                </div>
              </div>

              <div className="form-row" style={{ marginTop: 12 }}>
                <div className="field">
                  <label> Frases de XITO / GANAR (uno por línea)</label>
                  <textarea
                    rows={5}
                    placeholder={`Has salido a la calle y te han dejado {amount} de propina\nHas bailado en la fiesta VIP y ganaste {amount}`}
                    value={config.slutMessages || ''}
                    onChange={e => setConfig({ ...config, slutMessages: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label> Frases de FRACASO / PERDER (uno por línea)</label>
                  <textarea
                    rows={5}
                    placeholder={`Al llevar tanto dinero en el bolsillo te han asaltado y has perdido {amount}\nTe han puesto una multa por alteración del orden de {amount}`}
                    value={config.slutFailMessages || ''}
                    onChange={e => setConfig({ ...config, slutFailMessages: e.target.value })}
                  />
                </div>
              </div>

              <div className="actions" style={{ marginTop: 16 }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> Guardar Ajustes de Slut
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. SUBTAB: ROBOS (!rob) */}
      {casinoSubTab === 'rob' && (
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon" style={{ background: 'rgba(230, 126, 34, 0.15)', color: '#e67e22' }}></div>
            <h2>Robos entre Usuarios (`!rob`)</h2>
            <p>Ajusta el tiempo de recarga entre atracos.</p>
          </div>
          <div className="section-body">
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="field">
                  <label>Cooldown de Robo (segundos)</label>
                  <input
                    type="number"
                    value={config.robCooldownSec ?? 3600}
                    onChange={e => setConfig({ ...config, robCooldownSec: +e.target.value })}
                  />
                  <span className="hint">3600s = 1 hora entre robos</span>
                </div>
                <div className="field">
                  <label>% Mínimo del Efectivo Robado</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.robMinPercent ?? 20}
                    onChange={e => setConfig({ ...config, robMinPercent: +e.target.value })}
                  />
                  <span style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 4 }}>Porcentaje mínimo que se le quitará a la víctima (Ej. 20%)</span>
                </div>
                <div className="field">
                  <label>% Máximo del Efectivo Robado</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.robMaxPercent ?? 80}
                    onChange={e => setConfig({ ...config, robMaxPercent: +e.target.value })}
                  />
                  <span style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 4 }}>Porcentaje máximo que se le quitará a la víctima (Ej. 80%)</span>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 14, marginTop: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--txt-1)', lineHeight: 1.5 }}>
                  ⚖️ <strong>Riesgo Proporcional a la Riqueza:</strong> Cuanto más dinero en efectivo lleve el ladrón en el bolsillo, menor será su probabilidad de éxito:
                  <br />
                   &lt; 10k: <strong>75% éxito</strong> |  ≥ 10k: <strong>65% éxito</strong> |  ≥ 50k: <strong>50% éxito</strong> |  ≥ 250k: <strong>35% éxito</strong> |  ≥ 1m: <strong>20% éxito</strong>.
                  <br />
                  <em>Si un ladrón es atrapado, sufrirá una multa policial del 25% de su propio dinero en efectivo.</em>
                </p>
              </div>

              <div className="actions" style={{ marginTop: 16 }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> Guardar Ajustes de Robos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. SUBTAB: GALLORPG */}
      {casinoSubTab === 'chicken' && (
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon" style={{ background: 'rgba(230, 126, 34, 0.15)', color: '#e67e22' }}></div>
            <h2>Configuración del Mini-RPG de Gallos (GalloRPG)</h2>
            <p>Ajusta el precio de compra, consumibles de la tienda, Árbol de gimnasio y probabilidad de lesiones.</p>
          </div>
          <div className="section-body">
            <form onSubmit={handleSave}>
              {/* BLOQUE 1: CRIANZA Y NACIMIENTO */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 18, marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#e67e22', display: 'flex', alignItems: 'center', gap: 8 }}>
                   1. Crianza, Nacimiento y Nombres
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <div className="field">
                    <label>Precio de Compra por Gallo ({config.currencySymbol || ''})</label>
                    <input
                      type="number"
                      value={config.chickenCost || 5000}
                      onChange={e => setConfig({ ...config, chickenCost: +e.target.value })}
                    />
                    <span className="hint">Precio para comprar 1 gallo (máx 3 por usuario).</span>
                  </div>

                  <div className="field">
                    <label>WinRate Mínimo de Nacimiento (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.chickenMinBirthWinRate ?? 40}
                      onChange={e => setConfig({ ...config, chickenMinBirthWinRate: e.target.value === '' ? undefined : +e.target.value })}
                    />
                    <span className="hint">Límite mínimo de WinRate inicial al nacer.</span>
                  </div>

                  <div className="field">
                    <label>WinRate Máximo de Nacimiento (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.chickenMaxBirthWinRate ?? 60}
                      onChange={e => setConfig({ ...config, chickenMaxBirthWinRate: e.target.value === '' ? undefined : +e.target.value })}
                    />
                    <span className="hint">Límite máximo de WinRate inicial al nacer.</span>
                  </div>
                </div>

                <div className="field" style={{ marginTop: 12 }}>
                  <label>Nombres por Defecto para Gallos</label>
                  <input
                    type="text"
                    placeholder="Separados por comas (ej: El Espolón Rojo, Cresta de Acero, El Asesióno)"
                    value={config.chickenNames || ''}
                    onChange={e => setConfig({ ...config, chickenNames: e.target.value })}
                  />
                  <span className="hint">Lista de nombres aleatorios que el bot asigna al comprar un gallo.</span>
                </div>
              </div>

              {/* BLOQUE 2: TIENDA DE CONSUMIBLES Y OBJETOS */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 18, marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#f1c40f', display: 'flex', alignItems: 'center', gap: 8 }}>
                   2. Tienda de Objetos de Combate
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <div className="field">
                    <label>Precio de Pienso Proteico ({config.currencySymbol || ''})</label>
                    <input
                      type="number"
                      value={config.piensoCost ?? 3000}
                      onChange={e => setConfig({ ...config, piensoCost: +e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Duración del Pienso (minutos)</label>
                    <input
                      type="number"
                      value={config.piensoDurationMins ?? 30}
                      onChange={e => setConfig({ ...config, piensoDurationMins: +e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Boost de Pienso (% Fuerza extra)</label>
                    <input
                      type="number"
                      value={config.piensoBoostPercent ?? 15}
                      onChange={e => setConfig({ ...config, piensoBoostPercent: +e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Precio Suplemento Vitamínico ({config.currencySymbol || ''})</label>
                    <input
                      type="number"
                      value={config.vitaminCost ?? 2500}
                      onChange={e => setConfig({ ...config, vitaminCost: +e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Boost de Vitamina (% WinRate extra)</label>
                    <input
                      type="number"
                      value={config.vitaminBoostPercent ?? 5}
                      onChange={e => setConfig({ ...config, vitaminBoostPercent: +e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Precio Botiquín de Curación ({config.currencySymbol || ''})</label>
                    <input
                      type="number"
                      value={config.medkitCost ?? 2500}
                      onChange={e => setConfig({ ...config, medkitCost: +e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Precio Vendas de Espolón ({config.currencySymbol || ''})</label>
                    <input
                      type="number"
                      value={config.bandageCost ?? 5000}
                      onChange={e => setConfig({ ...config, bandageCost: +e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* BLOQUE 3: INSTALACIONES DEL GIMNASIO (4 RAMAS) */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 18, marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#3498db', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ️ 3. Árbol de Instalaciones del Gimnasio
                </h3>
                
                {/* Ramas de Gimnasio */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  {/* Rama 1: Capacidad */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: 12, borderRadius: 8 }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#2ecc71' }}> Rama Capacidad</h4>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Desbloqueo Jaula (1 Plaza)</label>
                      <input
                        type="number"
                        value={config.cageCost ?? 15000}
                        onChange={e => setConfig({ ...config, cageCost: +e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Ampliación Nivel 2 (2 Plazas)</label>
                      <input
                        type="number"
                        value={config.cageCapacityLvl2Cost ?? 40000}
                        onChange={e => setConfig({ ...config, cageCapacityLvl2Cost: +e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 12 }}>Ampliación Nivel 3 (3 Plazas)</label>
                      <input
                        type="number"
                        value={config.cageCapacityLvl3Cost ?? 80000}
                        onChange={e => setConfig({ ...config, cageCapacityLvl3Cost: +e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Rama 2: Musculación */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: 12, borderRadius: 8 }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#e74c3c' }}> Rama Musculación</h4>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Nivel 1 (+25% Fuerza)</label>
                      <input
                        type="number"
                        value={config.cageMuscleLvl1Cost ?? 10000}
                        onChange={e => setConfig({ ...config, cageMuscleLvl1Cost: +e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Nivel 2 (+50% Fuerza)</label>
                      <input
                        type="number"
                        value={config.cageMuscleLvl2Cost ?? 25000}
                        onChange={e => setConfig({ ...config, cageMuscleLvl2Cost: +e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 12 }}>Nivel 3 (+100% Fuerza)</label>
                      <input
                        type="number"
                        value={config.cageMuscleLvl3Cost ?? 50000}
                        onChange={e => setConfig({ ...config, cageMuscleLvl3Cost: +e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Rama 3: Cardio */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: 12, borderRadius: 8 }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#f1c40f' }}> Rama Cardio & Velocidad</h4>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Nivel 1 (-25% Tiempo Entreno)</label>
                      <input
                        type="number"
                        value={config.cageCardioLvl1Cost ?? 12000}
                        onChange={e => setConfig({ ...config, cageCardioLvl1Cost: +e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Nivel 2 (-50% Tiempo Entreno)</label>
                      <input
                        type="number"
                        value={config.cageCardioLvl2Cost ?? 30000}
                        onChange={e => setConfig({ ...config, cageCardioLvl2Cost: +e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 12 }}>Nivel 3 (-75% Tiempo Entreno)</label>
                      <input
                        type="number"
                        value={config.cageCardioLvl3Cost ?? 60000}
                        onChange={e => setConfig({ ...config, cageCardioLvl3Cost: +e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Rama 4: Fisioterapia */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: 12, borderRadius: 8 }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#9b59b6' }}> Rama Fisioterapia</h4>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Nivel 1 (-50% Lesión)</label>
                      <input
                        type="number"
                        value={config.cagePhysioLvl1Cost ?? 20000}
                        onChange={e => setConfig({ ...config, cagePhysioLvl1Cost: +e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Nivel 2 (-75% Lesión)</label>
                      <input
                        type="number"
                        value={config.cagePhysioLvl2Cost ?? 45000}
                        onChange={e => setConfig({ ...config, cagePhysioLvl2Cost: +e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 12 }}>Nivel 3 (Inmune a Lesión)</label>
                      <input
                        type="number"
                        value={config.cagePhysioLvl3Cost ?? 90000}
                        onChange={e => setConfig({ ...config, cagePhysioLvl3Cost: +e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOQUE 4: LESIONES Y REPOSO */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 18, marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#e74c3c', display: 'flex', alignItems: 'center', gap: 8 }}>
                   4. Lesiones y Tiempo de Reposo
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <div className="field">
                    <label>Probabilidad de Lesión al Ganar (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={config.chickenInjuryChance ?? 15}
                      onChange={e => setConfig({ ...config, chickenInjuryChance: +e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Tiempo de Reposo por Lesión (minutos)</label>
                    <input
                      type="number"
                      value={config.chickenInjuryMins ?? 5}
                      onChange={e => setConfig({ ...config, chickenInjuryMins: +e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="actions">
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> Guardar Ajustes de Gallos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. SUBTAB: TIENDA DE ROLES (!shop) */}
      {casinoSubTab === 'shop' && (
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon" style={{ background: 'rgba(241, 196, 15, 0.15)', color: '#f1c40f' }}></div>
            <h2>Tienda del Casino (`!shop` / `!buy [nombre]` / `!inventory`)</h2>
            <p>Añade roles de Discord y objetos coleccionables exclusivos a la venta para tus usuarios.</p>
          </div>
          <div className="section-body">
            {/* Categorías internas de la tienda */}
            <div className="subtab-bar" style={{ borderBottom: 'none', marginBottom: 12 }}>
              <button
                type="button"
                className={`subtab-btn ${shopCategory === 'roles' ? 'active' : ''}`}
                onClick={() => setShopCategory('roles')}
              >
                 Roles de Temporada ({config.shopRoles?.length || 0})
              </button>
              <button
                type="button"
                className={`subtab-btn ${shopCategory === 'items' ? 'active' : ''}`}
                onClick={() => setShopCategory('items')}
              >
                 Objetos Coleccionables Exclusivos ({config.shopItems?.length || 0})
              </button>
            </div>

            {/* 1. SECCION: ROLES EN VENTA */}
            {shopCategory === 'roles' && (
              <>
                <div style={{ background: 'rgba(241, 196, 15, 0.1)', border: '1px solid rgba(241, 196, 15, 0.25)', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#f1c40f', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span></span> <b>Roles Exclusivos de Temporada:</b> Todos los roles configurados en esta tienda se consideran de temporada. Al reiniciaráá la economía para la nueva temporada, el bot se los quitará a los usuarios para que puedan volver a ser comprados.
                </div>
                <form onSubmit={handleAddShopRole} className="form-row" style={{ marginBottom: 16 }}>
                  <div className="field" style={{ maxWidth: 100 }}>
                    <label>Emoji / Icono</label>
                    <input
                      type="text"
                      value={newShopIcon}
                      onChange={e => setNewShopIcon(e.target.value || '')}
                      placeholder="ej. , ️, , "
                    />
                  </div>
                  <div className="field">
                    <label>Rol de Discord</label>
                    {structure.roles && structure.roles.length > 0 ? (
                      <select value={newShopRoleId} onChange={e => setNewShopRoleId(e.target.value)}>
                        <option value="">Selecciona un rol</option>
                        {structure.roles.map(r => (
                          <option key={r.id} value={r.id}>@{r.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="ID del rol"
                        value={newShopRoleId}
                        onChange={e => setNewShopRoleId(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="field">
                    <label>Precio de Compra ({config.currencySymbol || ''})</label>
                    <input
                      type="number"
                      step={10000}
                      value={newShopPrice}
                      onChange={e => setNewShopPrice(+e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ flex: 2 }}>
                    <label>Descripción / Beneficio del Rol</label>
                    <input
                      type="text"
                      placeholder="ej. Rol de la temática de la temporada actual"
                      value={newShopDescription}
                      onChange={e => setNewShopDescription(e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ maxWidth: 120, justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary" style={{ height: 38 }}>
                      <Plus size={14} /> Crear Rol
                    </button>
                  </div>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(!config.shopRoles || config.shopRoles.length === 0) ? (
                    <div className="empty" style={{ padding: 16 }}>Sin roles configurados en la tienda</div>
                  ) : (
                    config.shopRoles.map(sr => {
                      const matchedRole = structure.roles.find(r => r.id === sr.roleId);
                      const matchedIncome = (config.roleIncomes || []).find(ri => ri.roleId === sr.roleId);

                      return (
                        <div className="income-role-card" key={sr.id || sr.roleId} style={{ gap: 12 }}>
                          <div style={{ fontSize: 20 }}>{sr.icon || ''}</div>
                          <div className="income-role-info" style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="income-role-badge" style={{ borderColor: matchedRole?.color || 'var(--accent)', color: matchedRole?.color || '#ffffff' }}>
                                @{matchedRole ? matchedRole.name : `ID: ${sr.roleId}`}
                              </span>
                              {matchedIncome && (
                                <span className="badge" style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', borderRadius: 4 }}>
                                   Pasivo: +{(matchedIncome.incomeAmount ?? 0).toLocaleString()} {config.currencySymbol || ''} / {matchedIncome.intervalHours || 3}h
                                </span>
                              )}
                            </div>
                            {sr.description && <div style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 4 }}>{sr.description}</div>}
                          </div>
                          <div className="income-role-payout" style={{ color: '#f1c40f' }}>
                            {(sr.price ?? 0).toLocaleString()} {config.currencySymbol || ''}
                          </div>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteShopRole(sr.id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* 2. SECCION: OBJETOS COLECCIONABLES */}
            {shopCategory === 'items' && (
              <>
                <div style={{ background: 'rgba(155, 89, 182, 0.1)', border: '1px solid rgba(155, 89, 182, 0.25)', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#9b59b6', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span></span> <b>Coleccionables Permanentes:</b> Los objetos coleccionables de la mochila de los usuarios <b>JAMÁS se eliminan en los reinicios de temporada</b>. Funcionan como trofeos y recuerdos permanentes que los miembros conservan para siempre.
                </div>
                <form onSubmit={handleAddShopItem} className="form-row" style={{ marginBottom: 16 }}>
                  <div className="field" style={{ maxWidth: 90 }}>
                    <label>Emoji</label>
                    <input
                      type="text"
                      value={newShopItemIcon}
                      onChange={e => setNewShopItemIcon(e.target.value || '')}
                      placeholder="ej. , , "
                    />
                  </div>
                  <div className="field">
                    <label>Nombre del Objeto</label>
                    <input
                      type="text"
                      placeholder="ej. Anillo de la Suerte"
                      value={newShopItemName}
                      onChange={e => setNewShopItemName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field" style={{ maxWidth: 140 }}>
                    <label>Precio ({config.currencySymbol || ''})</label>
                    <input
                      type="number"
                      step={5000}
                      value={newShopItemPrice}
                      onChange={e => setNewShopItemPrice(+e.target.value)}
                      required
                    />
                  </div>
                  <div className="field" style={{ maxWidth: 140 }}>
                    <label>Rareza</label>
                    <select value={newShopItemRarity} onChange={e => setNewShopItemRarity(e.target.value)}>
                      <option value="Común">Común</option>
                      <option value="Raro">Raro</option>
                      <option value="Épico">Épico</option>
                      <option value="Legendario">Legendario</option>
                      <option value="Mítico">Mítico</option>
                    </select>
                  </div>
                  <div className="field" style={{ flex: 2 }}>
                    <label>Descripción / Historia del Objeto</label>
                    <input
                      type="text"
                      placeholder="ej. Otorgado a los jugadores más afortunados"
                      value={newShopItemDesc}
                      onChange={e => setNewShopItemDesc(e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ maxWidth: 150, justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary" style={{ height: 38 }}>
                      <Plus size={14} /> Crear ítem
                    </button>
                  </div>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(!config.shopItems || config.shopItems.length === 0) ? (
                    <div className="empty" style={{ padding: 16 }}>Sin objetos coleccionables configurados en la tienda</div>
                  ) : (
                    config.shopItems.map(item => {
                      const rarityColorMap: Record<string, string> = {
                        'Común': '#95a5a6',
                        'Raro': '#3498db',
                        'Épico': '#9b59b6',
                        'Legendario': '#f1c40f',
                        'Mítico': '#e74c3c',
                      };
                      const rarityColor = rarityColorMap[item.rarity || 'Común'] || '#95a5a6';
                      const isRetired = (item as any).isAvailable === false;

                      return (
                        <div className="income-role-card" key={item.id} style={{ gap: 12, opacity: isRetired ? 0.6 : 1 }}>
                          <div style={{ fontSize: 24 }}>{item.icon || ''}</div>
                          <div className="income-role-info" style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--txt-1)' }}>
                                {item.name}
                              </span>
                              <span className="badge" style={{ fontSize: 10, padding: '2px 8px', background: `${rarityColor}20`, color: rarityColor, border: `1px solid ${rarityColor}50`, borderRadius: 4, fontWeight: 600 }}>
                                {item.rarity || 'Común'}
                              </span>
                              {isRetired && (
                                <span className="badge" style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(237, 66, 69, 0.15)', color: '#ed4245', borderRadius: 4 }}>
                                  Retirado (No Comprable)
                                </span>
                              )}
                            </div>
                            {item.description && <div style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 4 }}>{item.description}</div>}
                          </div>
                          <div className="income-role-payout" style={{ color: '#f1c40f' }}>
                            {(item.price ?? 0).toLocaleString()} {config.currencySymbol || ''}
                          </div>
                          {!isRetired && (
                            <button type="button" className="btn btn-danger btn-sm" title="Retirar de la Tienda (Mantener en mochilas compradas)" onClick={() => handleDeleteShopItem(item.id)}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 8. SUBTAB: INGRESOS POR ROLES */}
      {casinoSubTab === 'income' && (
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon" style={{ background: 'rgba(88, 101, 242, 0.15)', color: '#5865f2' }}></div>
            <h2>Ingresos de Temporada por Roles (`/collect-income`)</h2>
            <p>Configura los sueldos pasivos. Clasifica cada rol como <b>Temporada</b> o <b>Permanente del Servidor</b>.</p>
          </div>
          <div className="section-body">
            <form onSubmit={handleAddRoleIncome} className="form-row" style={{ marginBottom: 16 }}>
              <div className="field">
                <label>Rol de Discord</label>
                {structure.roles && structure.roles.length > 0 ? (
                  <select value={newIncomeRoleId} onChange={e => setNewIncomeRoleId(e.target.value)}>
                    <option value="">Selecciona un rol</option>
                    {structure.roles.map(r => (
                      <option key={r.id} value={r.id}>@{r.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="ID del rol"
                    value={newIncomeRoleId}
                    onChange={e => setNewIncomeRoleId(e.target.value)}
                  />
                )}
              </div>
              <div className="field">
                <label>Pago por Cobro ({config.currencySymbol || ''})</label>
                <input
                  type="number"
                  step={5000}
                  value={newIncomeAmount}
                  onChange={e => setNewIncomeAmount(+e.target.value)}
                />
              </div>
              <div className="field" style={{ maxWidth: 140 }}>
                <label>Intervalo (Horas)</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={newIncomeHours}
                  onChange={e => setNewIncomeHours(+e.target.value)}
                />
              </div>
              <div className="field" style={{ maxWidth: 180 }}>
                <label>Tipo de Rol</label>
                <select value={newIncomeIsSeasonal ? 'seasonal' : 'permanent'} onChange={e => setNewIncomeIsSeasonal(e.target.value === 'seasonal')}>
                  <option value="seasonal"> Rol de Temporada</option>
                  <option value="permanent"> Permanente Servidor</option>
                </select>
              </div>
              <div className="field" style={{ maxWidth: 140, justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" style={{ height: 38 }}>
                  <Plus size={14} /> Añadir
                </button>
              </div>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(!config.roleIncomes || config.roleIncomes.length === 0) ? (
                <div className="empty" style={{ padding: 16 }}>Sin sueldos pasivos configurados</div>
              ) : (
                config.roleIncomes.map(ri => {
                  const matchedRole = structure.roles.find(r => r.id === ri.roleId);
                  const isSeasonal = ri.isSeasonal ?? true;

                  return (
                    <div className="income-role-card" key={ri.id || ri.roleId}>
                      <div className="income-role-info">
                        <span className="income-role-badge" style={{ borderColor: matchedRole?.color || 'var(--accent)', color: matchedRole?.color || '#ffffff' }}>
                          @{matchedRole ? matchedRole.name : `ID: ${ri.roleId}`}
                        </span>
                        <span className={`badge ${isSeasonal ? 'badge-seasonal' : 'badge-permanent'}`} style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: isSeasonal ? 'rgba(241, 196, 15, 0.15)' : 'rgba(155, 89, 182, 0.15)', color: isSeasonal ? '#f1c40f' : '#9b59b6' }}>
                          {isSeasonal ? ' Temporada (Se remueve)' : ' Permanente (Protegido)'}
                        </span>
                      </div>
                      <div className="income-role-payout">
                        +{(ri.incomeAmount ?? 0).toLocaleString()} {config.currencySymbol || ''} <span className="income-role-sub">/ cada {ri.intervalHours || 3}h</span>
                      </div>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteRoleIncome(ri.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. SUBTAB: NUEVA TEMPORADA (RESET & SEASON SWITCH) */}
      {casinoSubTab === 'reset' && (
        <div className="section" style={{ border: '1px solid rgba(239, 68, 68, 0.4)' }}>
          <div className="section-header" style={{ background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px 12px 0 0' }}>
            <div className="section-header-icon" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>⚠️</div>
            <h2>Asistente de Cambio de Temporada & Reinicio de Economía</h2>
          </div>
          <div className="section-body">
            <div style={{
              background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.15) 0%, rgba(237, 66, 69, 0.15) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#5865F2',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8
              }}>
                 LANZADOR DE NUEVA TEMPORADA & LIGA
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0', color: '#ffffff' }}>
                Asistente de Cambio de Temporada
              </h2>
              <p style={{ fontSize: 13, color: 'var(--txt-2)', margin: 0 }}>
                Prepara y personaliza la nueva temática de tu servidor, actualiza nombres y colores de roles, y renueva la liga en 3 sencillos pasos.
              </p>
            </div>

            {/* PASO 1: DIAGNOSTICO Y PROTECCION VISUAL */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt-1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#5865f2', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>1</span>
                Resumen de Seguridad & Protección del Servidor
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <div style={{
                  background: 'rgba(46, 204, 113, 0.08)',
                  border: '1px solid rgba(46, 204, 113, 0.25)',
                  borderRadius: 10,
                  padding: 14,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#2ecc71', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ️ ELEMENTOS PROTEGIDOS (100% SEGUROS)
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--txt-1)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <li><b> Roles Permanentes</b>: Staff, VIP, Donantes y Roles marcados como permanentes jamás se tocan.</li>
                    <li><b> Mochilas y Coleccionables</b>: Los objetos y trofeos del <code>!inv</code> comprados por usuarios se conservan intactos.</li>
                    <li><b> Progreso de Niveles</b>: Los niveles de mensajes (XP) y canales de voz no se borran.</li>
                  </ul>
                </div>

                <div style={{
                  background: 'rgba(237, 66, 69, 0.08)',
                  border: '1px solid rgba(237, 66, 69, 0.25)',
                  borderRadius: 10,
                  padding: 14,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#ed4245', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                     ELEMENTOS QUE SE RENUEVAN
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--txt-1)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <li><b> Saldos de Dinero</b>: El efectivo y el banco vuelven al dinero base inicial ({(config.startingBalance ?? 1000).toLocaleString()} {config.currencySymbol || ''}).</li>
                    <li><b> Roles de Temporada</b>: Se des-equipan de todos los miembros para iniciará una carrera igualada.</li>
                    <li><b> Temática de Roles</b>: Los roles de temporada se renombran y recolorean al instante al nuevo ítema.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* PASO 2: PERSONALIZADOR DE ROLES DE LA NUEVA TEMPORADA */}
            <div style={{ marginBottom: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt-1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#f1c40f', color: '#000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>2</span>
                Personalizar Temática de los Roles de la Nueva Temporada
              </h3>

              {(() => {
                const shopRoleIds = (config.shopRoles || []).map(r => r.roleId);
                const incomeRoleIds = (config.roleIncomes || []).filter(r => r.isSeasonal ?? true).map(r => r.roleId);
                const allSeasonalRoleIds = Array.from(new Set([...shopRoleIds, ...incomeRoleIds]));

                if (allSeasonalRoleIds.length === 0) {
                  return (
                    <div className="empty" style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 8 }}>
                      ℹ️ No hay roles configurados actualmente en la tienda o en los ingresos de temporada.
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {allSeasonalRoleIds.map(rId => {
                      const matchedRole = structure.roles.find(r => r.id === rId);
                      const roleName = matchedRole?.name || `Rol ${rId}`;
                      const currentHex = matchedRole?.color || '#5865f2';
                      const isShop = shopRoleIds.includes(rId);
                      const isIncome = incomeRoleIds.includes(rId);

                      const matchedShopRole = (config.shopRoles || []).find(sr => sr.roleId === rId);
                      const matchedIncomeRole = (config.roleIncomes || []).find(ri => ri.roleId === rId);

                      const defaultIcon = matchedShopRole?.icon || '🛒';
                      const defaultPrice = matchedShopRole?.price ?? 10000;
                      const defaultDesc = matchedShopRole?.description || '';
                      const defaultIncome = matchedIncomeRole?.incomeAmount ?? 5000;

                      const editState = seasonalEdits[rId] || {
                        name: roleName,
                        color: currentHex,
                        icon: defaultIcon,
                        price: defaultPrice,
                        description: defaultDesc,
                        incomeAmount: defaultIncome
                      };

                      return (
                        <div
                          key={rId}
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            padding: 16,
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'center' }}>
                            {/* Información Actual */}
                            <div>
                              <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, color: 'var(--txt-3)', marginBottom: 4 }}>
                                Rol en Discord
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: editState.color }} />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 15, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, marginTop: 1 }}>
                                    {editState.icon || '🛒'} {roleName}
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                    {isShop && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 12, background: 'rgba(241, 196, 15, 0.18)', color: '#f1c40f', border: '1px solid rgba(241, 196, 15, 0.3)', fontWeight: 700 }}> Tienda</span>}
                                    {isIncome && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 12, background: 'rgba(88, 101, 242, 0.18)', color: '#5865f2', border: '1px solid rgba(88, 101, 242, 0.3)', fontWeight: 700 }}> Sueldo Ingreso</span>}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Input para Nuevo Nombre */}
                            <div>
                              <label style={{ fontSize: 11, color: 'var(--txt-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                 Nuevo Nombre:
                              </label>
                              <input
                                type="text"
                                value={editState.name}
                                onChange={e => {
                                  const val = e.target.value;
                                  setSeasonalEdits(prev => ({
                                    ...prev,
                                    [rId]: { ...(prev[rId] || editState), name: val }
                                  }));
                                }}
                                style={{
                                  width: '100%',
                                  background: '#111215',
                                  border: '1px solid var(--border)',
                                  borderRadius: 8,
                                  color: '#fff',
                                  padding: '8px 12px',
                                  fontSize: 13,
                                  fontWeight: 600
                                }}
                              />
                            </div>

                            {/* Color Picker & Quick Preset Swatches */}
                            <div>
                              <label style={{ fontSize: 11, color: 'var(--txt-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                 Color del Rol:
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111215', padding: '3px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
                                  <input
                                    type="color"
                                    value={editState.color}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setSeasonalEdits(prev => ({
                                        ...prev,
                                        [rId]: { ...(prev[rId] || editState), color: val }
                                      }));
                                    }}
                                    style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                                  />
                                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#fff', fontWeight: 600 }}>{editState.color}</span>
                                </div>

                                <div style={{ display: 'flex', gap: 4 }}>
                                  {['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e91e63'].map(c => (
                                    <div
                                      key={c}
                                      onClick={() => {
                                        setSeasonalEdits(prev => ({
                                          ...prev,
                                          [rId]: { ...(prev[rId] || editState), color: c }
                                        }));
                                      }}
                                      style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: '50%',
                                        background: c,
                                        cursor: 'pointer',
                                        border: editState.color === c ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                                        transform: editState.color === c ? 'scale(1.2)' : 'none',
                                        transition: 'transform 0.15s'
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Propiedades de Tienda (Ícono, Precio, Descripción) */}
                            {isShop && (
                              <>
                                <div>
                                  <label style={{ fontSize: 11, color: 'var(--txt-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                     Emoji / Ícono:
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="👑, 🛒, 💎"
                                    value={editState.icon ?? defaultIcon}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setSeasonalEdits(prev => ({
                                        ...prev,
                                        [rId]: { ...(prev[rId] || editState), icon: val }
                                      }));
                                    }}
                                    style={{
                                      width: '100%',
                                      background: '#111215',
                                      border: '1px solid var(--border)',
                                      borderRadius: 8,
                                      color: '#fff',
                                      padding: '8px 12px',
                                      fontSize: 13,
                                      fontWeight: 600
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ fontSize: 11, color: 'var(--txt-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                     Precio Tienda ({config.currencySymbol || ''}):
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step={1000}
                                    value={editState.price ?? defaultPrice}
                                    onChange={e => {
                                      const val = +e.target.value;
                                      setSeasonalEdits(prev => ({
                                        ...prev,
                                        [rId]: { ...(prev[rId] || editState), price: val }
                                      }));
                                    }}
                                    style={{
                                      width: '100%',
                                      background: '#111215',
                                      border: '1px solid var(--border)',
                                      borderRadius: 8,
                                      color: '#fff',
                                      padding: '8px 12px',
                                      fontSize: 13,
                                      fontWeight: 600
                                    }}
                                  />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                  <label style={{ fontSize: 11, color: 'var(--txt-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                     Descripción para la Tienda:
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Descripción corta del rol..."
                                    value={editState.description ?? defaultDesc}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setSeasonalEdits(prev => ({
                                        ...prev,
                                        [rId]: { ...(prev[rId] || editState), description: val }
                                      }));
                                    }}
                                    style={{
                                      width: '100%',
                                      background: '#111215',
                                      border: '1px solid var(--border)',
                                      borderRadius: 8,
                                      color: '#fff',
                                      padding: '8px 12px',
                                      fontSize: 13,
                                      fontWeight: 600
                                    }}
                                  />
                                </div>
                              </>
                            )}

                            {/* Propiedad de Sueldo Pasivo */}
                            {isIncome && (
                              <div>
                                <label style={{ fontSize: 11, color: 'var(--txt-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                   Sueldo Pasivo ({config.currencySymbol || ''}):
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step={1000}
                                  value={editState.incomeAmount ?? defaultIncome}
                                  onChange={e => {
                                    const val = +e.target.value;
                                    setSeasonalEdits(prev => ({
                                      ...prev,
                                      [rId]: { ...(prev[rId] || editState), incomeAmount: val }
                                    }));
                                  }}
                                  style={{
                                    width: '100%',
                                    background: '#111215',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8,
                                    color: '#fff',
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    fontWeight: 600
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* PASO 3: CONFIRMACION Y EJECUCION SEGURA */}
            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#ed4245', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ed4245', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>3</span>
                Confirmación y Ejecución de la Nueva Temporada
              </h3>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(237, 66, 69, 0.08)',
                border: '1px solid rgba(237, 66, 69, 0.3)',
                borderRadius: 8,
                padding: '12px 16px',
                cursor: 'pointer',
                fontSize: 13,
                color: '#fff',
                fontWeight: 600
              }}>
                <input
                  type="checkbox"
                  checked={resetConfirmed}
                  onChange={e => setResetConfirmed(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#ed4245', cursor: 'pointer' }}
                />
                <span>Entiendo que esta acción cambiará la temática de los roles, des-equipará los roles de temporada y reseteará los saldos de la economía a {(config.startingBalance ?? 1000).toLocaleString()} {config.currencySymbol || ''}.</span>
              </label>

              <button
                type="button"
                className="btn"
                disabled={!resetConfirmed}
                style={{
                  background: resetConfirmed ? 'linear-gradient(135deg, #ed4245 0%, #b82528 100%)' : 'var(--surface-2)',
                  color: resetConfirmed ? '#fff' : 'var(--txt-3)',
                  border: resetConfirmed ? '1px solid #ed4245' : '1px solid var(--border)',
                  padding: '14px 20px',
                  fontSize: 14,
                  fontWeight: 800,
                  borderRadius: 10,
                  cursor: resetConfirmed ? 'pointer' : 'not-allowed',
                  boxShadow: resetConfirmed ? '0 4px 20px rgba(237, 66, 69, 0.35)' : 'none',
                  transition: 'all 0.2s',
                }}
                onClick={handleSeasonReset}
              >
                 INICIAR NUEVA TEMPORADA, RENOMBRAR ROLES Y RESETEAR ECONOMÍA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
