import React from 'react';
import { Volume2, Save, Lock, Unlock, Edit2 } from 'lucide-react';
import type { GuildConfig, ServerStructure, ServerStats } from '../types';

interface TempVCSettingsProps {
  config: GuildConfig;
  setConfig: React.Dispatch<React.SetStateAction<GuildConfig>>;
  structure: ServerStructure;
  stats: ServerStats;
  handleSave: (e: React.FormEvent) => void;
}

export const TempVCSettings: React.FC<TempVCSettingsProps> = ({
  config,
  setConfig,
  structure,
  stats,
  handleSave
}) => {
  return (
    <div className="page-body">
      <div className="split-row split-row--tempvc">

        {/* Izquierda: Configuración */}
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon"><Volume2 size={14} /></div>
            <h2>Configuración</h2>
            <p style={{ color: stats.activeTempChannels > 0 ? 'var(--green)' : 'var(--txt-3)' }}>
              {stats.activeTempChannels > 0 ? `${stats.activeTempChannels} activos` : 'Sin canales activos'}
            </p>
          </div>
          <div className="section-body">
            <div className="info-box">
              <strong>Cómo funciona:</strong>
              <ol>
                <li>Crea un canal de voz en Discord (ej: <strong>"➕ Crear canal"</strong>).</li>
                <li>Selecciónalo como <em>Canal creador</em> abajo.</li>
                <li>Al unirse, el bot crea una sala privada y publica el panel de control.</li>
                <li>Al vaciarse, el canal se elimina solo.</li>
              </ol>
            </div>

            <form onSubmit={handleSave}>
              <div className="field">
                <label>Canal creador (Maestro)</label>
                {structure.voiceChannels.length > 0 ? (
                  <select value={config.tempvcChannelId || ''} onChange={e => setConfig({ ...config, tempvcChannelId: e.target.value })}>
                    <option value="">Selecciona el canal</option>
                    {structure.voiceChannels.map(c => <option key={c.id} value={c.id}> {c.name}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="ID del canal de voz" value={config.tempvcChannelId || ''} onChange={e => setConfig({ ...config, tempvcChannelId: e.target.value })} />
                )}
                <span className="hint">Canal que los usuarios deben presionar para crear su sala.</span>
              </div>

              <div className="field">
                <label>Categoría para los canales</label>
                {structure.categories.length > 0 ? (
                  <select value={config.tempvcCategoryId || ''} onChange={e => setConfig({ ...config, tempvcCategoryId: e.target.value })}>
                    <option value="">Sin categoría (raíz)</option>
                    {structure.categories.map(cat => <option key={cat.id} value={cat.id}> {cat.name}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="ID de categoría" value={config.tempvcCategoryId || ''} onChange={e => setConfig({ ...config, tempvcCategoryId: e.target.value })} />
                )}
                <span className="hint">Dónde se crearán los canales temporales.</span>
              </div>

              <div className="field" style={{ marginBottom: 16 }}>
                <label>Rol de Miembros Verificados (Acceso Base)</label>
                {structure.roles.length > 0 ? (
                  <select value={config.verifiedRoleId || ''} onChange={e => setConfig({ ...config, verifiedRoleId: e.target.value })}>
                    <option value="">@everyone (por defecto)</option>
                    {structure.roles.map(r => <option key={r.id} value={r.id}>@{r.name}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="ID del rol verificado" value={config.verifiedRoleId || ''} onChange={e => setConfig({ ...config, verifiedRoleId: e.target.value })} />
                )}
                <span className="hint">
                  Si tu servidor usa un rol de acceso en vez de @everyone, selecciónalo
                  aquí para que el bloqueo del canal funcione correctamente.
                </span>
              </div>

              <div className="actions">
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Derecha: Vista previa Discord */}
        <div className="section">
          <div className="section-header">
            <div className="section-header-icon"><Volume2 size={14} /></div>
            <h2>Vista Previa del Panel</h2>
          </div>
          <div className="section-body">
            <p style={{ fontSize: 12, color: 'var(--txt-3)', marginBottom: 14 }}>
              Así se ve el panel que aparece en el chat del canal temporal.
            </p>
            <div className="discord-preview">
              <div className="discord-msg-header">
                <img
                  className="discord-avatar"
                  src="https://cdn.discordapp.com/embed/avatars/0.png"
                  alt="bot"
                />
                <div>
                  <span className="discord-author">RetraBot</span>
                  <span className="discord-bot-tag">BOT</span>
                  <span className="discord-time">Hoy a las 12:00</span>
                </div>
              </div>

              <div className="discord-embed">
                <div className="discord-embed-title">️ Panel de Control de Voz</div>
                <div className="discord-embed-fields">
                  <div>
                    <div className="discord-field-name"> Estado</div>
                    <div className="discord-field-value">
                       Desbloqueado<br />
                       Sin límite
                    </div>
                  </div>
                  <div>
                    <div className="discord-field-name">️ Controles</div>
                    <div className="discord-field-value">
                       Bloquear / Desbloquear<br />
                       Renombrar<br />
                       Límite
                    </div>
                  </div>
                </div>
              </div>

              <div className="discord-buttons">
                <button type="button" className="discord-btn danger"><Lock size={12} /> Bloquear</button>
                <button type="button" className="discord-btn grey" style={{ opacity: 0.45 }}><Unlock size={12} /> Desbloquear</button>
                <button type="button" className="discord-btn primary"><Edit2 size={12} /> Renombrar</button>
              </div>
              <div className="discord-buttons" style={{ marginTop: 4 }}>
                <button type="button" className="discord-btn grey"> Expulsar</button>
                <button type="button" className="discord-btn grey"> Admitir</button>
                <button type="button" className="discord-btn grey"> Transferir</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
