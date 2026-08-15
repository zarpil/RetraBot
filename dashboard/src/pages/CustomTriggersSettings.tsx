import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, Edit, Save, Clock, Code } from 'lucide-react';
import type { ServerStructure, CustomTrigger } from '../types';

interface CustomTriggersSettingsProps {
  selectedGuild: string;
  structure: ServerStructure;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  API_BASE: string;
  triggerToast: (msg: string) => void;
}

export const CustomTriggersSettings: React.FC<CustomTriggersSettingsProps> = ({
  selectedGuild,
  structure,
  authFetch,
  API_BASE,
  triggerToast
}) => {
  const [triggers, setTriggers] = useState<CustomTrigger[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for creating/editing trigger
  const [isEditing, setIsEditing] = useState<string | null>(null); // trigger ID being edited, or 'new' for creating
  const [triggerKeyword, setTriggerKeyword] = useState('');
  const [responseType, setResponseType] = useState<'TEXT' | 'EMBED'>('TEXT');
  const [cooldown, setCooldown] = useState(0);
  const [requiredRoleId, setRequiredRoleId] = useState('');
  const [ignoredRoleId, setIgnoredRoleId] = useState('');
  const [targetChannelId, setTargetChannelId] = useState('');

  // Response parts (text or parsed embed fields)
  const [textResponse, setTextResponse] = useState('');
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDesc, setEmbedDesc] = useState('');
  const [embedColor, setEmbedColor] = useState('#5865F2');
  const [embedThumbnail, setEmbedThumbnail] = useState('');
  const [embedImage, setEmbedImage] = useState('');
  const [embedFooter, setEmbedFooter] = useState('');
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');

  const fetchTriggers = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/triggers`);
      if (res.ok) {
        setTriggers(await res.json());
      }
    } catch (e) {
      console.error('Error fetching custom triggers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGuild) {
      fetchTriggers();
      setIsEditing(null);
    }
  }, [selectedGuild]);

  const handleStartNew = () => {
    setIsEditing('new');
    setTriggerKeyword('');
    setResponseType('TEXT');
    setTextResponse('');
    setCooldown(0);
    setRequiredRoleId('');
    setIgnoredRoleId('');
    setTargetChannelId('');
    setEmbedTitle('');
    setEmbedDesc('');
    setEmbedColor('#5865F2');
    setEmbedThumbnail('');
    setEmbedImage('');
    setEmbedFooter('');
    setRawJsonMode(false);
    setRawJsonText('');
  };

  const handleStartEdit = (t: CustomTrigger) => {
    setIsEditing(t.id);
    setTriggerKeyword(t.trigger);
    setResponseType(t.responseType as 'TEXT' | 'EMBED');
    setCooldown(t.cooldown);
    setRequiredRoleId(t.requiredRoleId || '');
    setIgnoredRoleId(t.ignoredRoleId || '');
    setTargetChannelId(t.targetChannelId || '');

    if (t.responseType === 'EMBED') {
      setTextResponse('');
      try {
        const embedData = JSON.parse(t.response);
        setEmbedTitle(embedData.title || '');
        setEmbedDesc(embedData.description || '');
        setEmbedColor(embedData.color || '#5865F2');
        setEmbedThumbnail(embedData.thumbnail || '');
        setEmbedImage(embedData.image || '');
        setEmbedFooter(embedData.footer?.text || embedData.footer || '');
        setRawJsonText(JSON.stringify(embedData, null, 2));
      } catch (err) {
        // Fallback
        setEmbedTitle('');
        setEmbedDesc('');
        setEmbedColor('#5865F2');
        setEmbedThumbnail('');
        setEmbedImage('');
        setEmbedFooter('');
        setRawJsonText(t.response);
        setRawJsonMode(true);
      }
    } else {
      setTextResponse(t.response);
      setRawJsonText('');
      setRawJsonMode(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(null);
  };

  const handleDeleteTrigger = async (id: string, keyword: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el disparador "${keyword}"?`)) return;
    try {
      const res = await authFetch(`${API_BASE}/api/guilds/${selectedGuild}/triggers/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        triggerToast(`Disparador "${keyword}" eliminado con éxito.`);
        fetchTriggers();
        if (isEditing === id) setIsEditing(null);
      }
    } catch {
      alert('Error al eliminar disparador.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerKeyword.trim()) {
      alert('Debes ingresar un disparador.');
      return;
    }

    let finalResponse = '';
    if (responseType === 'TEXT') {
      finalResponse = textResponse;
    } else {
      if (rawJsonMode) {
        try {
          // Validate JSON
          JSON.parse(rawJsonText);
          finalResponse = rawJsonText;
        } catch (err) {
          alert('El JSON de la respuesta Embed no es válido.');
          return;
        }
      } else {
        const embedObj: any = {};
        if (embedTitle.trim()) embedObj.title = embedTitle.trim();
        if (embedDesc.trim()) embedObj.description = embedDesc.trim();
        if (embedColor.trim()) embedObj.color = embedColor.trim();
        if (embedThumbnail.trim()) embedObj.thumbnail = embedThumbnail.trim();
        if (embedImage.trim()) embedObj.image = embedImage.trim();
        if (embedFooter.trim()) embedObj.footer = { text: embedFooter.trim() };
        
        finalResponse = JSON.stringify(embedObj);
      }
    }

    const payload = {
      trigger: triggerKeyword.trim(),
      response: finalResponse,
      responseType,
      requiredRoleId: requiredRoleId || null,
      ignoredRoleId: ignoredRoleId || null,
      targetChannelId: targetChannelId || null,
      cooldown: Number(cooldown) || 0
    };

    try {
      const method = isEditing === 'new' ? 'POST' : 'PUT';
      const endpoint = isEditing === 'new'
        ? `${API_BASE}/api/guilds/${selectedGuild}/triggers`
        : `${API_BASE}/api/guilds/${selectedGuild}/triggers/${isEditing}`;

      const res = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        triggerToast(isEditing === 'new' ? 'Disparador creado con éxito.' : 'Disparador actualizado con éxito.');
        setIsEditing(null);
        fetchTriggers();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Error al guardar disparador.'}`);
      }
    } catch {
      alert('Error de conexión con el servidor.');
    }
  };

  return (
    <div className="page-body">
      <div className="section" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--txt-1)' }}>Mensajes Auto / Disparadores</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--txt-3)' }}>
              Crea comandos y respuestas personalizadas con variables y formato enriquecido.
            </p>
          </div>
          {isEditing === null && (
            <button onClick={handleStartNew} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> Nuevo Disparador
            </button>
          )}
        </div>
      </div>

      {isEditing !== null && (
        <div className="section" style={{ animation: 'fadeIn 0.25s ease-out' }}>
          <div className="section-header">
            <div className="section-header-icon" style={{ backgroundColor: 'rgba(52, 152, 219, 0.1)', color: '#3498db' }}>
              <MessageSquare size={14} />
            </div>
            <h2>{isEditing === 'new' ? 'Crear Nuevo Disparador' : 'Editar Disparador'}</h2>
          </div>
          <form onSubmit={handleSubmit} className="section-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <div className="split-row" style={{ gap: 20 }}>
              <div className="field split-col">
                <label>Palabra Clave / Comando Disparador</label>
                <input
                  type="text"
                  placeholder="Ej: !reglas, hola, info"
                  value={triggerKeyword}
                  onChange={e => setTriggerKeyword(e.target.value)}
                  required
                />
                <span className="hint">El texto exacto que el bot debe detectar (distingue entre mayúsculas y minúsculas).</span>
              </div>

              <div className="field split-col">
                <label>Tipo de Respuesta</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    className={`btn ${responseType === 'TEXT' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setResponseType('TEXT')}
                  >
                    Texto Plano
                  </button>
                  <button
                    type="button"
                    className={`btn ${responseType === 'EMBED' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setResponseType('EMBED')}
                  >
                    Tarjeta Embed
                  </button>
                </div>
              </div>
            </div>

            {responseType === 'TEXT' ? (
              <div className="field">
                <label>Respuesta de Texto</label>
                <textarea
                  rows={6}
                  placeholder="Escribe el mensaje de respuesta aquí..."
                  value={textResponse}
                  onChange={e => setTextResponse(e.target.value)}
                  required
                />
                <span className="hint">
                  Soporta markdown de Discord. Puedes usar placeholders como: <code>{`{user}`}</code> (mención al usuario), <code>{`{username}`}</code>, o <code>{`{channel}`}</code>.
                </span>
              </div>
            ) : (
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label>Configuración de Tarjeta Embed</label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setRawJsonMode(!rawJsonMode)}
                  >
                    <Code size={12} /> {rawJsonMode ? 'Formulario visual' : 'Editar JSON crudo'}
                  </button>
                </div>

                {rawJsonMode ? (
                  <div>
                    <textarea
                      rows={10}
                      style={{ fontFamily: 'monospace', fontSize: 13 }}
                      placeholder={`{\n  "title": "Título del Embed",\n  "description": "Descripción...",\n  "color": "#5865F2"\n}`}
                      value={rawJsonText}
                      onChange={e => setRawJsonText(e.target.value)}
                    />
                    <span className="hint">Ingresa un objeto JSON válido que respete el formato de Discord Embed.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="split-row" style={{ gap: 16 }}>
                      <div className="field split-col">
                        <label>Título del Embed</label>
                        <input
                          type="text"
                          placeholder="Título de la tarjeta"
                          value={embedTitle}
                          onChange={e => setEmbedTitle(e.target.value)}
                        />
                      </div>
                      <div className="field split-col">
                        <label>Color (Hex)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="color"
                            value={embedColor}
                            onChange={e => setEmbedColor(e.target.value)}
                            style={{ width: 42, height: 42, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          />
                          <input
                            type="text"
                            placeholder="#5865F2"
                            value={embedColor}
                            onChange={e => setEmbedColor(e.target.value)}
                            style={{ flex: 1 }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="field">
                      <label>Descripción / Contenido</label>
                      <textarea
                        rows={4}
                        placeholder="Cuerpo principal del mensaje..."
                        value={embedDesc}
                        onChange={e => setEmbedDesc(e.target.value)}
                      />
                    </div>

                    <div className="split-row" style={{ gap: 16 }}>
                      <div className="field split-col">
                        <label>URL Miniatura (Thumbnail)</label>
                        <input
                          type="text"
                          placeholder="https://ejemplo.com/icono.png"
                          value={embedThumbnail}
                          onChange={e => setEmbedThumbnail(e.target.value)}
                        />
                      </div>
                      <div className="field split-col">
                        <label>URL Imagen Grande</label>
                        <input
                          type="text"
                          placeholder="https://ejemplo.com/imagen.png"
                          value={embedImage}
                          onChange={e => setEmbedImage(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label>Texto del Pie (Footer)</label>
                      <input
                        type="text"
                        placeholder="Texto pequeño al fondo"
                        value={embedFooter}
                        onChange={e => setEmbedFooter(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <span className="hint" style={{ marginTop: 6, display: 'block' }}>
                  Puedes usar variables como <code>{`{user}`}</code>, <code>{`{username}`}</code>, o <code>{`{channel}`}</code> en el título y la descripción.
                </span>
              </div>
            )}

            <div className="split-row" style={{ gap: 20 }}>
              <div className="field split-col">
                <label>Canal Destino</label>
                <select
                  value={targetChannelId}
                  onChange={e => setTargetChannelId(e.target.value)}
                >
                  <option value="">Donde se ejecute el comando (Predeterminado)</option>
                  {structure.textChannels && structure.textChannels.map(c => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
                <span className="hint">Escoge si quieres redirigir la respuesta a un canal específico.</span>
              </div>

              <div className="field split-col">
                <label>Cooldown (Segundos)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Sin Cooldown"
                  value={cooldown}
                  onChange={e => setCooldown(Number(e.target.value))}
                />
                <span className="hint">Tiempo mínimo de espera por usuario antes de volver a usarlo.</span>
              </div>
            </div>

            <div className="split-row" style={{ gap: 20 }}>
              <div className="field split-col">
                <label>Rol Requerido (Opcional)</label>
                <select
                  value={requiredRoleId}
                  onChange={e => setRequiredRoleId(e.target.value)}
                >
                  <option value="">Cualquier usuario (Sin restricción)</option>
                  {structure.roles && structure.roles.map(r => (
                    <option key={r.id} value={r.id}>@{r.name}</option>
                  ))}
                </select>
                <span className="hint">Solo los miembros con este rol podrán usar el disparador.</span>
              </div>

              <div className="field split-col">
                <label>Rol Excluido (Opcional)</label>
                <select
                  value={ignoredRoleId}
                  onChange={e => setIgnoredRoleId(e.target.value)}
                >
                  <option value="">Ninguno (Sin excluir roles)</option>
                  {structure.roles && structure.roles.map(r => (
                    <option key={r.id} value={r.id}>@{r.name}</option>
                  ))}
                </select>
                <span className="hint">Los miembros con este rol NO podrán usar el disparador.</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Save size={16} /> Guardar Disparador
              </button>
              <button type="button" onClick={handleCancelEdit} className="btn btn-secondary">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <div className="section-header-icon" style={{ backgroundColor: 'rgba(52, 152, 219, 0.1)', color: '#3498db' }}>
            <MessageSquare size={14} />
          </div>
          <h2>Disparadores Registrados</h2>
        </div>
        <div className="section-body">
          {loading ? (
            <p style={{ color: 'var(--txt-3)', fontSize: 13, textAlign: 'center', padding: 20 }}>Cargando disparadores...</p>
          ) : triggers.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--txt-3)' }}>
              <MessageSquare size={48} style={{ margin: '0 auto 16px auto', opacity: 0.15 }} />
              <p style={{ margin: 0, fontSize: 14 }}>No hay disparadores personalizados configurados.</p>
              <button onClick={handleStartNew} className="btn btn-secondary" style={{ marginTop: 12, display: 'inline-flex', gap: 6 }}>
                <Plus size={14} /> Crear mi primer disparador
              </button>
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ padding: 12, color: 'var(--txt-3)' }}>Disparador</th>
                    <th style={{ padding: 12, color: 'var(--txt-3)' }}>Tipo</th>
                    <th style={{ padding: 12, color: 'var(--txt-3)' }}>Canal Destino</th>
                    <th style={{ padding: 12, color: 'var(--txt-3)' }}>Roles (Req / Excl)</th>
                    <th style={{ padding: 12, color: 'var(--txt-3)' }}>Cooldown</th>
                    <th style={{ padding: 12, textAlign: 'right', color: 'var(--txt-3)' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {triggers.map(t => {
                    const requiredRole = structure.roles?.find(r => r.id === t.requiredRoleId);
                    const ignoredRole = structure.roles?.find(r => r.id === t.ignoredRoleId);
                    const targetChan = structure.textChannels?.find(c => c.id === t.targetChannelId);

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: 12, fontWeight: 700, color: '#fff' }}>
                          <code>{t.trigger}</code>
                        </td>
                        <td style={{ padding: 12 }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: t.responseType === 'EMBED' ? 'rgba(155, 89, 182, 0.2)' : 'rgba(52, 152, 219, 0.2)',
                            color: t.responseType === 'EMBED' ? '#9b59b6' : '#3498db'
                          }}>
                            {t.responseType}
                          </span>
                        </td>
                        <td style={{ padding: 12, color: 'var(--txt-2)' }}>
                          {targetChan ? `#${targetChan.name}` : <em style={{ opacity: 0.5 }}>Origen</em>}
                        </td>
                        <td style={{ padding: 12 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {requiredRole ? (
                              <span style={{ color: requiredRole.color || '#fff', fontSize: 12 }}>
                                🟢 Req: <strong>@{requiredRole.name}</strong>
                              </span>
                            ) : null}
                            {ignoredRole ? (
                              <span style={{ color: '#e74c3c', fontSize: 12 }}>
                                🔴 Excl: <strong>@{ignoredRole.name}</strong>
                              </span>
                            ) : null}
                            {!requiredRole && !ignoredRole ? (
                              <span style={{ opacity: 0.4 }}>Ninguno</span>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ padding: 12, color: 'var(--txt-2)' }}>
                          {t.cooldown > 0 ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} /> {t.cooldown}s
                            </span>
                          ) : (
                            <span style={{ opacity: 0.4 }}>Sin límite</span>
                          )}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              onClick={() => handleStartEdit(t)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: 12 }}
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteTrigger(t.id, t.trigger)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: 12, color: '#e74c3c' }}
                            >
                              <Trash2 size={12} />
                            </button>
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
};
