import { 
  VoiceState, 
  GuildMember, 
  Client, 
  Message, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { prisma } from 'shared';

// Map to track active voice join timestamps in clan VCs: key is `${guildId}-${clanId}-${userId}`
const clanVcJoinTimes = new Map<string, number>();

let discordClient: Client | null = null;
export function setClansClient(client: Client) {
  discordClient = client;
}

/**
 * Sends audit log embed to configured clansLogChannelId
 */
export async function sendClanLog(guildId: string, embed: EmbedBuilder) {
  if (!discordClient) return;
  try {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (!config || !config.clansLogChannelId) return;

    const channel = await discordClient.channels.fetch(config.clansLogChannelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      await (channel as any).send({ embeds: [embed] }).catch(() => null);
    }
  } catch (e) {
    // Ignore logging errors silently
  }
}

/**
 * Gets current YYYY-MM string formatted for monthly stats.
 */
function getYearMonthString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Helper to generate the monthly stats embed for a clan
async function buildClanStatsEmbed(guildId: string, clan: any) {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const yearMonth = getYearMonthString();
  const members = await prisma.clanMember.findMany({ where: { clanId: clan.id } });

  const goalMode = config?.clanGoalMode || 'FIXED';
  const goalHours = goalMode === 'PER_MEMBER'
    ? (members.length * (config?.clanHoursPerMember ?? 10))
    : (config?.monthlyClanHoursGoal ?? 50);

  const stats = await prisma.clanMemberMonthlyStats.findMany({
    where: { clanId: clan.id, yearMonth },
  });

  const totalSeconds = stats.reduce((acc, s) => acc + s.secondsSpent, 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);
  const remainingHours = Math.max(0, goalHours - (totalSeconds / 3600)).toFixed(1);

  let memberLines = '';
  if (members.length === 0) {
    memberLines = '*No hay miembros registrados.*';
  } else {
    const statsMap = new Map(stats.map(s => [s.userId, s.secondsSpent]));
    memberLines = members.map(m => {
      const secs = statsMap.get(m.userId) || 0;
      const hrs = (secs / 3600).toFixed(1);
      return `• <@${m.userId}> ➔ **${hrs}h** en voz`;
    }).join('\n');
  }

  const shieldsText = clan.immunityShields > 0
    ? `🧊 **Escudos de Inmunidad (Hielitos)**: **${clan.immunityShields}/3 activos** (Protegido contra borrados)`
    : `🧊 **Escudos de Inmunidad (Hielitos)**: **0/3 activos** (Sin protección activa)`;

  return new EmbedBuilder()
    .setTitle(`📊 REPORTE DE HORAS MENSUALES — ${clan.name}`)
    .setColor(clan.colorHex as any || 0x5865F2)
    .setDescription(`📅 **Mes Actual**: \`${yearMonth}\`\n🎯 **Meta Mensual del Clan**: **${goalHours}h**\n⏱️ **Horas Acumuladas**: **${totalHours}h** / **${goalHours}h**\n⏳ **Horas Restantes**: **${remainingHours}h**\n${shieldsText}\n💰 **Saldo ${config?.clanCurrencyName || 'GloriCoins'}**: **${clan.coins.toFixed(1)}**\n\n👥 **DESGLOSE POR MIEMBRO:**\n${memberLines}`)
    .setFooter({ text: `Estado: ${parseFloat(totalHours) >= goalHours ? '✅ Meta Cumplida' : clan.immunityShields > 0 ? '🧊 Protegido con Hielito' : '⚠️ En Progreso'}` });
}

/**
 * Helper to process (award) accumulated voice time for a user in a clan VC.
 */
async function awardClanVoiceTimeForUser(guildId: string, clanId: string, userId: string) {
  const key = `${guildId}-${clanId}-${userId}`;
  const joinTime = clanVcJoinTimes.get(key);
  if (!joinTime) return;

  clanVcJoinTimes.delete(key);
  const now = Date.now();
  const secondsSpent = Math.floor((now - joinTime) / 1000);

  if (secondsSpent > 0) {
    const todayDate = new Date();
    const yearMonth = getYearMonthString(todayDate);
    const dayStr = String(todayDate.getDate()).padStart(2, '0');
    const fullDayKey = `${yearMonth}-${dayStr}`; // e.g. "2026-07-24"
    const statsId = `${clanId}-${userId}-${yearMonth}`;

    const existing = await prisma.clanMemberMonthlyStats.findUnique({ where: { id: statsId } });
    let dailyMap: Record<string, number> = {};
    if (existing && existing.dailyStatsJson) {
      try { dailyMap = JSON.parse(existing.dailyStatsJson); } catch {}
    }

    dailyMap[fullDayKey] = (dailyMap[fullDayKey] || 0) + secondsSpent;

    await prisma.clanMemberMonthlyStats.upsert({
      where: { id: statsId },
      update: {
        secondsSpent: { increment: secondsSpent },
        dailyStatsJson: JSON.stringify(dailyMap),
      },
      create: {
        id: statsId,
        clanId,
        guildId,
        userId,
        yearMonth,
        secondsSpent,
        dailyStatsJson: JSON.stringify(dailyMap),
      },
    });

    // Award clan coins (GloriCoins)
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    const coinsPerHour = config?.clanCoinsPerHour ?? 0.5;
    const coinsEarned = (secondsSpent / 3600) * coinsPerHour;

    if (coinsEarned > 0) {
      await prisma.clan.update({
        where: { id: clanId },
        data: {
          coins: { increment: coinsEarned },
        },
      }).catch(() => null);
    }
  }
}

/**
 * Voice State Update handler specifically for Clan VCs with Anti-AFK rules:
 * 1. Excludes deafened / self-deafened members.
 * 2. Requires at least 2 non-bot members active in the VC (Anti-Solo).
 */
export async function handleClanVoiceXP(oldState: VoiceState, newState: VoiceState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const guildId = member.guild.id;

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (config && config.clansEnabled === false) return;

  // Get all clans in this guild to map voice channels
  const clans = await prisma.clan.findMany({ where: { guildId } });
  if (clans.length === 0) return;

  const clanVcMap = new Map(clans.map(c => [c.voiceChannelId, c]));

  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  const now = Date.now();

  const isMemberValidForClanTime = (m: GuildMember) => {
    if (m.user.bot) return false;
    if (m.voice.deaf || m.voice.selfDeaf) return false;
    return true;
  };

  // 1. Process Old Channel (if member left or moved away from a clan VC)
  if (oldChannel && oldChannel.id !== newChannel?.id) {
    const oldClan = clanVcMap.get(oldChannel.id);
    if (oldClan) {
      const oldKey = `${guildId}-${oldClan.id}-${member.id}`;
      if (clanVcJoinTimes.has(oldKey)) {
        await awardClanVoiceTimeForUser(guildId, oldClan.id, member.id);
      }

      // Re-evaluate remaining non-bot members in old clan channel. If < 2 remain, stop timers.
      const remainingHumans = oldChannel.members.filter(m => !m.user.bot);
      if (remainingHumans.size < 2) {
        for (const [remId] of remainingHumans) {
          const remKey = `${guildId}-${oldClan.id}-${remId}`;
          if (clanVcJoinTimes.has(remKey)) {
            await awardClanVoiceTimeForUser(guildId, oldClan.id, remId);
          }
        }
      }
    }
  }

  // 2. Process New Channel (if member joined or moved into a clan VC)
  if (newChannel) {
    const newClan = clanVcMap.get(newChannel.id);
    if (newClan) {
      const humanMembers = newChannel.members.filter(m => !m.user.bot);
      const hasEnoughHumans = humanMembers.size >= 2;

      for (const [mId, mObj] of humanMembers) {
        const mKey = `${guildId}-${newClan.id}-${mId}`;
        const isValid = isMemberValidForClanTime(mObj);
        const isCurrentlyTracking = clanVcJoinTimes.has(mKey);

        if (hasEnoughHumans && isValid) {
          if (!isCurrentlyTracking) {
            clanVcJoinTimes.set(mKey, now);
          }
        } else {
          if (isCurrentlyTracking) {
            await awardClanVoiceTimeForUser(guildId, newClan.id, mId);
          }
        }
      }
    }
  }
}

/**
 * Flush pending clan voice stats before bot shutdown.
 */
export async function flushClanVoiceStatsBeforeShutdown() {
  console.log('💾 Guardando tiempo de voz acumulado en Clanes...');
  for (const key of clanVcJoinTimes.keys()) {
    const [guildId, clanId, userId] = key.split('-');
    await awardClanVoiceTimeForUser(guildId, clanId, userId);
  }
  clanVcJoinTimes.clear();
  console.log('✅ Tiempo de clanes guardado con éxito.');
}

// ── CLAN MANAGEMENT & DISCORD INTERACTIONS ─────────────────────────────────

/**
 * Creates a new Clan both in Discord (Role + Voice Channel) and DB.
 */
export async function createClanInDiscordAndDB(
  client: Client,
  guildId: string,
  name: string,
  leaderId: string,
  roleName: string,
  colorHex: string
) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Servidor no encontrado.');

  // Enforce that a user can only lead 1 clan at a time
  const existingLedClan = await prisma.clan.findFirst({
    where: { leaderId }
  });
  if (existingLedClan) {
    throw new Error(`Este usuario ya es líder del clan "${existingLedClan.name}". Un usuario solo puede ser líder de un clan a la vez.`);
  }

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config?.clansCategoryId) {
    throw new Error('Debes configurar la Categoría de Clanes en la pestaña de Ajustes antes de crear un clan.');
  }

  const categoryChannel = guild.channels.cache.get(config.clansCategoryId);
  if (!categoryChannel || categoryChannel.type !== ChannelType.GuildCategory) {
    throw new Error('La Categoría de Clanes configurada no existe en el servidor de Discord.');
  }

  // 1. Create Clan Role
  const clanRole = await guild.roles.create({
    name: roleName.trim(),
    color: (colorHex as any) || '#5865F2',
    reason: `Creación de Clan: ${name}`,
  });

  // 2. Assign Leader Role & Clan Role to Leader
  const leaderMember = await guild.members.fetch(leaderId).catch(() => null);
  if (!leaderMember) {
    await clanRole.delete().catch(() => null);
    throw new Error('El usuario seleccionado como líder no se encuentra en el servidor.');
  }

  if (config.clanLeaderRoleId) {
    const leaderRole = guild.roles.cache.get(config.clanLeaderRoleId);
    if (leaderRole) {
      await leaderMember.roles.add(leaderRole.id).catch(() => null);
    }
  }
  await leaderMember.roles.add(clanRole.id).catch(() => null);

  // 3. Create Clan Voice Channel (inheriting parent category permission overwrites)
  const permissionOverwrites = categoryChannel.permissionOverwrites.cache.map(o => ({
    id: o.id,
    type: o.type,
    allow: o.allow.bitfield,
    deny: o.deny.bitfield,
  }));

  // Deny connect for @everyone (maintain views or other allowed flags)
  const everyoneOverwrite = permissionOverwrites.find(o => o.id === guild.id);
  if (everyoneOverwrite) {
    everyoneOverwrite.deny = BigInt(everyoneOverwrite.deny) | PermissionFlagsBits.Connect;
  } else {
    permissionOverwrites.push({
      id: guild.id,
      type: 0, // Role
      allow: 0n,
      deny: PermissionFlagsBits.Connect,
    });
  }

  // Allow Connect, Speak, ViewChannel for the specific Clan Role
  permissionOverwrites.push({
    id: clanRole.id,
    type: 0, // Role
    allow: PermissionFlagsBits.Connect | PermissionFlagsBits.Speak | PermissionFlagsBits.ViewChannel,
    deny: 0n,
  });

  const voiceChannel = await guild.channels.create({
    name: name.trim(),
    type: ChannelType.GuildVoice,
    parent: config.clansCategoryId,
    permissionOverwrites,
  });

  // 4. Save Clan & Leader in DB
  const clan = await prisma.clan.create({
    data: {
      guildId,
      name: name.trim(),
      leaderId,
      roleId: clanRole.id,
      voiceChannelId: voiceChannel.id,
      colorHex: colorHex || '#5865F2',
    },
  });

  await prisma.clanMember.create({
    data: {
      id: `${clan.id}-${leaderId}`,
      clanId: clan.id,
      guildId,
      userId: leaderId,
    },
  });

  sendClanLog(guildId, new EmbedBuilder()
    .setTitle('🏰 REGISTRO — CLAN CREADO')
    .setColor(colorHex as any || 0x5865F2)
    .setDescription(`¡Se ha creado un nuevo clan en el servidor!\n\n🛡️ **Clan**: <@&${clanRole.id}> (**${name}**)\n👑 **Líder**: <@${leaderId}>\n🔊 **Canal de Voz**: <#${voiceChannel.id}>`)
    .setTimestamp()
  );

  return clan;
}

/**
 * Imports an existing Clan into DB using pre-existing Discord Role and Voice Channel.
 */
export async function importClanToDB(
  client: Client,
  guildId: string,
  name: string,
  leaderId: string,
  roleId: string,
  voiceChannelId: string,
  colorHex?: string
) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Servidor no encontrado.');

  // Enforce that a user can only lead 1 clan at a time
  const existingLedClan = await prisma.clan.findFirst({
    where: { leaderId }
  });
  if (existingLedClan) {
    throw new Error(`Este usuario ya es líder del clan "${existingLedClan.name}". Un usuario solo puede ser líder de un clan a la vez.`);
  }

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });

  // Assign Clan Leader role if configured
  const leaderMember = await guild.members.fetch(leaderId).catch(() => null);
  if (leaderMember) {
    if (config?.clanLeaderRoleId) {
      const leaderRole = guild.roles.cache.get(config.clanLeaderRoleId);
      if (leaderRole) await leaderMember.roles.add(leaderRole.id).catch(() => null);
    }
    const clanRole = guild.roles.cache.get(roleId);
    if (clanRole) await leaderMember.roles.add(clanRole.id).catch(() => null);
  }

  // Get color from role if not provided
  let finalColor = colorHex || '#5865F2';
  if (!colorHex || colorHex === '#5865F2') {
    const role = guild.roles.cache.get(roleId);
    if (role && role.hexColor && role.hexColor !== '#000000') {
      finalColor = role.hexColor;
    }
  }

  // Save Clan & Leader in DB
  const clan = await prisma.clan.create({
    data: {
      guildId,
      name: name.trim(),
      leaderId,
      roleId,
      voiceChannelId,
      colorHex: finalColor,
    },
  });

  await prisma.clanMember.create({
    data: {
      id: `${clan.id}-${leaderId}`,
      clanId: clan.id,
      guildId,
      userId: leaderId,
    },
  });

  sendClanLog(guildId, new EmbedBuilder()
    .setTitle('📥 REGISTRO — CLAN IMPORTADO')
    .setColor(finalColor as any || 0x3498DB)
    .setDescription(`Se ha vinculado e importado un clan existente.\n\n🛡️ **Clan**: <@&${roleId}> (**${name}**)\n👑 **Líder**: <@${leaderId}>\n🔊 **Canal de Voz**: <#${voiceChannelId}>`)
    .setTimestamp()
  );

  return clan;
}

/**
 * Deletes a Clan from Discord (Role + Voice Channel) and DB.
 */
export async function deleteClanFromDiscordAndDB(client: Client, guildId: string, clanId: string) {
  const clan = await prisma.clan.findUnique({ where: { id: clanId } });
  if (!clan) throw new Error('Clan no encontrado.');

  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    // Delete Voice Channel
    if (clan.voiceChannelId) {
      const channel = guild.channels.cache.get(clan.voiceChannelId);
      if (channel) await channel.delete().catch(() => null);
    }
    // Delete Clan Role
    if (clan.roleId) {
      const role = guild.roles.cache.get(clan.roleId);
      if (role) await role.delete().catch(() => null);
    }
  }

  // Delete DB records
  await prisma.clanMemberMonthlyStats.deleteMany({ where: { clanId } });
  await prisma.clanMember.deleteMany({ where: { clanId } });
  await prisma.clan.delete({ where: { id: clanId } });
}

/**
 * Pre-populates default Clan Shop Items for a guild if none exist.
 */
export async function getOrCreateDefaultClanShopItems(guildId: string) {
  const existing = await prisma.clanShopItem.findMany({ where: { guildId } });
  if (existing.length > 0) return existing;

  const defaults = [
    {
      name: '📷 Permisos de Multimedia en Canal',
      price: 15,
      description: 'Permite enviar imágenes, vídeos y gifs dentro del canal de voz de tu clan.',
      icon: '📷',
      category: 'PERK',
      actionKey: 'MEDIA_PERMS',
      maxPerClan: 1,
    },
    {
      name: '🔊 Uso de Soundboard en Clan',
      price: 10,
      description: 'Permite reproducir efectos de sonido en la sala de voz de tu clan.',
      icon: '🔊',
      category: 'PERK',
      actionKey: 'SOUNDBOARD',
      maxPerClan: 1,
    },
    {
      name: '🙈 Ocultar Canal de Voz al Público',
      price: 25,
      description: 'Oculta el canal de voz de tu clan para que solo los miembros con el rol puedan verlo.',
      icon: '🙈',
      category: 'PERK',
      actionKey: 'HIDE_CLAN',
      maxPerClan: 1,
    },
    {
      name: '🧊 Escudo de Inmunidad Anti-Borrado (Hielito)',
      price: 30,
      description: 'Protege a tu clan durante 1 mes si no alcanza la meta de horas mínimas (Máx 3 acumulables).',
      icon: '🧊',
      category: 'PERK',
      actionKey: 'IMMUNITY_SHIELD',
      maxPerClan: 3,
    },
    {
      name: '😃 Emoji Personalizado en el Servidor',
      price: 50,
      description: 'Petición al Staff para subir un emoji exclusivo para tu clan en el servidor.',
      icon: '😃',
      category: 'CUSTOM',
      actionKey: 'CUSTOM',
      maxPerClan: 1,
    },
    {
      name: '🏷️ Pegatina Personalizada en el Servidor',
      price: 60,
      description: 'Petición al Staff para añadir una pegatina oficial del clan al servidor.',
      icon: '🏷️',
      category: 'CUSTOM',
      actionKey: 'CUSTOM',
      maxPerClan: 1,
    },
    {
      name: '🎼 Añadir Sonido a Soundboard del Servidor',
      price: 40,
      description: 'Petición al Staff para subir un archivo de audio personalizado al soundboard del servidor.',
      icon: '🎼',
      category: 'CUSTOM',
      actionKey: 'CUSTOM',
      maxPerClan: 1,
    },
  ];

  for (const item of defaults) {
    await prisma.clanShopItem.create({
      data: {
        guildId,
        ...item,
      },
    });
  }

  return prisma.clanShopItem.findMany({ where: { guildId } });
}

/**
 * Buys a Clan Shop Item and applies Discord permission overwrites or logs Staff request.
 */
export async function buyClanShopItem(client: Client, guildId: string, clanId: string, itemId: string, buyerId: string) {
  const clan = await prisma.clan.findUnique({ where: { id: clanId } });
  if (!clan) throw new Error('El clan no existe.');

  const item = await prisma.clanShopItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('El ítem de la tienda no existe.');

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const currencyName = config?.clanCurrencyName || 'GloriCoins';

  if (clan.coins < item.price) {
    throw new Error(`El clan no tiene suficientes ${currencyName}. Saldo actual: ${clan.coins.toFixed(1)} ${currencyName}, Precio: ${item.price} ${currencyName}.`);
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Servidor no encontrado.');

  // Check purchase limits and single-purchase perks
  if (item.actionKey === 'MEDIA_PERMS' && clan.hasMediaPerms) {
    throw new Error('Tu clan ya ha adquirido los Permisos Multimedia.');
  }
  if (item.actionKey === 'SOUNDBOARD' && clan.hasSoundboardPerms) {
    throw new Error('Tu clan ya ha adquirido el Uso de Soundboard.');
  }
  if (item.actionKey === 'HIDE_CLAN' && clan.isHiddenClan) {
    throw new Error('Tu clan ya es un Clan Oculto.');
  }
  if (item.actionKey === 'IMMUNITY_SHIELD' && clan.immunityShields >= 3) {
    throw new Error('Tu clan ya tiene el máximo de 3 Escudos de Inmunidad (Hielitos) acumulados.');
  }

  // Deduct coins
  const updatedClan = await prisma.clan.update({
    where: { id: clanId },
    data: {
      coins: { decrement: item.price },
    },
  });

  // Apply Action Perks on Discord
  let isCustomRequest = false;

  if (item.actionKey === 'MEDIA_PERMS') {
    await prisma.clan.update({ where: { id: clanId }, data: { hasMediaPerms: true } });
    if (clan.voiceChannelId && clan.roleId) {
      const channel = guild.channels.cache.get(clan.voiceChannelId);
      if (channel) {
        await (channel as any).permissionOverwrites.edit(clan.roleId, {
          [PermissionFlagsBits.AttachFiles as any]: true,
          [PermissionFlagsBits.EmbedLinks as any]: true,
        }).catch(() => null);
      }
    }
  } else if (item.actionKey === 'SOUNDBOARD') {
    await prisma.clan.update({ where: { id: clanId }, data: { hasSoundboardPerms: true } });
    if (clan.voiceChannelId && clan.roleId) {
      const channel = guild.channels.cache.get(clan.voiceChannelId);
      if (channel) {
        await (channel as any).permissionOverwrites.edit(clan.roleId, {
          [PermissionFlagsBits.UseSoundboard as any]: true,
        }).catch(() => null);
      }
    }
  } else if (item.actionKey === 'HIDE_CLAN') {
    await prisma.clan.update({ where: { id: clanId }, data: { isHiddenClan: true } });
    if (clan.voiceChannelId) {
      const channel = guild.channels.cache.get(clan.voiceChannelId);
      if (channel) {
        await (channel as any).permissionOverwrites.edit(guild.id, {
          [PermissionFlagsBits.ViewChannel as any]: false,
        }).catch(() => null);
      }
    }
  } else if (item.actionKey === 'IMMUNITY_SHIELD') {
    await prisma.clan.update({
      where: { id: clanId },
      data: { immunityShields: { increment: 1 } },
    });
  } else {
    isCustomRequest = true;
  }

  // Log purchase history
  await prisma.clanPurchaseHistory.create({
    data: {
      guildId,
      clanId,
      itemId: item.id,
      itemName: item.name,
      price: item.price,
      buyerId,
      status: isCustomRequest ? 'PENDING_STAFF' : 'COMPLETED',
    },
  });

  // Log to Audit Channel
  sendClanLog(guildId, new EmbedBuilder()
    .setTitle(isCustomRequest ? '📩 COMPRA DE TIENDA — REQUIERE STAFF' : '🛒 COMPRA DE TIENDA DE CLAN')
    .setColor(isCustomRequest ? 0xF1C40F : 0x2ECC71)
    .setDescription(`Un clan ha comprado un ítem en la tienda.\n\n🛡️ **Clan**: <@&${clan.roleId}> (**${clan.name}**)\n🛒 **Ítem**: ${item.icon} **${item.name}**\n💰 **Precio**: **${item.price} ${currencyName}**\n👤 **Comprador**: <@${buyerId}>\n\n${isCustomRequest ? '⚠️ **Atención Staff**: Esta compra requiere entrega manual.' : '✅ **Beneficio activado automáticamente en Discord.**'}`)
    .setTimestamp()
  );

  return updatedClan;
}

// ── DISCORD COMMAND `-clan` & INTERACTIVE BUTTONS ─────────────────────────

export async function handleClanCommand(message: Message) {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  if (!content.startsWith('-clan') && !content.startsWith('!clan')) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const member = message.member;
  if (!member) return;

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });

  // Restricción estricta de canal: Solo responder si el comando se ejecuta en un canal dentro de la Categoría de Clanes
  if (config?.clansCategoryId) {
    const channel = message.channel;
    const parentId = 'parentId' in channel ? channel.parentId : null;
    if (parentId !== config.clansCategoryId) {
      return; // Ignorar silenciosamente si está fuera de la categoría de clanes
    }
  }

  // Check if caller is Leader of a clan OR Staff
  const userClan = await prisma.clan.findFirst({
    where: { guildId, leaderId: userId },
  });

  const isStaff = config?.adminRoleIds
    ? config.adminRoleIds.split(',').some(rId => member.roles.cache.has(rId.trim())) || member.permissions.has(PermissionFlagsBits.Administrator)
    : member.permissions.has(PermissionFlagsBits.Administrator);

  const isLeader = Boolean(userClan) || (config?.clanLeaderRoleId && member.roles.cache.has(config.clanLeaderRoleId));

  if (!isLeader && !isStaff) {
    const memberRecord = await prisma.clanMember.findFirst({
      where: { guildId, userId },
    });

    if (memberRecord) {
      const clan = await prisma.clan.findUnique({
        where: { id: memberRecord.clanId }
      });
      if (clan) {
        const statsEmbed = await buildClanStatsEmbed(guildId, clan);
        return message.reply({ embeds: [statsEmbed] });
      }
    }

    return message.reply('❌ Este comando solo está disponible para miembros de un clan, Líderes de Clan o Staff del Servidor.');
  }

  // Target clan: user's own clan or if staff ran command without a clan, prompt
  let targetClan = userClan;
  if (!targetClan && isStaff) {
    targetClan = await prisma.clan.findFirst({ where: { guildId } });
  }

  if (!targetClan) {
    return message.reply('❌ No eres líder de ningún clan activo registrado en el sistema.');
  }

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ PANEL DE CONTROL DE CLAN — ${targetClan.name}`)
    .setColor(targetClan.colorHex as any || 0x5865F2)
    .setDescription(`¡Bienvenido al panel de gestión de **${targetClan.name}**!\n\n👑 **Líder**: <@${targetClan.leaderId}>\n🔊 **Canal de Voz**: <#${targetClan.voiceChannelId}>\n🎭 **Rol del Clan**: <@&${targetClan.roleId}>\n\n*Usa los botones de abajo para gestionar los miembros o consultar las horas acumuladas.*`)
    .setFooter({ text: `ID del Clan: ${targetClan.id}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`clan_addmember_${targetClan.id}_${userId}`)
      .setLabel('➕ Añadir')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`clan_removemember_${targetClan.id}_${userId}`)
      .setLabel('➖ Retirar')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`clan_stats_${targetClan.id}_${userId}`)
      .setLabel('📊 Horas')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`clan_shop_${targetClan.id}_${userId}`)
      .setLabel('🛒 Tienda')
      .setStyle(ButtonStyle.Secondary)
  );

  const replyMessage = await message.reply({ embeds: [embed], components: [row] });

  // Expiración automática del panel tras 5 minutos (300,000 ms)
  setTimeout(async () => {
    try {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`clan_addmember_expired`)
          .setLabel('➕ Añadir Miembro')
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`clan_removemember_expired`)
          .setLabel('➖ Retirar Miembro')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`clan_stats_expired`)
          .setLabel('📊 Ver Horas Mensuales')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      );

      const expiredEmbed = EmbedBuilder.from(embed)
        .setColor(0x7F8C8D)
        .setFooter({ text: `⏰ Este panel ha caducado por inactividad. Usa -clan de nuevo si lo necesitas.` });

      await replyMessage.edit({ embeds: [expiredEmbed], components: [disabledRow] }).catch(() => null);
    } catch {
      // Message might have been deleted, ignore
    }
  }, 5 * 60 * 1000);

  return replyMessage;
}

/**
 * Handles button & select menu interactions for `-clan`
 */
export async function handleClanInteraction(interaction: any) {
  if (!interaction.guild) return;

  const { customId, guild, member, user } = interaction;
  if (!customId || typeof customId !== 'string' || !customId.startsWith('clan_')) return;

  const parts = customId.split('_'); // e.g. ['clan', 'addmember', clanId, ownerId]
  const action = parts[1];
  const clanId = parts[2];
  const ownerId = parts[3];

  if (ownerId && user.id !== ownerId) {
    return interaction.reply({ content: '❌ Solo el líder que abrió el panel puede presionar estos botones.', ephemeral: true });
  }

  const clan = await prisma.clan.findUnique({ where: { id: clanId } });
  if (!clan) {
    return interaction.reply({ content: '⚠️ El clan asociado ya no existe.', ephemeral: true });
  }

  const config = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } });
  const yearMonth = getYearMonthString();
  const members = await prisma.clanMember.findMany({ where: { clanId: clan.id } });

  const goalMode = config?.clanGoalMode || 'FIXED';
  const goalHours = goalMode === 'PER_MEMBER'
    ? (members.length * (config?.clanHoursPerMember ?? 10))
    : (config?.monthlyClanHoursGoal ?? 50);

  // 1. STATS BUTTON
  if (action === 'stats') {
    const statsEmbed = await buildClanStatsEmbed(guild.id, clan);
    return interaction.reply({ embeds: [statsEmbed], ephemeral: true });
  }

  // 1.5. SHOP BUTTON -> Show Shop Select Menu
  if (action === 'shop') {
    const shopItems = await getOrCreateDefaultClanShopItems(guild.id);
    const currencyName = config?.clanCurrencyName || 'GloriCoins';

    const select = new StringSelectMenuBuilder()
      .setCustomId(`clan_doshopbuy_${clan.id}_${user.id}`)
      .setPlaceholder(`Saldo: ${clan.coins.toFixed(1)} ${currencyName} — Selecciona un ítem...`)
      .addOptions(
        shopItems.map(i => ({
          label: `${i.icon} ${i.name} (${i.price} ${currencyName})`,
          description: i.description.length > 50 ? i.description.substring(0, 47) + '...' : i.description,
          value: i.id,
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    const shopEmbed = new EmbedBuilder()
      .setTitle(`🛒 TIENDA DE CLAN — ${clan.name}`)
      .setColor(0xF1C40F)
      .setDescription(`💰 **Saldo del Clan**: **${clan.coins.toFixed(1)} ${currencyName}**\n🧊 **Escudos de Inmunidad (Hielitos)**: **${clan.immunityShields}/3**\n\n*Selecciona un ítem en el menú desplegable para comprarlo:*`)
      .setFooter({ text: 'Por cada 1h de voz el clan acumula GloriCoins automáticamente.' });

    return interaction.reply({ embeds: [shopEmbed], components: [row], ephemeral: true });
  }

  // 1.6. EXECUTE SHOP ITEM BUY FROM SELECT MENU
  if (action === 'doshopbuy' && interaction.isStringSelectMenu()) {
    const itemId = interaction.values[0];
    try {
      await buyClanShopItem(interaction.client, guild.id, clan.id, itemId, user.id);
      const item = await prisma.clanShopItem.findUnique({ where: { id: itemId } });
      const currencyName = config?.clanCurrencyName || 'GloriCoins';

      let claimText = '';
      if (item?.category === 'CUSTOM' || item?.actionKey === 'CUSTOM') {
        const ticketMsg = config?.clanShopTicketMessage || '🎟️ Abre un ticket de soporte con el Staff para entregar los archivos de tu item comprado.';
        claimText = `\n\n${ticketMsg}`;
      }

      return interaction.update({
        content: `🎉 **¡COMPRA EXITOSA!** Tu clan ha adquirido **${item?.icon} ${item?.name}** por **${item?.price} ${currencyName}**.${claimText}`,
        embeds: [],
        components: [],
      });
    } catch (e: any) {
      return interaction.reply({ content: `❌ **Error en la compra**: ${e.message}`, ephemeral: true });
    }
  }

  // 2. ADD MEMBER BUTTON -> Show Select Menu
  if (action === 'addmember') {
    await guild.members.fetch().catch(() => null);
    
    // Filter non-bot members who are NOT in the clan yet
    const currentMembers = await prisma.clanMember.findMany({ where: { clanId: clan.id } });
    const memberIdsInClan = new Set(currentMembers.map(m => m.userId));

    const eligibleMembers = guild.members.cache
      .filter((m: GuildMember) => !m.user.bot && !memberIdsInClan.has(m.id))
      .first(25); // Discord limit for select menu options

    if (eligibleMembers.length === 0) {
      return interaction.reply({ content: '⚠️ Todos los miembros del servidor ya pertenecen a tu clan o no hay nuevos usuarios elegibles.', ephemeral: true });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`clan_doadd_${clan.id}_${user.id}`)
      .setPlaceholder('Selecciona un usuario para añadir al clan...')
      .addOptions(
        eligibleMembers.map((m: GuildMember) => ({
          label: m.displayName,
          description: `@${m.user.username}`,
          value: m.id,
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    return interaction.reply({ content: '➕ **Selecciona el usuario que deseas añadir a tu clan:**', components: [row], ephemeral: true });
  }

  // 3. EXECUTE ADD MEMBER FROM SELECT MENU
  if (action === 'doadd' && interaction.isStringSelectMenu()) {
    const targetUserId = interaction.values[0];
    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

    if (!targetMember) {
      return interaction.reply({ content: '❌ El usuario seleccionado ya no está en el servidor.', ephemeral: true });
    }

    // Add clan role to member
    if (clan.roleId) {
      const clanRole = guild.roles.cache.get(clan.roleId);
      if (clanRole) await targetMember.roles.add(clanRole.id).catch(() => null);
    }

    // Save in DB
    await prisma.clanMember.upsert({
      where: { id: `${clan.id}-${targetUserId}` },
      update: {},
      create: {
        id: `${clan.id}-${targetUserId}`,
        clanId: clan.id,
        guildId: guild.id,
        userId: targetUserId,
      },
    });

    sendClanLog(guild.id, new EmbedBuilder()
      .setTitle('➕ REGISTRO — MIEMBRO AÑADIDO A CLAN')
      .setColor(0x2ECC71)
      .setDescription(`Un usuario se ha unido a un clan.\n\n👤 **Usuario**: <@${targetUserId}>\n🛡️ **Clan**: <@&${clan.roleId}> (**${clan.name}**)\n👑 **Autor del cambio**: <@${user.id}>`)
      .setTimestamp()
    );

    return interaction.update({
      content: `🎉 **¡MIEMBRO AÑADIDO!** <@${targetUserId}> ha sido añadido exitosamente a **${clan.name}** y ha recibido el rol del clan.`,
      components: [],
    });
  }

  // 4. REMOVE MEMBER BUTTON -> Show Select Menu
  if (action === 'removemember') {
    const currentMembers = await prisma.clanMember.findMany({ where: { clanId: clan.id } });
    const memberOptions = currentMembers.filter(m => m.userId !== clan.leaderId); // Cannot remove leader

    if (memberOptions.length === 0) {
      return interaction.reply({ content: '⚠️ No hay miembros en tu clan para retirar (no puedes retirarte a ti mismo como líder).', ephemeral: true });
    }

    await guild.members.fetch().catch(() => null);

    const selectOptions = [];
    for (const m of memberOptions.slice(0, 25)) {
      const gMember = guild.members.cache.get(m.userId);
      const name = gMember ? gMember.displayName : `ID: ${m.userId}`;
      selectOptions.push({
        label: name,
        description: `Retirar del clan ${clan.name}`,
        value: m.userId,
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`clan_doremove_${clan.id}_${user.id}`)
      .setPlaceholder('Selecciona un usuario para expulsar del clan...')
      .addOptions(selectOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    return interaction.reply({ content: '➖ **Selecciona el usuario que deseas retirar de tu clan:**', components: [row], ephemeral: true });
  }

  // 5. EXECUTE REMOVE MEMBER FROM SELECT MENU
  if (action === 'doremove' && interaction.isStringSelectMenu()) {
    const targetUserId = interaction.values[0];
    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

    // Strip clan role from member
    if (targetMember && clan.roleId) {
      const clanRole = guild.roles.cache.get(clan.roleId);
      if (clanRole) await targetMember.roles.remove(clanRole.id).catch(() => null);
    }

    // Remove from DB
    await prisma.clanMember.deleteMany({
      where: { clanId: clan.id, userId: targetUserId },
    });

    sendClanLog(guild.id, new EmbedBuilder()
      .setTitle('➖ REGISTRO — MIEMBRO RETIRADO DE CLAN')
      .setColor(0xED4245)
      .setDescription(`Un usuario ha sido retirado de un clan.\n\n👤 **Usuario**: <@${targetUserId}>\n🛡️ **Clan**: <@&${clan.roleId}> (**${clan.name}**)\n👑 **Autor del cambio**: <@${user.id}>`)
      .setTimestamp()
    );

    return interaction.update({
      content: `✅ **MIEMBRO RETIRADO**: <@${targetUserId}> ha sido retirado de **${clan.name}**.`,
      components: [],
    });
  }
}
