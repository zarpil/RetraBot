import { createCanvas, loadImage } from '@napi-rs/canvas';
import { xpForLevel } from './leveling';

// In-memory Cache for Avatars (5 min TTL) to boost performance
const avatarCache = new Map<string, { image: any; expiresAt: number }>();

async function getCachedImage(url: string): Promise<any> {
  const now = Date.now();
  const cached = avatarCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.image;
  }
  const img = await loadImage(url);
  if (avatarCache.size > 200) {
    const firstKey = avatarCache.keys().next().value;
    if (firstKey) avatarCache.delete(firstKey);
  }
  avatarCache.set(url, { image: img, expiresAt: now + 300000 });
  return img;
}

export interface RankCardOptions {
  username: string;
  displayName: string;
  avatarUrl: string;
  rankPosition?: number;
  textLevel: number;
  textXp: number;
  voiceLevel: number;
  voiceXp: number;
  prestige: number;
  messageCount: number;
  vcSeconds: number;
}

export async function generateRankCard(options: RankCardOptions): Promise<Buffer> {
  const width = 850;
  const height = 270;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient / card container
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, '#111319');
  bgGradient.addColorStop(1, '#181b24');
  ctx.fillStyle = bgGradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 16);
  ctx.fill();

  // Subtle card border
  ctx.strokeStyle = '#2d3243';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Decorative subtle accent bar on left edge
  const accentGradient = ctx.createLinearGradient(0, 0, 0, height);
  accentGradient.addColorStop(0, '#5865f2');
  accentGradient.addColorStop(1, '#a78bfa');
  ctx.fillStyle = accentGradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, 8, height, [16, 0, 0, 16]);
  ctx.fill();

  // Load and draw Avatar (cached)
  const avatarRadius = 60;
  const avatarX = 85;
  const avatarY = 95;

  try {
    const avatarImage = await getCachedImage(options.avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImage, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.restore();

    // Avatar Outer Ring
    ctx.strokeStyle = '#5865f2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius + 2, 0, Math.PI * 2, true);
    ctx.stroke();
  } catch (e) {
    ctx.fillStyle = '#5865f2';
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.fill();
  }

  // Display Name & Username
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(options.displayName, 175, 65);

  ctx.font = '500 16px sans-serif';
  ctx.fillStyle = '#8e98b0';
  ctx.fillText(`@${options.username}`, 175, 90);

  // Rank Position Badge (#Rank) & Prestige Badge
  let rightOffset = 40;

  if (options.rankPosition && options.rankPosition > 0) {
    const rankText = `RANK #${options.rankPosition}`;
    ctx.font = 'bold 15px sans-serif';
    const rankWidth = ctx.measureText(rankText).width;
    const rankX = width - rankWidth - rightOffset;
    const rankY = 42;

    ctx.fillStyle = 'rgba(88, 101, 242, 0.18)';
    ctx.strokeStyle = 'rgba(88, 101, 242, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(rankX - 10, rankY - 20, rankWidth + 20, 28, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#7c86ff';
    ctx.fillText(rankText, rankX, rankY);

    rightOffset += rankWidth + 35;
  }

  if (options.prestige > 0) {
    const badgeText = `PRESTIGIO ${options.prestige}`;
    ctx.font = 'bold 13px sans-serif';
    const textWidth = ctx.measureText(badgeText).width;
    const badgeX = width - textWidth - rightOffset;
    const badgeY = 42;

    ctx.fillStyle = 'rgba(241, 196, 15, 0.15)';
    ctx.strokeStyle = 'rgba(241, 196, 15, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(badgeX - 10, badgeY - 19, textWidth + 20, 27, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f1c40f';
    ctx.fillText(badgeText, badgeX, badgeY);
  }

  // Helper for drawing progress bars
  const drawProgressBar = (
    label: string,
    level: number,
    currentXp: number,
    requiredXp: number,
    yPos: number,
    barColorStart: string,
    barColorEnd: string
  ) => {
    const barX = 175;
    const barW = width - barX - 35;
    const barH = 18;

    const percentage = Math.min(100, Math.max(0, Math.floor((currentXp / requiredXp) * 100)));

    // Label & Level
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${label}  Nivel ${level}`, barX, yPos - 8);

    // XP Numbers
    ctx.font = '500 13px sans-serif';
    ctx.fillStyle = '#a0aec0';
    const xpText = `${currentXp.toLocaleString()} / ${requiredXp.toLocaleString()} XP (${percentage}%)`;
    const xpTextWidth = ctx.measureText(xpText).width;
    ctx.fillText(xpText, barX + barW - xpTextWidth, yPos - 8);

    // Bar Background
    ctx.fillStyle = '#222634';
    ctx.beginPath();
    ctx.roundRect(barX, yPos, barW, barH, 9);
    ctx.fill();

    // Bar Fill Progress
    if (percentage > 0) {
      const fillW = Math.max(18, (barW * percentage) / 100);
      const fillGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
      fillGrad.addColorStop(0, barColorStart);
      fillGrad.addColorStop(1, barColorEnd);
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.roundRect(barX, yPos, fillW, barH, 9);
      ctx.fill();
    }
  };

  // 1. Text XP Bar
  const reqTextXp = xpForLevel(options.textLevel);
  drawProgressBar('TEXTO', options.textLevel, options.textXp, reqTextXp, 130, '#4f9eff', '#6366f1');

  // 2. Voice XP Bar
  const reqVoiceXp = xpForLevel(options.voiceLevel);
  drawProgressBar('VOZ', options.voiceLevel, options.voiceXp, reqVoiceXp, 195, '#a78bfa', '#ec4899');

  // Bottom Stats Footer Line
  const vcHours = (options.vcSeconds / 3600).toFixed(1);
  const footerText = `${options.messageCount.toLocaleString()} mensajes  •  ${vcHours} hrs en voz`;
  ctx.font = '500 13px sans-serif';
  ctx.fillStyle = '#718096';
  ctx.fillText(footerText, 175, 248);

  return canvas.toBuffer('image/png');
}

export interface LeaderboardUser {
  rank: number;
  displayName: string;
  avatarUrl: string;
  textLevel: number;
  textXp: number;
  voiceLevel: number;
  vcSeconds: number;
  prestige: number;
}

export interface LeaderboardCardOptions {
  guildName: string;
  category: 'OVERVIEW' | 'TEXT' | 'VOICE' | 'PRESTIGE';
  users: LeaderboardUser[];
  voiceUsers?: LeaderboardUser[];
}

export async function generateLeaderboardCard(options: LeaderboardCardOptions): Promise<Buffer> {
  const width = 820;

  // Overview mode vs Single Category mode
  if (options.category === 'OVERVIEW') {
    const textList = options.users.slice(0, 5);
    const voiceList = (options.voiceUsers || []).slice(0, 5);
    const maxItems = Math.max(textList.length, voiceList.length, 1);
    const rowHeight = 44;
    const headerHeight = 90;
    const height = headerHeight + (maxItems * rowHeight) + 40;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0f1117');
    bgGradient.addColorStop(1, '#161922');
    ctx.fillStyle = bgGradient;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 16);
    ctx.fill();

    ctx.strokeStyle = '#272d3e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top Header Banner
    const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
    headerGrad.addColorStop(0, '#4f9eff');
    headerGrad.addColorStop(0.5, '#a78bfa');
    headerGrad.addColorStop(1, '#ec4899');

    ctx.fillStyle = headerGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, 6, [16, 16, 0, 0]);
    ctx.fill();

    // Title
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CLASIFICACIÓN GENERAL', 30, 48);

    ctx.font = '500 14px sans-serif';
    ctx.fillStyle = '#8e98b0';
    ctx.fillText(`Servidor: ${options.guildName}  •  Usa los botones para ver el Top 10 detallado`, 30, 72);

    const halfW = (width - 60) / 2;

    // Subheader Column 1: TEXT
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#4f9eff';
    ctx.fillText('TOP 5 TEXTO', 30, 105);

    // Subheader Column 2: VOICE
    ctx.fillStyle = '#a78bfa';
    ctx.fillText('TOP 5 VOZ', 30 + halfW + 20, 105);

    const startY = 120;

    // Draw Column 1: Text Users
    for (let i = 0; i < textList.length; i++) {
      const u = textList[i];
      const y = startY + (i * rowHeight);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.beginPath();
      ctx.roundRect(30, y, halfW, rowHeight - 6, 8);
      ctx.fill();

      // Rank
      const rankLabel = `#${i + 1}`;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = i === 0 ? '#f1c40f' : i === 1 ? '#bdc3c7' : i === 2 ? '#e67e22' : '#718096';
      ctx.fillText(rankLabel, 40, y + 24);

      // Avatar
      try {
        const avImg = await getCachedImage(u.avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(88, y + 19, 12, 0, Math.PI * 2, true);
        ctx.clip();
        ctx.drawImage(avImg, 76, y + 7, 24, 24);
        ctx.restore();
      } catch (e) {}

      // Name & Level
      ctx.font = '600 13px sans-serif';
      ctx.fillStyle = '#f0f0f0';
      ctx.fillText(u.displayName.slice(0, 14), 108, y + 24);

      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#4f9eff';
      ctx.fillText(`Lvl ${u.textLevel}`, 30 + halfW - 55, y + 24);
    }

    // Draw Column 2: Voice Users
    for (let i = 0; i < voiceList.length; i++) {
      const u = voiceList[i];
      const y = startY + (i * rowHeight);
      const colX = 30 + halfW + 20;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.beginPath();
      ctx.roundRect(colX, y, halfW, rowHeight - 6, 8);
      ctx.fill();

      // Rank
      const rankLabel = `#${i + 1}`;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = i === 0 ? '#f1c40f' : i === 1 ? '#bdc3c7' : i === 2 ? '#e67e22' : '#718096';
      ctx.fillText(rankLabel, colX + 10, y + 24);

      // Avatar
      try {
        const avImg = await getCachedImage(u.avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(colX + 58, y + 19, 12, 0, Math.PI * 2, true);
        ctx.clip();
        ctx.drawImage(avImg, colX + 46, y + 7, 24, 24);
        ctx.restore();
      } catch (e) {}

      // Name & Level
      ctx.font = '600 13px sans-serif';
      ctx.fillStyle = '#f0f0f0';
      ctx.fillText(u.displayName.slice(0, 14), colX + 78, y + 24);

      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#a78bfa';
      ctx.fillText(`Lvl ${u.voiceLevel}`, colX + halfW - 55, y + 24);
    }

    return canvas.toBuffer('image/png');
  }

  // Single Detailed Mode (TEXT / VOICE / PRESTIGE)
  const userCount = Math.max(1, options.users.length);
  const rowHeight = 46;
  const headerHeight = 90;
  const paddingBottom = 25;
  const height = headerHeight + (userCount * rowHeight) + paddingBottom;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, '#0f1117');
  bgGradient.addColorStop(1, '#161922');
  ctx.fillStyle = bgGradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 16);
  ctx.fill();

  ctx.strokeStyle = '#272d3e';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header Colors & Title by Category
  let headerTitle = 'CLASIFICACIÓN DE TEXTO (TOP 10)';
  let accentColorStart = '#4f9eff';
  let accentColorEnd = '#6366f1';

  if (options.category === 'VOICE') {
    headerTitle = 'CLASIFICACIÓN DE VOZ (TOP 10)';
    accentColorStart = '#a78bfa';
    accentColorEnd = '#ec4899';
  } else if (options.category === 'PRESTIGE') {
    headerTitle = 'CLASIFICACIÓN DE PRESTIGIOS';
    accentColorStart = '#f1c40f';
    accentColorEnd = '#f39c12';
  }

  // Header Banner Background
  const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
  headerGrad.addColorStop(0, accentColorStart);
  headerGrad.addColorStop(1, accentColorEnd);

  ctx.fillStyle = headerGrad;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, 6, [16, 16, 0, 0]);
  ctx.fill();

  // Header Text
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(headerTitle, 30, 48);

  ctx.font = '500 14px sans-serif';
  ctx.fillStyle = '#8e98b0';
  ctx.fillText(`Servidor: ${options.guildName}`, 30, 72);

  // Rows
  const startY = headerHeight;

  if (options.users.length === 0) {
    ctx.font = '500 15px sans-serif';
    ctx.fillStyle = '#718096';
    ctx.fillText('No hay datos registrados aún en este módulo.', 30, startY + 35);
  } else {
    for (let i = 0; i < options.users.length; i++) {
      const user = options.users[i];
      const y = startY + (i * rowHeight);

      // Row background zebra stripe
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.beginPath();
        ctx.roundRect(20, y, width - 40, rowHeight - 4, 8);
        ctx.fill();
      }

      // Rank Label
      const rankX = 40;
      const rankY = y + 26;
      ctx.font = 'bold 15px sans-serif';

      if (user.rank === 1) {
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('#1', rankX, rankY);
      } else if (user.rank === 2) {
        ctx.fillStyle = '#bdc3c7';
        ctx.fillText('#2', rankX, rankY);
      } else if (user.rank === 3) {
        ctx.fillStyle = '#e67e22';
        ctx.fillText('#3', rankX, rankY);
      } else {
        ctx.fillStyle = '#718096';
        ctx.fillText(`#${user.rank}`, rankX, rankY);
      }

      // Avatar (cached)
      const avX = 100;
      const avY = y + 21;
      const avR = 14;

      try {
        const avImg = await getCachedImage(user.avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avX, avY, avR, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avImg, avX - avR, avY - avR, avR * 2, avR * 2);
        ctx.restore();
      } catch (e) {
        ctx.fillStyle = '#5865f2';
        ctx.beginPath();
        ctx.arc(avX, avY, avR, 0, Math.PI * 2, true);
        ctx.fill();
      }

      // User Display Name
      ctx.font = '600 15px sans-serif';
      ctx.fillStyle = '#f0f0f0';
      ctx.fillText(user.displayName, 130, y + 26);

      // Prestige Badge tag if text/voice category and prestige > 0
      if (options.category !== 'PRESTIGE' && user.prestige > 0) {
        const nameWidth = ctx.measureText(user.displayName).width;
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(`[P${user.prestige}]`, 140 + nameWidth, y + 26);
      }

      // Right Stats
      let statText = '';
      if (options.category === 'TEXT') {
        statText = `Lvl ${user.textLevel}    ${user.textXp.toLocaleString()} XP`;
      } else if (options.category === 'VOICE') {
        const hrs = (user.vcSeconds / 3600).toFixed(1);
        statText = `Lvl ${user.voiceLevel}    ${hrs}h en voz`;
      } else {
        statText = `Prestigio ${user.prestige}    Lvl ${user.textLevel} Texto`;
      }

      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = options.category === 'PRESTIGE' ? '#f1c40f' : '#a0aec0';
      const statW = ctx.measureText(statText).width;
      ctx.fillText(statText, width - 40 - statW, y + 26);
    }
  }

  return canvas.toBuffer('image/png');
}
