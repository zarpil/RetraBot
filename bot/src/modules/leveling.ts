import { Message, VoiceState, TextChannel, GuildMember, Guild } from 'discord.js';
import { prisma } from 'shared';

// Throttling for message XP: map of `${guildId}-${userId}` => timestamp of last XP awarded
const xpCooldowns = new Map<string, number>();

// Track join times for VC XP: key is `${guildId}-${userId}`
const vcJoinTimes = new Map<string, number>();

// ─── SISTEMA DE XP DE TEXTO (Progresión Lineal) ─────────────────────────────
// XP necesaria para subir un nivel: xpNeeded = level * 100
// XP total para alcanzar un nivel:  totalXp = 50 * level * (level - 1) + 100

/**
 * XP necesaria para subir del nivel `level` al siguiente (texto).
 * Nivel 0→1 requiere 100 XP, Nivel 1→2 requiere 100 XP, Nivel 2→3 requiere 200 XP...
 * Fórmula: level * 100  (mínimo 100 para nivel 0)
 */
export function xpForLevel(level: number): number {
  return Math.max(level, 1) * 100;
}

/**
 * XP total acumulada necesaria para alcanzar `level` desde cero (texto).
 * totalXp = 50 * level * (level - 1) + 100
 */
export function getTotalXpForLevel(level: number): number {
  if (level <= 0) return 0;
  return 50 * level * (level - 1) + 100;
}

/**
 * Convierte XP total acumulada en { level, xp } para el sistema de texto.
 * Invierte la fórmula: 50*L*(L-1)+100 <= totalXp  →  resuelve L con la cuadrática.
 */
export function getLevelAndXpFromTotal(totalXp: number): { level: number; xp: number } {
  if (totalXp < 100) return { level: 0, xp: Math.max(0, totalXp) };

  // Resolver: 50*L*(L-1) + 100 <= totalXp
  // 50L² - 50L + 100 - totalXp <= 0
  // L = (50 + sqrt(50² + 4*50*(totalXp-100))) / (2*50)
  const discriminant = 50 * 50 + 4 * 50 * (totalXp - 100);
  const maxLevel = Math.floor((50 + Math.sqrt(discriminant)) / (2 * 50));

  // Ajuste fino (por redondeos de float)
  let level = maxLevel;
  while (getTotalXpForLevel(level + 1) <= totalXp) level++;
  while (level > 0 && getTotalXpForLevel(level) > totalXp) level--;

  const xp = totalXp - getTotalXpForLevel(level);
  return { level, xp: Math.max(0, xp) };
}

// ─── SISTEMA DE XP DE VOZ (Progresión ActivityRank) ──────────────────────────
// XP necesaria para el siguiente nivel:
// voiceXpRequired(level) = ((level * (level + 1)) / 2) * 130 + (level * 100)

const VOICE_LEVEL_FACTOR = 130;

/**
 * XP necesaria para subir del nivel `level` al siguiente (voz).
 * Usa Math.max(level, 1) para evitar coste 0 en nivel 0.
 */
export function xpForVoiceLevel(level: number): number {
  const l = Math.max(level, 1);
  return ((l * (l + 1)) / 2) * VOICE_LEVEL_FACTOR + (l * 100);
}

/**
 * XP total acumulada necesaria para alcanzar `level` desde cero (voz).
 */
export function getTotalXpForVoiceLevel(level: number): number {
  let total = 0;
  for (let lvl = 0; lvl < level; lvl++) {
    total += xpForVoiceLevel(lvl);
  }
  return total;
}

/**
 * Convierte XP total acumulada en { level, xp } para el sistema de voz.
 */
export function getLevelAndXpFromTotalVoice(totalXp: number): { level: number; xp: number } {
  let lvl = 0;
  let remainingXp = Math.max(0, totalXp);

  while (remainingXp >= xpForVoiceLevel(lvl)) {
    remainingXp -= xpForVoiceLevel(lvl);
    lvl++;
  }

  return { level: lvl, xp: remainingXp };
}


/**
 * Helper to generate random integer between min and max inclusive.
 */
function getRandomXp(min: number, max: number): number {
  const minVal = Math.min(min, max);
  const maxVal = Math.max(min, max);
  return Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
}

/**
 * Handle leveling for message creation (TEXT MODULE).
 */
export async function handleMessageXP(message: Message) {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const channelId = message.channel.id;
  const cooldownKey = `${guildId}-${userId}`;

  let config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config) {
    config = await prisma.guildConfig.create({ data: { guildId } });
  }

  if (!config.levelingEnabled) return;

  // Check ignored channels
  if (config.ignoredChannels) {
    const ignoredList = config.ignoredChannels.split(',').map((id) => id.trim());
    if (ignoredList.includes(channelId)) return;
  }

  // Check ignored roles for text
  if (config.ignoredRoles && message.member) {
    const ignoredRoleList = config.ignoredRoles.split(',').map((id) => id.trim());
    if (message.member.roles.cache.some((r) => ignoredRoleList.includes(r.id))) return;
  }

  // Check cooldown
  const now = Date.now();
  const lastXpTime = xpCooldowns.get(cooldownKey) || 0;
  const cooldownMs = (config.xpCooldownSeconds || 60) * 1000;

  if (now - lastXpTime < cooldownMs) return;

  // Update cooldown timestamp
  xpCooldowns.set(cooldownKey, now);

  const xpToGive = getRandomXp(config.minXpPerMessage, config.maxXpPerMessage);
  await addXP(guildId, userId, 'TEXT', xpToGive, message, 0);
}

/**
 * Helper to process (award) accumulated voice XP for a user and remove/reset tracking.
 */
async function awardVoiceXpForUser(guildId: string, userId: string, guild: any, config: any) {
  const key = `${guildId}-${userId}`;
  const joinTime = vcJoinTimes.get(key);
  if (!joinTime) return;

  vcJoinTimes.delete(key);
  const now = Date.now();
  const secondsSpent = Math.floor((now - joinTime) / 1000);

  if (secondsSpent > 0 && config.xpPerMinuteVc > 0) {
    const minutesSpent = secondsSpent / 60;
    const xpToGive = Math.floor(minutesSpent * config.xpPerMinuteVc);

    if (xpToGive > 0) {
      await addXP(guildId, userId, 'VOICE', xpToGive, null, secondsSpent, guild);
    }
  }
}

/**
 * Handle leveling for voice channel updates (VOICE MODULE).
 * Implements Anti-AFK (Deafen check) & Anti-Solo (requires >= 2 non-bot members in VC).
 */
export async function handleVoiceXP(oldState: VoiceState, newState: VoiceState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const guildId = member.guild.id;
  let config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config) {
    config = await prisma.guildConfig.create({ data: { guildId } });
  }

  if (!config.levelingEnabled) return;

  const oldChannel = oldState.channel;
  const newChannel = newState.channel;

  const now = Date.now();

  // Helper to check if a member is valid for XP (not deafened, not in ignored channel, not ignored role)
  const isMemberValidForXP = (m: GuildMember, channelId: string) => {
    if (m.user.bot) return false;
    if (m.voice.deaf || m.voice.selfDeaf) return false;
    if (config.ignoredChannels) {
      const ignoredList = config.ignoredChannels.split(',').map(id => id.trim());
      if (ignoredList.includes(channelId)) return false;
    }
    if (config.ignoredRoles) {
      const ignoredRoleList = config.ignoredRoles.split(',').map(id => id.trim());
      if (m.roles.cache.some(r => ignoredRoleList.includes(r.id))) return false;
    }
    return true;
  };

  // 1. Process Old Channel (if member left or moved away)
  if (oldChannel && oldChannel.id !== newChannel?.id) {
    const oldKey = `${guildId}-${member.id}`;
    if (vcJoinTimes.has(oldKey)) {
      await awardVoiceXpForUser(guildId, member.id, member.guild, config);
    }

    // Re-evaluate remaining non-bot members in old channel. If now only 1 human left, award & stop their timer.
    const remainingHumans = oldChannel.members.filter(m => !m.user.bot);
    if (remainingHumans.size < 2) {
      for (const [remId, remMember] of remainingHumans) {
        const remKey = `${guildId}-${remId}`;
        if (vcJoinTimes.has(remKey)) {
          await awardVoiceXpForUser(guildId, remId, member.guild, config);
        }
      }
    }
  }

  // 2. Process New Channel (if member joined or moved in or changed state like deafen)
  if (newChannel) {
    const humanMembers = newChannel.members.filter(m => !m.user.bot);
    const hasEnoughHumans = humanMembers.size >= 2;

    for (const [mId, mObj] of humanMembers) {
      const mKey = `${guildId}-${mId}`;
      const isValid = isMemberValidForXP(mObj, newChannel.id);
      const isCurrentlyTracking = vcJoinTimes.has(mKey);

      if (hasEnoughHumans && isValid) {
        // Start tracking if not already tracking
        if (!isCurrentlyTracking) {
          vcJoinTimes.set(mKey, now);
        }
      } else {
        // If not valid or not enough humans, stop & award if currently tracking
        if (isCurrentlyTracking) {
          await awardVoiceXpForUser(guildId, mId, member.guild, config);
        }
      }
    }
  }
}

/**
 * Synchronizes active voice channels on bot startup so users currently chatting gain XP seamlessly.
 */
export async function syncActiveVoiceChannels(client: any) {
  console.log('🎙️ Sincronizando canales de voz activos...');
  const now = Date.now();

  for (const [guildId, guild] of client.guilds.cache) {
    let config = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (!config || !config.levelingEnabled) continue;

    for (const [channelId, channel] of guild.channels.cache) {
      if (!channel.isVoiceBased()) continue;

      // Check ignored channels
      if (config.ignoredChannels) {
        const ignoredList = config.ignoredChannels.split(',').map((id: string) => id.trim());
        if (ignoredList.includes(channelId)) continue;
      }

      const humanMembers = channel.members.filter((m: GuildMember) => !m.user.bot);
      if (humanMembers.size >= 2) {
        for (const [mId, mObj] of humanMembers) {
          // Check deafen & ignored roles
          if (mObj.voice.deaf || mObj.voice.selfDeaf) continue;
          if (config.ignoredRoles) {
            const ignoredRoleList = config.ignoredRoles.split(',').map((id: string) => id.trim());
            if (mObj.roles.cache.some((r: any) => ignoredRoleList.includes(r.id))) continue;
          }

          const mKey = `${guildId}-${mId}`;
          if (!vcJoinTimes.has(mKey)) {
            vcJoinTimes.set(mKey, now);
          }
        }
      }
    }
  }
  console.log(`✅ Sincronización completada. ${vcJoinTimes.size} usuario(s) en voz rastreados.`);
}

/**
 * Flushes all pending voice XP to database on graceful bot shutdown.
 */
export async function flushVoiceXPBeforeShutdown() {
  console.log('💾 Guardando XP acumulada de voz antes del apagado...');
  for (const [key] of vcJoinTimes.entries()) {
    // Usar indexOf para evitar corrupci\u00f3n si el separador aparece m\u00e1s de una vez
    const separatorIdx = key.indexOf('-');
    const guildId = key.slice(0, separatorIdx);
    const userId = key.slice(separatorIdx + 1);
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (config) {
      await awardVoiceXpForUser(guildId, userId, null, config);
    }
  }
  vcJoinTimes.clear();
  console.log('✅ XP de voz guardada con éxito.');
}

/**
 * Assign level roles by type (TEXT or VOICE).
 */
export async function checkAndAssignLevelRoles(guildMember: GuildMember, type: 'TEXT' | 'VOICE', newLevel: number) {
  try {
    const levelRoles = await prisma.levelRole.findMany({
      where: {
        guildId: guildMember.guild.id,
        type,
        level: { lte: newLevel },
      },
    });

    for (const lr of levelRoles) {
      if (!guildMember.roles.cache.has(lr.roleId)) {
        await guildMember.roles.add(lr.roleId).catch(() => null);
      }
    }
  } catch (err) {
    console.error(`Error de asignación de roles por nivel (${type}) para ${guildMember.id}:`, err);
  }
}

/**
 * Add XP to user for a specific module ('TEXT' or 'VOICE') and handle level up.
 */
export async function addXP(
  guildId: string,
  userId: string,
  type: 'TEXT' | 'VOICE',
  xpAmount: number,
  messageContext: Message | null = null,
  vcSeconds = 0,
  guildContext: Guild | null = null
) {
  const id = `${guildId}-${userId}`;

  let userXP = await prisma.userXP.findUnique({
    where: { id },
  });

  if (!userXP) {
    userXP = await prisma.userXP.create({
      data: {
        id,
        guildId,
        userId,
        textXp: 0,
        textLevel: 0,
        voiceXp: 0,
        voiceLevel: 0,
        messageCount: 0,
        vcSeconds: 0,
      },
    });
  }

  let currentXp = type === 'TEXT' ? userXP.textXp : userXP.voiceXp;
  let currentLevel = type === 'TEXT' ? userXP.textLevel : userXP.voiceLevel;

  let newXp = currentXp + xpAmount;
  let newLevel = currentLevel;
  let leveledUp = false;

  // Usar la función de XP correcta según el tipo
  const xpNeededFn = type === 'TEXT' ? xpForLevel : xpForVoiceLevel;

  while (newXp >= xpNeededFn(newLevel)) {
    newXp -= xpNeededFn(newLevel);
    newLevel++;
    leveledUp = true;
  }

  const updateData: any = {
    lastActive: new Date(),
  };

  if (type === 'TEXT') {
    updateData.textXp = newXp;
    updateData.textLevel = newLevel;
    if (messageContext) {
      updateData.messageCount = userXP.messageCount + 1;
      updateData.monthlyMessageCount = userXP.monthlyMessageCount + 1;
    }
  } else {
    updateData.voiceXp = newXp;
    updateData.voiceLevel = newLevel;
    updateData.vcSeconds = userXP.vcSeconds + vcSeconds;
    updateData.monthlyVcSeconds = userXP.monthlyVcSeconds + vcSeconds;
  }

  await prisma.userXP.update({
    where: { id },
    data: updateData,
  });

  if (leveledUp) {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (!config) return;

    const guild = messageContext?.guild || guildContext;
    if (guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        await checkAndAssignLevelRoles(member, type, newLevel);
      }
    }

    // Deliver Level Up Notification
    const moduleName = type === 'TEXT' ? 'Texto 💬' : 'Voz 🎙️';
    const rawMsg = config.levelUpMessage || "🎉 ¡Enhorabuena {user}! Has subido al **nivel {level}** ({type})!";
    const formattedMsg = rawMsg
      .replace('{user}', `<@${userId}>`)
      .replace('{level}', newLevel.toString())
      .replace('{xp}', newXp.toString())
      .replace('{type}', moduleName)
      .replace('{server}', guild ? guild.name : 'el servidor');

    if (config.levelUpChannelId === 'dm') {
      const user = messageContext?.author || (await guild?.members.fetch(userId))?.user;
      if (user) {
        await user.send(formattedMsg).catch(() => null);
      }
    } else if (config.levelUpChannelId && guild) {
      const targetChannel = guild.channels.cache.get(config.levelUpChannelId) as TextChannel;
      if (targetChannel && targetChannel.isTextBased()) {
        await targetChannel.send(formattedMsg).catch(() => null);
      }
    } else if (messageContext && messageContext.channel && 'send' in messageContext.channel) {
      await (messageContext.channel as any).send(formattedMsg).catch(() => null);
    }
  }
}
