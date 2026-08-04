import React from 'react';
import { X, Search } from 'lucide-react';

interface CreateClanModalProps {
  isOpen: boolean;
  onClose: () => void;
  newClanName: string;
  setNewClanName: (val: string) => void;
  newClanRoleName: string;
  setNewClanRoleName: (val: string) => void;
  newClanColor: string;
  setNewClanColor: (val: string) => void;
  selectedLeaderUser: { id: string; displayName: string; avatar: string } | null;
  setSelectedLeaderUser: (val: { id: string; displayName: string; avatar: string } | null) => void;
  newClanLeaderId: string;
  setNewClanLeaderId: (val: string) => void;
  leaderSearchQuery: string;
  setLeaderSearchQuery: (val: string) => void;
  isSearchingLeader: boolean;
  leaderSearchResults: { id: string; username: string; displayName: string; avatar: string }[];
  handleCreateClanSubmit: (e: React.FormEvent) => void;
}

export const CreateClanModal: React.FC<CreateClanModalProps> = ({
  isOpen,
  onClose,
  newClanName,
  setNewClanName,
  newClanRoleName,
  setNewClanRoleName,
  newClanColor,
  setNewClanColor,
  selectedLeaderUser,
  setSelectedLeaderUser,
  newClanLeaderId: _newClanLeaderId,
  setNewClanLeaderId,
  leaderSearchQuery,
  setLeaderSearchQuery,
  isSearchingLeader,
  leaderSearchResults,
  handleCreateClanSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          maxWidth: 520,
          width: '100%',
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🛡️ Registrar Nuevo Clan</h3>
          <button
            type="button"
            className="btn"
            style={{ padding: '4px 8px', background: 'transparent' }}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleCreateClanSubmit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Nombre del Clan</label>
            <input
              type="text"
              placeholder="Ej. Los Inmortales"
              value={newClanName}
              onChange={e => setNewClanName(e.target.value)}
              required
            />
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Nombre del Rol de Discord (Opcional)</label>
            <input
              type="text"
              placeholder="Ej. 🛡️ Inmortal (por defecto igual al clan)"
              value={newClanRoleName}
              onChange={e => setNewClanRoleName(e.target.value)}
            />
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Color Temático del Clan</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={newClanColor}
                onChange={e => setNewClanColor(e.target.value)}
                style={{ width: 40, height: 36, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={newClanColor}
                onChange={e => setNewClanColor(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 16, position: 'relative' }}>
            <label>Líder del Clan (Búsqueda ágil por Nombre o ID de Discord)</label>
            
            {selectedLeaderUser ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--accent)',
                  borderRadius: 8,
                  padding: '8px 12px',
                }}
              >
                <img
                  src={selectedLeaderUser.avatar}
                  alt="avatar"
                  style={{ width: 28, height: 28, borderRadius: '50%' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-1)' }}>
                    {selectedLeaderUser.displayName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>
                    ID: {selectedLeaderUser.id}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
                  onClick={() => {
                    setSelectedLeaderUser(null);
                    setNewClanLeaderId('');
                    setLeaderSearchQuery('');
                  }}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Escribe el nombre o pega la ID del usuario..."
                    value={leaderSearchQuery}
                    onChange={e => {
                      setLeaderSearchQuery(e.target.value);
                      setNewClanLeaderId(e.target.value);
                    }}
                    style={{ paddingRight: 36 }}
                    required
                  />
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--txt-3)',
                    }}
                  />
                </div>

                {leaderSearchQuery.trim().length > 0 && !selectedLeaderUser && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      maxHeight: 180,
                      overflowY: 'auto',
                      zIndex: 20,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      marginTop: 4,
                    }}
                  >
                    {isSearchingLeader ? (
                      <div style={{ padding: 10, fontSize: 12, color: 'var(--txt-3)', textAlign: 'center' }}>
                         Buscando en servidor (+50k miembros)...
                      </div>
                    ) : leaderSearchResults.length > 0 ? (
                      leaderSearchResults.map(u => (
                        <div
                          key={u.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border)',
                          }}
                          onClick={() => {
                            setSelectedLeaderUser(u);
                            setNewClanLeaderId(u.id);
                            setLeaderSearchQuery('');
                          }}
                        >
                          <img src={u.avatar} alt="avatar" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt-1)' }}>{u.displayName}</div>
                            <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>@{u.username} ({u.id})</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: 10, fontSize: 12, color: 'var(--txt-3)', textAlign: 'center' }}>
                        Pega la ID directa si no aparece en la búsqueda.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              className="btn"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              🛡️ Crear Clan en Discord
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
