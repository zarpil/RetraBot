import React from 'react';
import { TrendingUp, Volume2, Save, Crown, Trash2 } from 'lucide-react';
import type { GuildConfig, ServerStructure } from '../types';

interface LevelingSettingsProps {
  config: GuildConfig;
  setConfig: React.Dispatch<React.SetStateAction<GuildConfig>>;
  structure: ServerStructure;
  handleSave: (e: React.FormEvent) => void;
  getCsvArray: (csvString?: string | null) => string[];
  addCsvItem: (csvString: string | null | undefined, newId: string) => string;
  removeCsvItem: (csvString: string | null | undefined, targetId: string) => string;
  handleAddRole: (e: React.FormEvent) => void;
  handleDeleteRole: (roleId?: string, type?: 'TEXT' | 'VOICE', level?: number) => void;
  handleAddPrestigeRole: (e: React.FormEvent) => void;
  handleDeletePrestigeRole: (id?: string) => void;
  newRoleType: 'TEXT' | 'VOICE';
  setNewRoleType: (val: 'TEXT' | 'VOICE') => void;
  newRoleLevel: number;
  setNewRoleLevel: (val: number) => void;
  newRoleId: string;
  setNewRoleId: (val: string) => void;
  newPrestigeLevel: number;
  setNewPrestigeLevel: (val: number) => void;
  newPrestigeRoleId: string;
  setNewPrestigeRoleId: (val: string) => void;
}

export const LevelingSettings: React.FC<LevelingSettingsProps> = ({
  config,
  setConfig,
  structure,
  handleSave,
  getCsvArray,
  addCsvItem,
  removeCsvItem,
  handleAddRole,
  handleDeleteRole,
  handleAddPrestigeRole,
  handleDeletePrestigeRole,
  newRoleType,
  setNewRoleType,
  newRoleLevel,
  setNewRoleLevel,
  newRoleId,
  setNewRoleId,
  newPrestigeLevel,
  setNewPrestigeLevel,
  newPrestigeRoleId,
  setNewPrestigeRoleId
}) => {
  return (
    <div className="page-body page-body-wide">
      {/* Row 1: Texto | Voz  parámetros de XP */}
      <div className="split-row">
        {/* Texto */}
        <div className="section split-col">
          <div className="section-header">
            <div className="section-header-icon section-header-icon--blue">
              <TrendingUp size={14} />
            </div>
            <h2>Módulo de Texto</h2>
          </div>
          <div className="section-body">
            <div className="field">
              <label>XP mínimo por mensaje</label>
              <input type="number" value={config.minXpPerMessage}
                onChange={e => setConfig({ ...config, minXpPerMessage: +e.target.value || 0 })} />
            </div>
            <div className="field">
              <label>XP máximo por mensaje</label>
              <input type="number" value={config.maxXpPerMessage}
                onChange={e => setConfig({ ...config, maxXpPerMessage: +e.target.value || 0 })} />
            </div>
            <div className="field">
              <label>Cooldown (segundos)</label>
              <input type="number" value={config.xpCooldownSeconds}
                onChange={e => setConfig({ ...config, xpCooldownSeconds: +e.target.value || 0 })} />
              <span className="hint">Tiempo mínimo entre mensajes que dan XP.</span>
            </div>
            <div className="field">
              <label>Canales excluidos de ganar XP</label>
              <div className="tag-group">
                {getCsvArray(config.ignoredChannels).map(chId => {
                  const textCh = structure.textChannels.find(c => c.id === chId);
                  const voiceCh = structure.voiceChannels.find(c => c.id === chId);
                  const labelName = textCh ? `# ${textCh.name}` : voiceCh ? ` ${voiceCh.name}` : `Canal ${chId}`;
                  return (
                    <span className="tag-chip" key={chId}>
                      {labelName}
                      <button type="button" className="tag-chip-remove" onClick={() => setConfig({ ...config, ignoredChannels: removeCsvItem(config.ignoredChannels, chId) })}>✖</button>
                    </span>
                  );
                })}
              </div>

              {structure.textChannels.length > 0 || structure.voiceChannels.length > 0 ? (
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      setConfig({ ...config, ignoredChannels: addCsvItem(config.ignoredChannels, e.target.value) });
                    }
                  }}
                >
                  <option value="">➕ Añadir canal a excluir...</option>
                  <optgroup label="Canales de Texto">
                    {structure.textChannels
                      .filter(c => !getCsvArray(config.ignoredChannels).includes(c.id))
                      .map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </optgroup>
                  <optgroup label="Canales de Voz">
                    {structure.voiceChannels
                      .filter(c => !getCsvArray(config.ignoredChannels).includes(c.id))
                      .map(c => <option key={c.id} value={c.id}> {c.name}</option>)}
                  </optgroup>
                </select>
              ) : (
                <input type="text" placeholder="ID de canal o separados por coma"
                  value={config.ignoredChannels || ''}
                  onChange={e => setConfig({ ...config, ignoredChannels: e.target.value })} />
              )}
              <span className="hint">Los canales seleccionados no otorgarán XP (ni de texto ni de voz).</span>
            </div>
          </div>
        </div>

        {/* Voz */}
        <div className="section split-col">
          <div className="section-header">
            <div className="section-header-icon section-header-icon--purple">
              <Volume2 size={14} />
            </div>
            <h2>Módulo de Voz</h2>
          </div>
          <div className="section-body">
            <div className="field">
              <label>XP por minuto en llamada de voz</label>
              <input type="number" value={config.xpPerMinuteVc}
                onChange={e => setConfig({ ...config, xpPerMinuteVc: +e.target.value || 0 })} />
              <span className="hint">Se descuenta si el usuario está silenciado.</span>
            </div>
            <div className="field">
              <label>Roles excluidos de ganar XP</label>
              <div className="tag-group">
                {getCsvArray(config.ignoredRoles).map(roleId => {
                  const rName = structure.roles.find(r => r.id === roleId)?.name || `Rol ${roleId}`;
                  return (
                    <span className="tag-chip" key={roleId}>
                      {rName}
                      <button type="button" className="tag-chip-remove" onClick={() => setConfig({ ...config, ignoredRoles: removeCsvItem(config.ignoredRoles, roleId) })}>✖</button>
                    </span>
                  );
                })}
              </div>

              {structure.roles.length > 0 ? (
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      setConfig({ ...config, ignoredRoles: addCsvItem(config.ignoredRoles, e.target.value) });
                    }
                  }}
                >
                  <option value="">➕ Añadir rol a excluir...</option>
                  {structure.roles
                    .filter(r => !getCsvArray(config.ignoredRoles).includes(r.id))
                    .map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              ) : (
                <input type="text" placeholder="ID de rol o separados por coma"
                  value={config.ignoredRoles || ''}
                  onChange={e => setConfig({ ...config, ignoredRoles: e.target.value })} />
              )}
              <span className="hint">Los miembros con estos roles no ganarán XP.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Anuncios de nivel  full width */}
      <form onSubmit={handleSave}>
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon"><TrendingUp size={14} /></div>
            <h2>Anuncios de Subida de Nivel y Roles Mensuales</h2>
          </div>
          <div className="section-body">
            <div className="split-row split-row--sm">
              <div className="field split-col">
                <label>Canal para anuncios</label>
                {structure.textChannels.length > 0 ? (
                  <select value={config.levelUpChannelId || ''}
                    onChange={e => setConfig({ ...config, levelUpChannelId: e.target.value })}>
                    <option value="">Mismo canal donde subió</option>
                    <option value="dm">Mensaje Directo (DM)</option>
                    {structure.textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="vacío = mismo canal A 'dm' = DM"
                    value={config.levelUpChannelId || ''}
                    onChange={e => setConfig({ ...config, levelUpChannelId: e.target.value })} />
                )}
              </div>
              <div className="field split-col">
                <label>Mensaje de subida de nivel</label>
                <input type="text" value={config.levelUpMessage}
                  onChange={e => setConfig({ ...config, levelUpMessage: e.target.value })} />
                <span className="hint">
                  Variables disponibles: <code>{'{user}'}</code> (Mención) | <code>{'{level}'}</code> (Nivel) | <code>{'{type}'}</code> (Texto  o Voz ️) | <code>{'{xp}'}</code> (XP Total) | <code>{'{server}'}</code> (Nombre Servidor)
                </span>
              </div>

              <div className="split-row" style={{ marginTop: 16 }}>
                <div className="field">
                  <label> Rol "Charletero del Mes" (Top Mensajes / Chat)</label>
                  {structure.roles.length > 0 ? (
                    <select
                      value={config.charleteroRoleId || ''}
                      onChange={e => setConfig({ ...config, charleteroRoleId: e.target.value || null })}
                    >
                      <option value="">Desactivado (sin rol mensual)</option>
                      {structure.roles.map(r => (
                        <option key={r.id} value={r.id}> {r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="ID del rol Charletero del Mes"
                      value={config.charleteroRoleId || ''}
                      onChange={e => setConfig({ ...config, charleteroRoleId: e.target.value || null })}
                    />
                  )}
                  <span className="hint">Rol otorgado automáticamente al usuario con más mensajes de texto del mes anterior.</span>
                </div>

                <div className="field">
                  <label>️ Rol "Charlatán del Mes" (Top Horas / Voz VC)</label>
                  {structure.roles.length > 0 ? (
                    <select
                      value={config.charlatanRoleId || ''}
                      onChange={e => setConfig({ ...config, charlatanRoleId: e.target.value || null })}
                    >
                      <option value="">Desactivado (sin rol mensual)</option>
                      {structure.roles.map(r => (
                        <option key={r.id} value={r.id}> {r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="ID del rol Charlatán del Mes"
                      value={config.charlatanRoleId || ''}
                      onChange={e => setConfig({ ...config, charlatanRoleId: e.target.value || null })}
                    />
                  )}
                  <span className="hint">Rol otorgado automáticamente al usuario con más horas en canal de voz del mes anterior.</span>
                </div>
              </div>
            </div>

            <div className="actions" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button type="submit" className="btn btn-primary">
                <Save size={14} /> Guardar Cambios de XP
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Row 3: Roles por nivel  Texto | Voz */}
      <div className="section">
        <div className="section-header">
          <div className="section-header-icon"><Crown size={14} /></div>
          <h2>Roles por Nivel Recompensa</h2>
          <p>{config.levelRoles?.length || 0} configurados</p>
        </div>
        <div className="section-body">
          {/* Add form */}
          <form onSubmit={handleAddRole} className="form-row" style={{ marginBottom: 16 }}>
            <div className="field" style={{ maxWidth: 120 }}>
              <label>Módulo</label>
              <select value={newRoleType} onChange={e => setNewRoleType(e.target.value as 'TEXT' | 'VOICE')}>
                <option value="TEXT"> Texto</option>
                <option value="VOICE">️ Voz</option>
              </select>
            </div>
            <div className="field" style={{ maxWidth: 100 }}>
              <label>Nivel</label>
              <input type="number" min="1" max="200" value={newRoleLevel}
                onChange={e => setNewRoleLevel(+e.target.value || 1)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Rol de Discord</label>
              {structure.roles.length > 0 ? (
                <select value={newRoleId} onChange={e => setNewRoleId(e.target.value)}>
                  <option value="">Selecciona un rol</option>
                  {structure.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              ) : (
                <input type="text" placeholder="ID del rol" value={newRoleId}
                  onChange={e => setNewRoleId(e.target.value)} />
              )}
            </div>
            <div className="field" style={{ maxWidth: 110, justifyContent: 'flex-end' }}>
              <label style={{ visibility: 'hidden' }}>x</label>
              <button type="submit" className="btn btn-primary btn-sm">Añadir rol</button>
            </div>
          </form>

          <div className="split-row">
            {/* Texto roles */}
            <div className="role-col">
              <div className="role-col-header">
                <span className="badge badge-text"> Texto</span>
                <span>{(config.levelRoles || []).filter(r => r.type === 'TEXT').length} roles</span>
              </div>
              {(config.levelRoles || []).filter(r => r.type === 'TEXT').length === 0 ? (
                <div className="empty" style={{ padding: 16 }}>Sin roles de texto</div>
              ) : (
                (config.levelRoles || [])
                  .filter(r => r.type === 'TEXT')
                  .sort((a, b) => a.level - b.level)
                  .map(lr => (
                    <div className="role-row" key={`text-${lr.level}-${lr.roleId}`}>
                      <span className="role-row-level">Nvl {lr.level}</span>
                      <span className="role-row-id mono">
                        {structure.roles.find(r => r.id === lr.roleId)?.name || lr.roleId}
                      </span>
                      <button className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteRole(lr.roleId, 'TEXT', lr.level)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Voz roles */}
            <div className="role-col">
              <div className="role-col-header">
                <span className="badge badge-voice">️ Voz</span>
                <span>{(config.levelRoles || []).filter(r => r.type === 'VOICE').length} roles</span>
              </div>
              {(config.levelRoles || []).filter(r => r.type === 'VOICE').length === 0 ? (
                <div className="empty" style={{ padding: 16 }}>Sin roles de voz</div>
              ) : (
                (config.levelRoles || [])
                  .filter(r => r.type === 'VOICE')
                  .sort((a, b) => a.level - b.level)
                  .map(lr => (
                    <div className="role-row" key={`voice-${lr.level}-${lr.roleId}`}>
                      <span className="role-row-level">Nvl {lr.level}</span>
                      <span className="role-row-id mono">
                        {structure.roles.find(r => r.id === lr.roleId)?.name || lr.roleId}
                      </span>
                      <button className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteRole(lr.roleId, 'VOICE', lr.level)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Roles por Nivel de Prestigio */}
      <div className="section">
        <div className="section-header">
          <div className="section-header-icon" style={{ background: 'rgba(241, 196, 15, 0.15)', color: '#f1c40f' }}></div>
          <h2>Roles por Nivel de Prestigio (Nivel 100 de Texto)</h2>
          <p>{config.prestigeRoles?.length || 0} configurados</p>
        </div>
        <div className="section-body">
          {/* Formulario añadir rol prestigio */}
          <form onSubmit={handleAddPrestigeRole} className="form-row" style={{ marginBottom: 16 }}>
            <div className="field" style={{ maxWidth: 140 }}>
              <label>Nivel Prestigio</label>
              <input type="number" min="1" max="100" value={newPrestigeLevel}
                onChange={e => setNewPrestigeLevel(+e.target.value || 1)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Rol de Discord</label>
              {structure.roles.length > 0 ? (
                <select value={newPrestigeRoleId} onChange={e => setNewPrestigeRoleId(e.target.value)}>
                  <option value="">Selecciona un rol</option>
                  {structure.roles.map(r => <option key={r.id} value={r.id}> {r.name}</option>)}
                </select>
              ) : (
                <input type="text" placeholder="ID del rol" value={newPrestigeRoleId}
                  onChange={e => setNewPrestigeRoleId(e.target.value)} />
              )}
            </div>
            <div className="field" style={{ maxWidth: 160, justifyContent: 'flex-end' }}>
              <label style={{ visibility: 'hidden' }}>x</label>
              <button type="submit" className="btn btn-primary btn-sm">Añadir Rol Prestigio</button>
            </div>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(config.prestigeRoles || []).length === 0 ? (
              <div className="empty" style={{ padding: 16 }}>Sin roles de prestigio configurados</div>
            ) : (
              (config.prestigeRoles || [])
                .sort((a, b) => a.prestigeLevel - b.prestigeLevel)
                .map(pr => (
                  <div className="role-row" key={`prestige-${pr.prestigeLevel}`}>
                    <span className="badge" style={{ background: 'rgba(241, 196, 15, 0.15)', color: '#f1c40f', border: '1px solid rgba(241, 196, 15, 0.3)' }}>
                       Prestigio {pr.prestigeLevel}
                    </span>
                    <span className="role-row-id mono" style={{ marginLeft: 12 }}>Rol ID: {pr.roleId}</span>
                    <button className="btn btn-danger btn-sm"
                      onClick={() => handleDeletePrestigeRole(pr.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
