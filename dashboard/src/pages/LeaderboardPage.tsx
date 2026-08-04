import React from 'react';
import { Users } from 'lucide-react';
import type { UserXP } from '../types';

interface LeaderboardPageProps {
  lb: UserXP[];
  fmtTime: (seconds: number) => string;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ lb, fmtTime }) => {
  return (
    <div className="page-body">
      <div className="section">
        <div className="section-header">
          <div className="section-header-icon"><Users size={14} /></div>
          <h2>Tabla de clasificación</h2>
          <p>Top {lb.length}</p>
        </div>
        <div className="section-body" style={{ gap: 4 }}>
          {lb.length === 0 && <div className="empty">Sin datos todavía.</div>}
          {lb.map((user, i) => (
            <div className="lb-row" key={user.id}>
              <span className={`lb-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                #{i + 1}
              </span>
              <img className="lb-avatar" src={user.avatar} alt="avatar" />
              <div className="lb-info">
                <div className="lb-name">{user.displayName}</div>
                <div className="lb-sub">
                  {user.messageCount} mensajes y {fmtTime(user.vcSeconds)} en voz
                </div>
              </div>
              <div className="lb-badges">
                {user.prestige !== undefined && user.prestige > 0 && (
                  <span className="badge" style={{ background: 'rgba(241, 196, 15, 0.15)', color: '#f1c40f', border: '1px solid rgba(241, 196, 15, 0.3)' }}>
                     Prestigio {user.prestige}
                  </span>
                )}
                <span className="badge badge-text"> Lvl {user.textLevel}</span>
                <span className="badge badge-voice">️ Lvl {user.voiceLevel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
