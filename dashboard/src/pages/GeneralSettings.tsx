import React from 'react';
import { Settings, Save } from 'lucide-react';
import type { GuildConfig, ServerStructure } from '../types';

interface GeneralSettingsProps {
  config: GuildConfig;
  setConfig: React.Dispatch<React.SetStateAction<GuildConfig>>;
  structure: ServerStructure;
  handleSave: (e: React.FormEvent) => void;
  getCsvArray: (csvString?: string | null) => string[];
  addCsvItem: (csvString: string | null | undefined, newId: string) => string;
  removeCsvItem: (csvString: string | null | undefined, targetId: string) => string;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  config,
  setConfig,
  structure,
  handleSave,
  getCsvArray,
  addCsvItem,
  removeCsvItem
}) => {
  return (
    <div className="page-body">
      <form onSubmit={handleSave}>
        {/* Módulos activos */}
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon"><Settings size={14} /></div>
            <h2>Módulos activos</h2>
          </div>
          <div className="section-body">
            <div className="toggle-row">
              <div className="toggle-info">
                <strong>Sistema de Niveles (Texto y Voz)</strong>
                <span>Otorga XP por mensajes y tiempo en llamadas de voz.</span>
              </div>
              <label className="switch">
                <input type="checkbox" checked={config.levelingEnabled ?? true} onChange={e => setConfig({ ...config, levelingEnabled: e.target.checked })} />
                <span className="switch-track" />
                <span className="switch-thumb" />
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <strong>Canales de Voz Temporales (TempVC)</strong>
                <span>Permite crear canales privados al unirse a la sala maestra.</span>
              </div>
              <label className="switch">
                <input type="checkbox" checked={config.tempvcEnabled ?? true} onChange={e => setConfig({ ...config, tempvcEnabled: e.target.checked })} />
                <span className="switch-track" />
                <span className="switch-thumb" />
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <strong>Casino y Economía por Temporadas</strong>
                <span>Efectivo, banco, apuestas, robos e ingresos por roles de temporada.</span>
              </div>
              <label className="switch">
                <input type="checkbox" checked={config.economyEnabled ?? true} onChange={e => setConfig({ ...config, economyEnabled: e.target.checked })} />
                <span className="switch-track" />
                <span className="switch-thumb" />
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <strong>Módulo de Cumpleaños</strong>
                <span>Asigna un rol y envía felicitaciones el día del cumpleaños del usuario.</span>
              </div>
              <label className="switch">
                <input type="checkbox" checked={config.birthdayEnabled ?? true} onChange={e => setConfig({ ...config, birthdayEnabled: e.target.checked })} />
                <span className="switch-track" />
                <span className="switch-thumb" />
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <strong>Módulo de Clanes</strong>
                <span>Gestión de salas de voz para clanes, horas Anti-AFK y tienda de ventajas.</span>
              </div>
              <label className="switch">
                <input type="checkbox" checked={config.clansEnabled ?? true} onChange={e => setConfig({ ...config, clansEnabled: e.target.checked })} />
                <span className="switch-track" />
                <span className="switch-thumb" />
              </label>
            </div>
          </div>
        </div>

        {/* Roles de Administración del Bot */}
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon"><Settings size={14} /></div>
            <h2>Roles de Administración del Bot</h2>
          </div>
          <div className="section-body">
            <div className="field">
              <label>Roles autorizados a ejecutar comandos staff</label>
              <div className="tag-group" style={{ marginBottom: 8 }}>
                {getCsvArray(config.adminRoleIds).length === 0 ? (
                  <span className="hint">Solo administradores nativos de Discord</span>
                ) : (
                  getCsvArray(config.adminRoleIds).map(roleId => {
                    const rName = structure.roles.find(r => r.id === roleId)?.name || `Rol ${roleId}`;
                    return (
                      <span className="tag-chip" key={roleId}>
                        ️ {rName}
                        <button type="button" className="tag-chip-remove" onClick={() => setConfig({ ...config, adminRoleIds: removeCsvItem(config.adminRoleIds, roleId) })}>✖</button>
                      </span>
                    );
                  })
                )}
              </div>

              {structure.roles && structure.roles.length > 0 && (
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      setConfig({ ...config, adminRoleIds: addCsvItem(config.adminRoleIds, e.target.value) });
                    }
                  }}
                >
                  <option value="">➕ Añadir un rol de Administrador...</option>
                  {structure.roles
                    .filter(r => !getCsvArray(config.adminRoleIds).includes(r.id))
                    .map(r => (
                      <option key={r.id} value={r.id}>@{r.name}</option>
                    ))}
                </select>
              )}
              <span className="hint">
                Los usuarios con estos roles podrán utilizar comandos administrativos como <code>/xp</code>, <code>/economy</code>, etc.
              </span>
            </div>
          </div>
        </div>

        {/* Restricción de Canal de Comandos */}
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon"><Settings size={14} /></div>
            <h2>Canal Único de Comandos de Bot</h2>
          </div>
          <div className="section-body">
            <div className="field">
              <label>Canal exclusivo de comandos (Slash/Prefix)</label>
              {structure.textChannels && structure.textChannels.length > 0 ? (
                <select
                  value={config.commandsChannelId || ''}
                  onChange={e => setConfig({ ...config, commandsChannelId: e.target.value || null })}
                >
                  <option value="">Cualquier canal (sin restricción)</option>
                  {structure.textChannels.map(c => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="ID del canal de comandos"
                  value={config.commandsChannelId || ''}
                  onChange={e => setConfig({ ...config, commandsChannelId: e.target.value || null })}
                />
              )}
              <span className="hint">
                Si se configura, los usuarios no-staff solo podrán usar <code>/rank</code> y <code>/leaderboard</code> en este canal.
              </span>
            </div>
          </div>
        </div>

        <div className="actions">
          <button type="submit" className="btn btn-primary">
            <Save size={14} /> Guardar Configuración
          </button>
        </div>
      </form>
    </div>
  );
};
