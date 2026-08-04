import React from 'react';
import { Cake, Save } from 'lucide-react';
import type { GuildConfig, ServerStructure, Tab } from '../types';

interface BirthdaysSettingsProps {
  config: GuildConfig;
  setConfig: React.Dispatch<React.SetStateAction<GuildConfig>>;
  structure: ServerStructure;
  handleSave: (e: React.FormEvent) => void;
  setTab: (tab: Tab) => void;
}

export const BirthdaysSettings: React.FC<BirthdaysSettingsProps> = ({
  config,
  setConfig,
  structure,
  handleSave,
  setTab
}) => {
  return (
    <div className="page-body">
      {!(config.birthdayEnabled ?? true) ? (
        <div className="section" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--txt-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚠️ El <strong>Módulo de Cumpleaños</strong> está desactivado. Para poder configurarlo, primero actívalo en los <a href="#" onClick={(e) => { e.preventDefault(); setTab('general'); }} style={{ color: '#a78bfa', textDecoration: 'underline', fontWeight: 600 }}>Ajustes Generales</a>.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="section">
            <div className="section-header">
              <div className="section-header-icon" style={{ backgroundColor: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa' }}><Cake size={14} /></div>
              <h2>Ajustes de Cumpleaños</h2>
            </div>
            <div className="section-body">
              <div className="split-row" style={{ gap: 20 }}>
                <div className="field split-col">
                  <label>Rol de Cumpleaños (Temporal)</label>
                  {structure.roles && structure.roles.length > 0 ? (
                    <select
                      value={config.birthdayRoleId || ''}
                      onChange={e => setConfig({ ...config, birthdayRoleId: e.target.value })}
                    >
                      <option value="">Desactivado (sin rol)</option>
                      {structure.roles.map(r => (
                        <option key={r.id} value={r.id}>@{r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="ID del rol de cumpleaños"
                      value={config.birthdayRoleId || ''}
                      onChange={e => setConfig({ ...config, birthdayRoleId: e.target.value })}
                    />
                  )}
                  <span className="hint">Este rol se asignará temporalmente durante el día del cumpleaños.</span>
                </div>

                <div className="field split-col">
                  <label>Canal donde enviar la felicitación</label>
                  {structure.textChannels && structure.textChannels.length > 0 ? (
                    <select
                      value={config.birthdayChannelId || ''}
                      onChange={e => setConfig({ ...config, birthdayChannelId: e.target.value })}
                    >
                      <option value="">Desactivado</option>
                      <option value="dm"> Mensaje Directo (DM)</option>
                      {structure.textChannels.map(c => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="ID de canal o 'dm'"
                      value={config.birthdayChannelId || ''}
                      onChange={e => setConfig({ ...config, birthdayChannelId: e.target.value })}
                    />
                  )}
                  <span className="hint">Canal público o por mensaje privado donde RetraBot felicitará al usuario.</span>
                </div>
              </div>

              <div className="field" style={{ marginTop: 16 }}>
                <label>Mensaje de felicitación</label>
                <textarea
                  placeholder=" Feliz cumpleaños {user}! Que pases un gran día."
                  value={config.birthdayMessage || ''}
                  onChange={e => setConfig({ ...config, birthdayMessage: e.target.value })}
                  rows={3}
                />
                <span className="hint">Usa <code>{`{user}`}</code> para mencionar al cumpleañero en el mensaje.</span>
              </div>

              <div className="actions" style={{ marginTop: 16 }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> Guardar Ajustes de Cumpleaños
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
