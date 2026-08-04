import { Message, Guild, ButtonStyle, ActionRowBuilder, ButtonBuilder, EmbedBuilder, Client, TextChannel, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { prisma } from 'shared';

let discordClient: Client | null = null;
export function setEconomyClient(client: Client) {
  discordClient = client;
}

export async function sendCasinoLog(guildId: string, embed: EmbedBuilder) {
  if (!discordClient) return;
  try {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (!config || !config.casinoLogChannelId) return;

    const channel = await discordClient.channels.fetch(config.casinoLogChannelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      await (channel as TextChannel).send({ embeds: [embed] }).catch(() => null);
    }
  } catch (e) {
    // Ignore logging errors silently
  }
}

/**
 * Ensures UserEconomy record exists in DB.
 */
export async function getOrCreateUserEconomy(guildId: string, userId: string) {
  const id = `${guildId}-${userId}`;
  let userEco = await prisma.userEconomy.findUnique({ where: { id } });
  if (!userEco) {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    const startCash = config?.startingBalance ?? 1000;
    userEco = await prisma.userEconomy.create({
      data: { id, guildId, userId, cash: startCash, bank: 0 },
    });
  }
  return userEco;
}

/**
 * Format currency with symbol.
 */
export function fmtMoney(amount: number, symbol = '💶'): string {
  return `**${amount.toLocaleString()} ${symbol}**`;
}

/**
 * Parse string money representation including k, m, b, t, e-notation, all, todo, half, mitad, 1/2, quarter.
 */
export function parseMoneyAmount(input: string, maxAvailable: number): number | null {
  if (!input) return null;
  const str = input.trim().toLowerCase();

  if (str === 'all' || str === 'todo' || str === 'max' || str === 'full') {
    return maxAvailable;
  }

  if (str === 'half' || str === 'mitad' || str === '1/2' || str === 'half-all') {
    return Math.max(1, Math.floor(maxAvailable / 2));
  }

  if (str === 'quarter' || str === 'cuarto' || str === '1/4') {
    return Math.max(1, Math.floor(maxAvailable / 4));
  }

  // Check exponential notation (e.g. 1e9, 2.5e6, 1e5)
  if (/^\d+(\.\d+)?e\d+$/i.test(str)) {
    const parsedExp = Number(str);
    if (!isNaN(parsedExp) && isFinite(parsedExp) && parsedExp > 0) {
      return Math.min(Math.floor(parsedExp), 1_000_000_000_000); // tope máximo: 1 billón
    }
  }

  // Check suffixes (k, m, b, t)
  const suffixMatch = str.match(/^(\d+(?:\.\d+)?)\s*([kmbt])$/);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1]);
    const unit = suffixMatch[2];
    let multiplier = 1;
    if (unit === 'k') multiplier = 1_000;
    if (unit === 'm') multiplier = 1_000_000;
    if (unit === 'b') multiplier = 1_000_000_000;
    if (unit === 't') multiplier = 1_000_000_000_000;
    return Math.floor(num * multiplier);
  }

  // Standard numeric parsing
  const cleanStr = str.replace(/[,_]/g, '');
  const parsed = parseInt(cleanStr, 10);
  if (isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Get remaining cooldown formatted string.
 */
function getCooldownRemaining(lastDate: Date | null, cooldownSec: number): number {
  if (!lastDate) return 0;
  const elapsed = (Date.now() - new Date(lastDate).getTime()) / 1000;
  return Math.max(0, Math.ceil(cooldownSec - elapsed));
}

// ── BANK COMMANDS ────────────────────────────────────────────────────────
export async function handleDeposit(guildId: string, userId: string, amountStr: string): Promise<string> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const eco = await getOrCreateUserEconomy(guildId, userId);

  if (eco.cash <= 0) return `❌ No tienes dinero en efectivo para depositar.`;

  const amount = parseMoneyAmount(amountStr, eco.cash);
  if (!amount || amount <= 0) return `❌ Por favor, especifica una cantidad válida (ej: \`1000\`, \`50k\`, \`1.5m\`, \`1e9\`, \`all\`).`;
  if (amount > eco.cash) return `❌ No tienes suficiente dinero en efectivo (${fmtMoney(eco.cash, sym)}).`;

  // Actualización atómica para evitar race conditions entre comandos concurrentes
  await prisma.userEconomy.update({
    where: { id: `${guildId}-${userId}` },
    data: {
      cash: { decrement: amount },
      bank: { increment: amount },
    },
  });

  return `🏦 Has depositado ${fmtMoney(amount, sym)} en tu cuenta bancaria.`;
}

export async function handleWithdraw(guildId: string, userId: string, amountStr: string): Promise<string> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const eco = await getOrCreateUserEconomy(guildId, userId);

  if (eco.bank <= 0) return `❌ No tienes dinero en el banco para retirar.`;

  const amount = parseMoneyAmount(amountStr, eco.bank);
  if (!amount || amount <= 0) return `❌ Por favor, especifica una cantidad válida (ej: \`1000\`, \`50k\`, \`1.5m\`, \`1e9\`, \`all\`).`;
  if (amount > eco.bank) return `❌ No tienes tanto dinero depositado en el banco (${fmtMoney(eco.bank, sym)}).`;

  // Actualización atómica para evitar race conditions entre comandos concurrentes
  await prisma.userEconomy.update({
    where: { id: `${guildId}-${userId}` },
    data: {
      cash: { increment: amount },
      bank: { decrement: amount },
    },
  });

  return `💵 Has retirado ${fmtMoney(amount, sym)} del banco a tu efectivo.`;
}

// ── WORK / CRIME / SLUT / ROB ─────────────────────────────────────────────
export async function handleWork(guildId: string, userId: string): Promise<string> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const cdSec = config?.workCooldownSec || 30;
  const eco = await getOrCreateUserEconomy(guildId, userId);

  const remSec = getCooldownRemaining(eco.lastWork, cdSec);
  if (remSec > 0) return `⏳ Debes esperar **${remSec}s** antes de volver a trabajar.`;

  const min = config?.workMinPayout || 1000;
  const max = config?.workMaxPayout || 5000;
  const earned = Math.floor(Math.random() * (max - min + 1)) + min;

  const defaultJobs = [
    'Has trabajado de camarero en la discoteca',
    'Has limpiado el canal de voz',
    'Has repartido pizzas para la comunidad',
    'Has arreglado el servidor del casino',
    'Has vendido bocadillos en el evento',
  ];

  const customJobs = (config?.workMessages || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const jobs = customJobs.length > 0 ? customJobs : defaultJobs;
  let jobMsg = jobs[Math.floor(Math.random() * jobs.length)];

  await prisma.userEconomy.update({
    where: { id: `${guildId}-${userId}` },
    data: {
      cash: { increment: earned },
      lastWork: new Date(),
    },
  });

  sendCasinoLog(guildId, new EmbedBuilder()
    .setTitle('👷 REGISTRO — TRABAJO (!work)')
    .setColor(0x2ECC71)
    .setDescription(`<@${userId}> ha trabajado y ha ganado ${fmtMoney(earned, sym)}.`)
    .setFooter({ text: `Usuario ID: ${userId}` })
  );

  if (jobMsg.includes('{amount}')) {
    jobMsg = jobMsg.replace('{amount}', fmtMoney(earned, sym));
    return `👷 ${jobMsg}`;
  }

  return `👷 ${jobMsg} y has ganado ${fmtMoney(earned, sym)} en efectivo!`;
}

export async function handleCrime(guildId: string, userId: string): Promise<string> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const cdSec = config?.crimeCooldownSec || 30;
  const min = config?.crimeMinPayout || 1500;
  const max = config?.crimeMaxPayout || 5500;
  const eco = await getOrCreateUserEconomy(guildId, userId);

  const remSec = getCooldownRemaining(eco.lastCrime, cdSec);
  if (remSec > 0) return `⏳ Debes esperar **${remSec}s** antes de cometer otro delito.`;

  let successChance = 0.75;
  if (eco.cash >= 1000000) successChance = 0.20;
  else if (eco.cash >= 250000) successChance = 0.35;
  else if (eco.cash >= 50000) successChance = 0.50;
  else if (eco.cash >= 10000) successChance = 0.65;

  const success = Math.random() < successChance;
  const amount = Math.floor(Math.random() * (max - min + 1)) + min;

  const customCrimeMsgs = (config?.crimeMessages || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const customCrimeFailMsgs = (config?.crimeFailMessages || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  if (success) {
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${userId}` },
      data: { cash: { increment: amount }, lastCrime: new Date() },
    });

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('🕵️ REGISTRO — DELITO EXITOSO (!crime)')
      .setColor(0x57F287)
      .setDescription(`<@${userId}> ha cometido un delito con éxito y ha obtenido ${fmtMoney(amount, sym)}.`)
      .setFooter({ text: `Usuario ID: ${userId}` })
    );

    if (customCrimeMsgs.length > 0) {
      const msg = customCrimeMsgs[Math.floor(Math.random() * customCrimeMsgs.length)];
      return `🕵️ ${msg.replace('{amount}', fmtMoney(amount, sym))}`;
    }

    return `🕵️ Has cometido un robo limpia y sigilosamente y has conseguido ${fmtMoney(amount, sym)}!`;
  } else {
    const penalty = Math.min(eco.cash, Math.floor(amount * 0.8));
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${userId}` },
      data: { cash: { decrement: penalty }, lastCrime: new Date() },
    });

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('🚔 REGISTRO — DELITO FALLIDO (!crime)')
      .setColor(0xED4245)
      .setDescription(`<@${userId}> ha sido atrapado cometiendo un delito y multado con ${fmtMoney(penalty, sym)}.`)
      .setFooter({ text: `Usuario ID: ${userId}` })
    );

    if (customCrimeFailMsgs.length > 0) {
      const msg = customCrimeFailMsgs[Math.floor(Math.random() * customCrimeFailMsgs.length)];
      return `🚔 ${msg.replace('{amount}', fmtMoney(penalty, sym))}`;
    }

    return `🚔 La policía te tenía fichado por llevar tanto efectivo encima y te han multado con ${fmtMoney(penalty, sym)}.`;
  }
}

export async function handleSlut(guildId: string, userId: string): Promise<string> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const cdSec = config?.slutCooldownSec || 30;
  const min = config?.slutMinPayout || 1200;
  const max = config?.slutMaxPayout || 4700;
  const eco = await getOrCreateUserEconomy(guildId, userId);

  const remSec = getCooldownRemaining(eco.lastSlut, cdSec);
  if (remSec > 0) return `⏳ Debes esperar **${remSec}s** para hacer de las tuyas.`;

  let successChance = 0.75;
  if (eco.cash >= 1000000) successChance = 0.25;
  else if (eco.cash >= 250000) successChance = 0.40;
  else if (eco.cash >= 50000) successChance = 0.55;
  else if (eco.cash >= 10000) successChance = 0.70;

  const success = Math.random() < successChance;
  const amount = Math.floor(Math.random() * (max - min + 1)) + min;

  const customSlutMsgs = (config?.slutMessages || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const customSlutFailMsgs = (config?.slutFailMessages || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  if (success) {
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${userId}` },
      data: { cash: { increment: amount }, lastSlut: new Date() },
    });

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('💋 REGISTRO — NOCTURNO EXITOSO (!slut)')
      .setColor(0xFF69B4)
      .setDescription(`<@${userId}> ha ganado ${fmtMoney(amount, sym)}.`)
      .setFooter({ text: `Usuario ID: ${userId}` })
    );

    if (customSlutMsgs.length > 0) {
      const msg = customSlutMsgs[Math.floor(Math.random() * customSlutMsgs.length)];
      return `💋 ${msg.replace('{amount}', fmtMoney(amount, sym))}`;
    }

    return `💋 Has salido a dar amor y tu cliente te ha dejado ${fmtMoney(amount, sym)} de propina!`;
  } else {
    const penalty = Math.min(eco.cash, Math.floor(amount * 0.6));
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${userId}` },
      data: { cash: { decrement: penalty }, lastSlut: new Date() },
    });

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('👠 REGISTRO — NOCTURNO PERCANCE (!slut)')
      .setColor(0xED4245)
      .setDescription(`<@${userId}> ha tenido un percance y ha perdido ${fmtMoney(penalty, sym)}.`)
      .setFooter({ text: `Usuario ID: ${userId}` })
    );

    if (customSlutFailMsgs.length > 0) {
      const msg = customSlutFailMsgs[Math.floor(Math.random() * customSlutFailMsgs.length)];
      return `👠 ${msg.replace('{amount}', fmtMoney(penalty, sym))}`;
    }

    return `👠 Al llevar tanto dinero en el bolsillo te han asaltado en un callejón y has perdido ${fmtMoney(penalty, sym)}.`;
  }
}

export async function handleRob(guildId: string, robberId: string, victimId: string, victimUsername: string): Promise<string> {
  if (robberId === victimId) return `❌ No te puedes robar a ti mismo.`;

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const cdSec = config?.robCooldownSec || 300; // 5 min

  const robberEco = await getOrCreateUserEconomy(guildId, robberId);
  const victimEco = await getOrCreateUserEconomy(guildId, victimId);

  const remSec = getCooldownRemaining(robberEco.lastRob, cdSec);
  if (remSec > 0) return `⏳ Debes esperar **${Math.ceil(remSec / 60)}m** para volver a intentar un atraco.`;

  if (victimEco.cash <= 0) {
    return `❌ **${victimUsername}** no tiene dinero en efectivo (su dinero está seguro en el banco).`;
  }

  // Wealth-based risk scaling: the more cash the robber has, the lower their success chance!
  // Base chance: 75%
  // >= 10k: 65% | >= 50k: 50% | >= 250k: 35% | >= 1m: 20%
  let successChance = 0.75;
  if (robberEco.cash >= 1000000) successChance = 0.20;
  else if (robberEco.cash >= 250000) successChance = 0.35;
  else if (robberEco.cash >= 50000) successChance = 0.50;
  else if (robberEco.cash >= 10000) successChance = 0.65;

  const success = Math.random() < successChance;

  // Configurable rob percentage range (default 20% to 80%)
  const minPct = Math.max(1, Math.min(100, config?.robMinPercent ?? 20));
  const maxPct = Math.max(minPct, Math.min(100, config?.robMaxPercent ?? 80));
  
  // Random percentage within [minPct, maxPct]
  const pctToSteal = (Math.floor(Math.random() * (maxPct - minPct + 1)) + minPct) / 100;
  const stolen = Math.max(1, Math.floor(victimEco.cash * pctToSteal));

  if (success) {
    const actualStolen = Math.min(victimEco.cash, stolen);

    // $transaction garantiza que ambas actualizaciones son atómicas (sin dinero duplicado ni perdido)
    await prisma.$transaction([
      prisma.userEconomy.update({
        where: { id: `${guildId}-${robberId}` },
        data: { cash: { increment: actualStolen }, lastRob: new Date() },
      }),
      prisma.userEconomy.update({
        where: { id: `${guildId}-${victimId}` },
        data: { cash: { decrement: actualStolen } },
      }),
    ]);

    const pctDisplay = Math.round((actualStolen / victimEco.cash) * 100);

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('🥷 REGISTRO — ROBO EXITOSO (!rob)')
      .setColor(0x57F287)
      .setDescription(`<@${robberId}> le ha robado ${fmtMoney(actualStolen, sym)} (${pctDisplay}% de su efectivo) a <@${victimId}> (${victimUsername}).`)
      .setFooter({ text: `Ladrón: ${robberId} | Víctima: ${victimId}` })
    );

    return `🥷 **¡ROBO EXITOSO!** Has asaltado a **${victimUsername}** y le has quitado **${pctDisplay}%** de su efectivo (${fmtMoney(actualStolen, sym)})! 💰`;
  } else {
    // Fail: lose 25% of robber's cash as penalty when caught!
    const penalty = Math.min(robberEco.cash, Math.floor(robberEco.cash * 0.25));
    
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${robberId}` },
      data: { cash: { decrement: penalty }, lastRob: new Date() },
    });

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('🚨 REGISTRO — ROBO FALLIDO (!rob)')
      .setColor(0xE67E22)
      .setDescription(`<@${robberId}> intentó robar a <@${victimId}> (${victimUsername}), pero fue descubierto y multado con ${fmtMoney(penalty, sym)}.`)
      .setFooter({ text: `Ladrón: ${robberId} | Víctima: ${victimId}` })
    );

    if (penalty > 0) {
      return `🚨 **¡ROBO FALLIDO!** Intentaste meterle la mano en el bolsillo a **${victimUsername}**, pero te pillaron con las manos en la masa y la policía te ha multado con ${fmtMoney(penalty, sym)}!`;
    }

    return `🚨 **¡ROBO FALLIDO!** Intentaste meterle la mano en el bolsillo a **${victimUsername}**, pero logró zafarse a tiempo y saliste huyendo!`;
  }
}

// ── COLLECT INCOME (ROLES) ────────────────────────────────────────────────
export async function handleCollectIncome(guildId: string, member: any): Promise<string> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const eco = await getOrCreateUserEconomy(guildId, member.id);

  // Find all RoleIncomes configured for this guild
  const roleIncomes = await prisma.roleIncome.findMany({ where: { guildId } });
  if (roleIncomes.length === 0) {
    return `❌ No hay roles con ingresos configurados para esta temporada aún.`;
  }

  const memberRoles = member.roles?.cache || new Map();
  const userRolesWithIncome = roleIncomes.filter(ri => memberRoles.has(ri.roleId));

  if (userRolesWithIncome.length === 0) {
    return `❌ No posees ninguno de los roles de recompensa de esta temporada. Usa \`/role-income\` o \`!role-income\` para ver la lista de roles con pago.`;
  }

  let totalPayout = 0;
  const claimedRoleNames: string[] = [];
  const onCooldownMsgs: string[] = [];
  const now = new Date();

  for (const ri of userRolesWithIncome) {
    const cdId = `${guildId}-${member.id}-${ri.roleId}`;
    const userCd = await prisma.userRoleIncomeCooldown.findUnique({ where: { id: cdId } });
    const intervalSec = (ri.intervalHours || 3) * 3600;

    const remSec = getCooldownRemaining(userCd?.lastClaim || null, intervalSec);
    if (remSec > 0) {
      const hrs = Math.floor(remSec / 3600);
      const mins = Math.ceil((remSec % 3600) / 60);
      onCooldownMsgs.push(`<@&${ri.roleId}>: disponible en **${hrs}h ${mins}m**`);
    } else {
      totalPayout += ri.incomeAmount;
      claimedRoleNames.push(`<@&${ri.roleId}> (+${ri.incomeAmount.toLocaleString()} ${sym})`);

      await prisma.userRoleIncomeCooldown.upsert({
        where: { id: cdId },
        update: { lastClaim: now },
        create: { id: cdId, guildId, userId: member.id, roleId: ri.roleId, lastClaim: now },
      });
    }
  }

  if (totalPayout === 0) {
    return `⏳ **Tus ingresos por rol están en enfriamiento:**\n${onCooldownMsgs.join('\n')}`;
  }

  await prisma.userEconomy.update({
    where: { id: `${guildId}-${member.id}` },
    data: { cash: { increment: totalPayout } },
  });

  sendCasinoLog(guildId, new EmbedBuilder()
    .setTitle('💰 REGISTRO — INGRESOS COBRADOS (!collect-income)')
    .setColor(0x5865F2)
    .setDescription(`<@${member.id}> ha cobrado ${fmtMoney(totalPayout, sym)} de ingresos de temporada.`)
    .setFooter({ text: `Usuario ID: ${member.id}` })
  );

  let response = `💰 **¡INGRESOS COBRADOS CON ÉXITO!**\nHas recibido ${fmtMoney(totalPayout, sym)} por:\n${claimedRoleNames.join('\n')}`;
  if (onCooldownMsgs.length > 0) {
    response += `\n\n⏳ *Roles aún en cooldown:*\n${onCooldownMsgs.join('\n')}`;
  }

  return response;
}

// ── CASINO GAMES ──────────────────────────────────────────────────────────
// 🎰 Slot Machine
export async function handleSlotMachine(guildId: string, userId: string, betStr: string): Promise<string | { embeds: EmbedBuilder[] }> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const mode = config?.slotMachineDifficulty || 'NORMAL'; // "NORMAL" | "EASY" | "VERY_EASY"
  const eco = await getOrCreateUserEconomy(guildId, userId);

  const multMap: Record<string, { pair: number; triple: number; diamond: number; seven: number; rerollChance: number }> = {
    'NORMAL': { pair: 2, triple: 5, diamond: 7, seven: 10, rerollChance: 0 },
    'EASY': { pair: 2.5, triple: 6, diamond: 10, seven: 15, rerollChance: 0.25 },
    'VERY_EASY': { pair: 3, triple: 8, diamond: 15, seven: 25, rerollChance: 0.50 },
  };

  const currentMults = multMap[mode] || multMap['NORMAL'];

  const bet = parseMoneyAmount(betStr, eco.cash);
  if (!bet || bet <= 0) {
    const embed = new EmbedBuilder()
      .setTitle('🎰 GUÍA DE APUESTAS — TRAGAPERRAS')
      .setColor(0xF1C40F)
      .setDescription(`Usa \`!sm <apuesta>\` o \`/slot-machine <apuesta>\` para girar la máquina.\n\n🏆 **TABLA DE MULTIPLICADORES:**\n• \`7️⃣ 7️⃣ 7️⃣\` ➔ **PREMIO JACKPOT x${currentMults.seven}**\n• \`💎 💎 💎\` ➔ **PREMIO SUPER x${currentMults.diamond}**\n• \`🍒 🍒 🍒\` (3 frutas iguales) ➔ **PREMIO x${currentMults.triple}**\n• Pareja (2 iguales) ➔ **PREMIO x${currentMults.pair}**\n\n💡 **Ejemplos de Apuesta:**\n- \`!sm 50k\`\n- \`!sm 1.5m\`\n- \`!sm 1e6\`\n- \`!sm half\` (Apuesta la mitad del saldo)\n- \`!sm all\` (Apuesta todo tu monedero)`)
      .setFooter({ text: `Tu efectivo actual: ${fmtMoney(eco.cash, sym)}` });
    return { embeds: [embed] };
  }

  if (bet > eco.cash) return `❌ No tienes suficiente dinero en efectivo (${fmtMoney(eco.cash, sym)}).`;

  const symbols = ['🍒', '🍋', '🍇', '🍉', '🔔', '💎', '7️⃣'];
  let s1 = symbols[Math.floor(Math.random() * symbols.length)];
  let s2 = symbols[Math.floor(Math.random() * symbols.length)];
  let s3 = symbols[Math.floor(Math.random() * symbols.length)];

  // Secret reroll assistance boost based on difficulty mode if no initial match
  if (s1 !== s2 && s2 !== s3 && s1 !== s3 && currentMults.rerollChance > 0) {
    if (Math.random() < currentMults.rerollChance) {
      s2 = s1; // Force a pair match behind the scenes!
    }
  }

  let winMultiplier = 0;
  if (s1 === s2 && s2 === s3) {
    winMultiplier = s1 === '7️⃣' ? currentMults.seven : s1 === '💎' ? currentMults.diamond : currentMults.triple;
  } else if (s1 === s2 || s2 === s3 || s1 === s3) {
    winMultiplier = currentMults.pair;
  }

  let resultMsg = '';
  if (winMultiplier > 0) {
    const winnings = Math.floor(bet * winMultiplier);
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${userId}` },
      data: { cash: { increment: winnings - bet } },
    });
    resultMsg = `🎉 **¡PREMIO x${winMultiplier}!** Has ganado ${fmtMoney(winnings, sym)}!`;

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('🎰 REGISTRO — TRAGAPERRAS GANADO (!sm)')
      .setColor(0x57F287)
      .setDescription(`<@${userId}> apostó ${fmtMoney(bet, sym)} y ganó ${fmtMoney(winnings, sym)} (x${winMultiplier}).\nCombinación: [ ${s1} | ${s2} | ${s3} ]`)
      .setFooter({ text: `Usuario ID: ${userId}` })
    );
  } else {
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${userId}` },
      data: { cash: { decrement: bet } },
    });
    resultMsg = `💸 Has perdido ${fmtMoney(bet, sym)}. ¡Sigue intentándolo!`;

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('🎰 REGISTRO — TRAGAPERRAS PERDIDO (!sm)')
      .setColor(0xED4245)
      .setDescription(`<@${userId}> apostó ${fmtMoney(bet, sym)} y perdió.\nCombinación: [ ${s1} | ${s2} | ${s3} ]`)
      .setFooter({ text: `Usuario ID: ${userId}` })
    );
  }

  return `🎰 **TRAGAPERRAS** 🎰\n[ ${s1} | ${s2} | ${s3} ]\n\n${resultMsg}`;
}

// 🎡 Roulette
export async function handleRoulette(guildId: string, userId: string, betStr: string, choice: string): Promise<string | { embeds: EmbedBuilder[] }> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const eco = await getOrCreateUserEconomy(guildId, userId);

  const bet = parseMoneyAmount(betStr, eco.cash);
  if (!bet || bet <= 0 || !choice) {
    const embed = new EmbedBuilder()
      .setTitle('🎡 GUÍA DE APUESTAS — RULETA FRANCESA')
      .setColor(0xE74C3C)
      .setDescription(`Usa \`!roulette <apuesta> <elección>\` o \`/roulette\` para girar la ruleta.\n\n🎯 **TABLA DE PAGOS:**\n• **Colores (x2)**: \`rojo\` / \`negro\`\n• **Paridad (x2)**: \`par\` / \`impar\`\n• **Mitades (x2)**: \`1-18\` (bajos) / \`19-36\` (altos)\n• **Docenas (x3)**: \`1st12\` (1-12) / \`2nd12\` (13-24) / \`3rd12\` (25-36)\n• **Columnas (x3)**: \`col1\` / \`col2\` / \`col3\`\n• **Número Exacto (x36)**: \`0\` al \`36\` (Verde 🟢 es el 0)\n\n💡 **Ejemplos de Apuesta:**\n- \`!roulette 100k rojo\`\n- \`!roulette half 1st12\`\n- \`!roulette 1e6 par\`\n- \`!roulette all 7\``)
      .setFooter({ text: `Tu efectivo actual: ${eco.cash.toLocaleString()} ${sym}` });
    return { embeds: [embed] };
  }
  if (bet > eco.cash) return `❌ No tienes suficiente dinero en efectivo (${fmtMoney(eco.cash, sym)}).`;

  const landedNumber = Math.floor(Math.random() * 37); // 0 - 36
  const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(landedNumber);
  const color = landedNumber === 0 ? '🟢 Verde (0)' : isRed ? '🔴 Rojo' : '⚫ Negro';

  let won = false;
  let multiplier = 0;
  const c = choice.toLowerCase().trim();

  // 1. Exact Number (0-36)
  if (!isNaN(parseInt(c, 10)) && !c.includes('-')) {
    const numChoice = parseInt(c, 10);
    if (numChoice >= 0 && numChoice <= 36 && numChoice === landedNumber) {
      won = true;
      multiplier = 36;
    }
  }
  // 2. Colors
  else if (c === 'rojo' || c === 'red') {
    if (isRed && landedNumber !== 0) { won = true; multiplier = 2; }
  } else if (c === 'negro' || c === 'black') {
    if (!isRed && landedNumber !== 0) { won = true; multiplier = 2; }
  } else if (c === 'verde' || c === 'green' || c === '0') {
    if (landedNumber === 0) { won = true; multiplier = 36; }
  }
  // 3. Even / Odd
  else if (c === 'par' || c === 'even') {
    if (landedNumber % 2 === 0 && landedNumber !== 0) { won = true; multiplier = 2; }
  } else if (c === 'impar' || c === 'odd') {
    if (landedNumber % 2 !== 0) { won = true; multiplier = 2; }
  }
  // 4. Halves (1-18 / 19-36)
  else if (c === '1-18' || c === 'bajos' || c === 'low') {
    if (landedNumber >= 1 && landedNumber <= 18) { won = true; multiplier = 2; }
  } else if (c === '19-36' || c === 'altos' || c === 'high') {
    if (landedNumber >= 19 && landedNumber <= 36) { won = true; multiplier = 2; }
  }
  // 5. Dozens (1st12, 2nd12, 3rd12)
  else if (c === '1st12' || c === 'docena1' || c === '1-12') {
    if (landedNumber >= 1 && landedNumber <= 12) { won = true; multiplier = 3; }
  } else if (c === '2nd12' || c === 'docena2' || c === '13-24') {
    if (landedNumber >= 13 && landedNumber <= 24) { won = true; multiplier = 3; }
  } else if (c === '3rd12' || c === 'docena3' || c === '25-36') {
    if (landedNumber >= 25 && landedNumber <= 36) { won = true; multiplier = 3; }
  }
  // 6. Columns (col1, col2, col3)
  else if (c === 'col1' || c === 'columna1') {
    if (landedNumber > 0 && landedNumber % 3 === 1) { won = true; multiplier = 3; }
  } else if (c === 'col2' || c === 'columna2') {
    if (landedNumber > 0 && landedNumber % 3 === 2) { won = true; multiplier = 3; }
  } else if (c === 'col3' || c === 'columna3') {
    if (landedNumber > 0 && landedNumber % 3 === 0) { won = true; multiplier = 3; }
  }

  if (won) {
    const winAmount = bet * multiplier;
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${userId}` },
      data: { cash: { increment: winAmount - bet } },
    });

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('🎡 REGISTRO — RULETA GANADA (!roulette)')
      .setColor(0x57F287)
      .setDescription(`<@${userId}> apostó ${fmtMoney(bet, sym)} a **${choice}** y ganó ${fmtMoney(winAmount, sym)}!\nResultado: **${landedNumber} (${color})**`)
      .setFooter({ text: `Usuario ID: ${userId}` })
    );

    return `🎡 **RULETA FRANCESA** 🎡\nLa bola ha girado y ha caído en: **${landedNumber} (${color})**!\n🎉 **¡HAS GANADO!** Premio x${multiplier}: ${fmtMoney(winAmount, sym)}!`;
  } else {
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${userId}` },
      data: { cash: { decrement: bet } },
    });

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('🎡 REGISTRO — RULETA PERDIDA (!roulette)')
      .setColor(0xED4245)
      .setDescription(`<@${userId}> apostó ${fmtMoney(bet, sym)} a **${choice}** y perdió.\nResultado: **${landedNumber} (${color})**`)
      .setFooter({ text: `Usuario ID: ${userId}` })
    );

    return `🎡 **RULETA FRANCESA** 🎡\nLa bola ha girado y ha caído en: **${landedNumber} (${color})**.\n💸 **¡Perdiste!** Has perdido ${fmtMoney(bet, sym)}. Tu apuesta era: *${choice}*.`;
  }
}

export async function handleBuyChicken(guildId: string, userId: string): Promise<string> {
  return handleChickenBuy(guildId, userId);
}

// ── BLACKJACK (21) INTERACTIVO CON BOTONES ──────────────────────────────────
interface DeckCard {
  suit: string;
  value: string;
  weight: number;
}

function createDeck(): DeckCard[] {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: DeckCard[] = [];

  for (const s of suits) {
    for (const v of values) {
      let weight = parseInt(v, 10);
      if (['J', 'Q', 'K'].includes(v)) weight = 10;
      if (v === 'A') weight = 11;
      deck.push({ suit: s, value: v, weight });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function calculateHandScore(cards: DeckCard[]): number {
  let score = cards.reduce((acc, c) => acc + c.weight, 0);
  let aces = cards.filter(c => c.value === 'A').length;
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
}

// Memory map for active BJ games
export const activeBJGames = new Map<string, {
  guildId: string;
  userId: string;
  bet: number;
  deck: DeckCard[];
  playerHand: DeckCard[];
  dealerHand: DeckCard[];
}>();

export async function startBlackjack(guildId: string, userId: string, betStr: string) {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const eco = await getOrCreateUserEconomy(guildId, userId);

  const bet = parseMoneyAmount(betStr, eco.cash);
  if (!bet || bet <= 0) {
    const embed = new EmbedBuilder()
      .setTitle('🃏 GUÍA DE APUESTAS — BLACKJACK (21)')
      .setColor(0x5865F2)
      .setDescription(`Usa \`!bj <apuesta>\` o \`/blackjack <apuesta>\` para iniciar una partida.\n\n🎮 **CÓMO SE JUEGA:**\n• Compites en directo contra la **Banca** usando botones interactivos.\n• **🃏 Pedir Carta**: Robas una carta para acercarte a 21.\n• **🛑 Plantarse**: Te quedas con tu puntuación actual y la Banca juega.\n• **Puntuación**: Las cartas del 2 al 10 valen su valor. J, Q, K valen 10. El As (A) vale 11 o 1.\n• **Pasarse (22+)**: Pierdes tu apuesta automáticamente.\n\n💰 **PAGOS:**\n• **Victoria Normal**: **Premio x2**\n• **Blackjack Natural (21 exacto)**: **Premio x2.5**\n\n💡 **Ejemplos de Apuesta:**\n- \`!bj 50k\`\n- \`!bj half\`\n- \`!bj 1e6\`\n- \`!bj all\``)
      .setFooter({ text: `Tu efectivo actual: ${eco.cash.toLocaleString()} ${sym}` });
    return { embeds: [embed] };
  }
  if (bet > eco.cash) return { content: `❌ No tienes suficiente dinero en efectivo (${fmtMoney(eco.cash, sym)}).` };

  const gameKey = `${guildId}-${userId}`;
  if (activeBJGames.has(gameKey)) {
    return { content: `⚠️ Ya tienes una partida de Blackjack activa en curso.` };
  }

  const deck = createDeck();
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];

  activeBJGames.set(gameKey, { guildId, userId, bet, deck, playerHand, dealerHand });

  // Auto-expirar partidas abandonadas tras 5 minutos (anti memory-leak)
  setTimeout(() => {
    if (activeBJGames.has(gameKey)) {
      activeBJGames.delete(gameKey);
      console.log(`[BJ] Partida de ${userId} en ${guildId} expirada por inactividad (5 min).`);
    }
  }, 5 * 60 * 1000);

  const playerScore = calculateHandScore(playerHand);

  // Check instant Blackjack (21)
  if (playerScore === 21) {
    activeBJGames.delete(gameKey);
    const winAmount = Math.floor(bet * 2.5);
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${userId}` },
      data: { cash: { increment: winAmount - bet } },
    });

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('🃏 REGISTRO — BLACKJACK 21 NATURAL (!bj)')
      .setColor(0xF1C40F)
      .setDescription(`<@${userId}> consiguió 21 natural inicial y ganó ${fmtMoney(winAmount, sym)} (x2.5).`)
      .setFooter({ text: `Usuario ID: ${userId}` })
    );

    const embed = new EmbedBuilder()
      .setTitle('🃏 BLACKJACK 21 — ¡BLACKJACK DIRECTO!')
      .setColor(0xF1C40F)
      .setDescription(`¡Enhorabuena! Has sacado 21 natural en el reparto inicial.`)
      .addFields(
        { name: 'Tus cartas', value: `${playerHand.map(c => `${c.value}${c.suit}`).join(' ')} (Total: **21**)` },
        { name: 'Banca', value: `${dealerHand[0].value}${dealerHand[0].suit} 🂠` }
      )
      .setFooter({ text: `¡Premio conseguido: ${winAmount.toLocaleString()} ${sym}!` });

    return { embeds: [embed] };
  }

  const embed = new EmbedBuilder()
    .setTitle('🃏 BLACKJACK 21')
    .setColor(0x5865F2)
    .addFields(
      { name: 'Tus cartas', value: `${playerHand.map(c => `${c.value}${c.suit}`).join(' ')} (Puntos: **${playerScore}**)` },
      { name: 'Banca', value: `${dealerHand[0].value}${dealerHand[0].suit} 🂠` },
      { name: 'Apuesta', value: fmtMoney(bet, sym) }
    )
    .setFooter({ text: 'Selecciona una acción con los botones de abajo.' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`bj_hit_${userId}`).setLabel('Pedir Carta 🃏').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bj_stand_${userId}`).setLabel('Plantarse 🛑').setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

export async function handleBJInteraction(interaction: any) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('bj_hit_') && !interaction.customId.startsWith('bj_stand_')) return;

  const isHit = interaction.customId.startsWith('bj_hit_');
  const targetUserId = interaction.customId.replace('bj_hit_', '').replace('bj_stand_', '');

  if (interaction.user.id !== targetUserId) {
    return interaction.reply({ content: '❌ Solo el jugador de esta partida puede presionar estos botones.', ephemeral: true });
  }

  const guildId = interaction.guildId;
  if (!guildId) return;

  const gameKey = `${guildId}-${targetUserId}`;
  const game = activeBJGames.get(gameKey);

  if (!game) {
    return interaction.reply({ content: '⚠️ Esta partida de Blackjack ya ha finalizado.', ephemeral: true });
  }

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const eco = await getOrCreateUserEconomy(guildId, targetUserId);

  if (isHit) {
    // Hit a card
    game.playerHand.push(game.deck.pop()!);
    const playerScore = calculateHandScore(game.playerHand);

    if (playerScore > 21) {
      // BUST
      activeBJGames.delete(gameKey);
      await prisma.userEconomy.update({
        where: { id: `${guildId}-${targetUserId}` },
        data: { cash: { decrement: game.bet } },
      });

      const embed = new EmbedBuilder()
        .setTitle('🃏 BLACKJACK 21 — TE HAS PASADO')
        .setColor(0xED4245)
        .setDescription(`💸 Te has pasado de 21 y has perdido la apuesta de ${fmtMoney(game.bet, sym)}.`)
        .addFields(
          { name: 'Tus cartas', value: `${game.playerHand.map(c => `${c.value}${c.suit}`).join(' ')} (Total: **${playerScore}**)` },
          { name: 'Banca', value: `${game.dealerHand.map(c => `${c.value}${c.suit}`).join(' ')}` }
        );

      return interaction.update({ embeds: [embed], components: [] });
    } else {
      // Continue game
      const embed = new EmbedBuilder()
        .setTitle('🃏 BLACKJACK 21')
        .setColor(0x5865F2)
        .addFields(
          { name: 'Tus cartas', value: `${game.playerHand.map(c => `${c.value}${c.suit}`).join(' ')} (Puntos: **${playerScore}**)` },
          { name: 'Banca', value: `${game.dealerHand[0].value}${game.dealerHand[0].suit} 🂠` },
          { name: 'Apuesta', value: fmtMoney(game.bet, sym) }
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`bj_hit_${targetUserId}`).setLabel('Pedir Carta 🃏').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bj_stand_${targetUserId}`).setLabel('Plantarse 🛑').setStyle(ButtonStyle.Success)
      );

      return interaction.update({ embeds: [embed], components: [row] });
    }
  } else {
    // STAND: Dealer plays
    activeBJGames.delete(gameKey);
    let dealerScore = calculateHandScore(game.dealerHand);
    while (dealerScore < 17) {
      game.dealerHand.push(game.deck.pop()!);
      dealerScore = calculateHandScore(game.dealerHand);
    }

    const playerScore = calculateHandScore(game.playerHand);
    let outcomeTitle = '';
    let outcomeColor = 0x5865F2;
    let netChange = 0;

    if (dealerScore > 21 || playerScore > dealerScore) {
      // WIN
      outcomeTitle = '🎉 ¡HAS GANADO LA PARTIDA!';
      outcomeColor = 0x57F287;
      netChange = game.bet;
      await prisma.userEconomy.update({
        where: { id: `${guildId}-${targetUserId}` },
        data: { cash: { increment: game.bet } },
      });
    } else if (playerScore === dealerScore) {
      // DRAW / PUSH
      outcomeTitle = '🤝 ¡EMPATE! Apuesta devuelta.';
      outcomeColor = 0xFEE75C;
    } else {
      // LOSE
      outcomeTitle = '💸 HAS PERDIDO';
      outcomeColor = 0xED4245;
      netChange = -game.bet;
      await prisma.userEconomy.update({
        where: { id: `${guildId}-${targetUserId}` },
        data: { cash: { decrement: game.bet } },
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🃏 BLACKJACK 21 — ${outcomeTitle}`)
      .setColor(outcomeColor)
      .addFields(
        { name: 'Tus cartas', value: `${game.playerHand.map(c => `${c.value}${c.suit}`).join(' ')} (Total: **${playerScore}**)` },
        { name: 'Banca', value: `${game.dealerHand.map(c => `${c.value}${c.suit}`).join(' ')} (Total: **${dealerScore}**)` }
      )
      .setFooter({ text: netChange > 0 ? `+${netChange.toLocaleString()} ${sym}` : netChange < 0 ? `${netChange.toLocaleString()} ${sym}` : 'Sin cambios' });

    return interaction.update({ embeds: [embed], components: [] });
  }
}

export async function isCasinoChannelAllowed(guildId: string, channelId: string, member: any): Promise<boolean> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config || !config.casinoChannels || config.casinoChannels.trim() === '') {
    return true; // No restriction
  }

  if (member) {
    const memberPermissions = member.permissions;
    if (typeof memberPermissions === 'object' && memberPermissions.has('Administrator')) {
      return true;
    }
    if (config.adminRoleIds && member.roles?.cache) {
      const adminRoles = config.adminRoleIds.split(',').map((id: string) => id.trim()).filter(Boolean);
      if (adminRoles.some((rId: string) => member.roles.cache.has(rId))) {
        return true;
      }
    }
  }

  const allowedChannels = config.casinoChannels.split(',').map((id: string) => id.trim()).filter(Boolean);
  return allowedChannels.includes(channelId);
}

// ── SHOP ROLES & COLLECTIBLES (TIENDA CON PESTAÑAS Y PAGINACIÓN) ─────────
export async function buildShopView(guildId: string, member: any, category: 'ROLES' | 'ITEMS' = 'ROLES', page: number = 1): Promise<any> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const eco = await getOrCreateUserEconomy(guildId, member.id);

  const [shopRoles, shopItems] = await Promise.all([
    prisma.shopRole.findMany({ where: { guildId }, orderBy: { price: 'asc' } }),
    prisma.shopItem.findMany({ where: { guildId, isAvailable: true }, orderBy: { price: 'asc' } }),
  ]);

  const embed = new EmbedBuilder()
    .setTitle('🛒 TIENDA DEL CASINO — ROLES & COLECCIONABLES EXCLUSIVOS')
    .setColor(0xF1C40F)
    .setThumbnail(member.guild.iconURL() || null);

  if (shopRoles.length === 0 && shopItems.length === 0) {
    embed.setDescription(`❌ No hay roles ni objetos coleccionables a la venta en la tienda actualmente.\n\n*Los administradores pueden añadir artículos desde el Panel Web.*`);
    return { embeds: [embed] };
  }

  const roleIncomes = await prisma.roleIncome.findMany({ where: { guildId } });
  const roleIncomeMap = new Map(roleIncomes.map(ri => [ri.roleId, ri]));

  const headerText = `¡Usa \`!buy <nombre>\` para adquirir cualquier rol u objeto!\n\n💳 **Tu Saldo en Efectivo**: ${fmtMoney(eco.cash, sym)}\n🎒 **Tu Mochila**: Usa \`!inventory\` para ver tus coleccionables.\n\n---`;

  const pageSize = 5;

  if (category === 'ROLES') {
    const totalRoles = shopRoles.length;
    const totalPages = Math.max(1, Math.ceil(totalRoles / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pagedRoles = shopRoles.slice(startIndex, startIndex + pageSize);

    let desc = `${headerText}\n👑 **ROLES DE TEMPORADA & SERVIDOR** (${totalRoles} disponible${totalRoles === 1 ? '' : 's'})\n───────────────────`;

    if (pagedRoles.length === 0) {
      desc += `\n*No hay roles puestos a la venta actualmente.*`;
    } else {
      for (const sr of pagedRoles) {
        const role = member.guild.roles.cache.get(sr.roleId);
        const roleName = role ? role.name : `ID: ${sr.roleId}`;
        const incomeInfo = roleIncomeMap.get(sr.roleId);
        const incomeStr = incomeInfo ? ` ➔ 💰 *Cobro: +${incomeInfo.incomeAmount.toLocaleString()} ${sym}/${incomeInfo.intervalHours || 3}h*` : '';
        const hasRole = member.roles.cache.has(sr.roleId);

        desc += `\n${sr.icon} **${roleName}** ${hasRole ? '✅ *(Poseído)*' : ''}\n• **Precio**: **${sr.price.toLocaleString()} ${sym}**${incomeStr}\n• *${sr.description || 'Sin descripción'}*\n• **Comprar**: \`!buy ${roleName.toLowerCase()}\``;
      }
    }

    embed.setDescription(desc);
    embed.setFooter({ text: `Página ${currentPage} de ${totalPages} | Usa !buy <nombre> para comprar` });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_tab_ROLES_${member.id}`)
        .setLabel(`👑 Roles (${totalRoles})`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`shop_tab_ITEMS_${member.id}`)
        .setLabel(`🎒 Coleccionables (${shopItems.length})`)
        .setStyle(ButtonStyle.Secondary)
    );

    const components: any[] = [row1];

    if (totalPages > 1) {
      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_page_ROLES_${currentPage - 1}_${member.id}`)
          .setLabel('◀️ Anterior')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage <= 1),
        new ButtonBuilder()
          .setCustomId(`shop_info_${currentPage}`)
          .setLabel(`Pág ${currentPage}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`shop_page_ROLES_${currentPage + 1}_${member.id}`)
          .setLabel('Siguiente ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= totalPages)
      );
      components.push(row2);
    }

    return { embeds: [embed], components };
  } else {
    // ITEMS category
    const totalItems = shopItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pagedItems = shopItems.slice(startIndex, startIndex + pageSize);

    let desc = `${headerText}\n🎒 **COLECCIONABLES EXCLUSIVOS** (${totalItems} disponible${totalItems === 1 ? '' : 's'})\n───────────────────`;

    if (pagedItems.length === 0) {
      desc += `\n*No hay objetos coleccionables puestos a la venta actualmente.*`;
    } else {
      for (const si of pagedItems) {
        const rarityTag = `\`[${si.rarity || 'Común'}]\``;
        desc += `\n${si.icon} **${si.name}** ${rarityTag}\n• **Precio**: **${si.price.toLocaleString()} ${sym}**\n• *${si.description || 'Sin descripción'}*\n• **Comprar**: \`!buy ${si.name.toLowerCase()}\``;
      }
    }

    embed.setDescription(desc);
    embed.setFooter({ text: `Página ${currentPage} de ${totalPages} | Usa !buy <nombre> para comprar` });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_tab_ROLES_${member.id}`)
        .setLabel(`👑 Roles (${shopRoles.length})`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`shop_tab_ITEMS_${member.id}`)
        .setLabel(`🎒 Coleccionables (${totalItems})`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    const components: any[] = [row1];

    if (totalPages > 1) {
      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_page_ITEMS_${currentPage - 1}_${member.id}`)
          .setLabel('◀️ Anterior')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage <= 1),
        new ButtonBuilder()
          .setCustomId(`shop_info_${currentPage}`)
          .setLabel(`Pág ${currentPage}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`shop_page_ITEMS_${currentPage + 1}_${member.id}`)
          .setLabel('Siguiente ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= totalPages)
      );
      components.push(row2);
    }

    return { embeds: [embed], components };
  }
}

export async function handleShop(guildId: string, member: any): Promise<any> {
  return await buildShopView(guildId, member, 'ROLES', 1);
}

export async function handleBuy(guildId: string, member: any, query: string): Promise<string> {
  if (!query || query.trim() === '') {
    return `⚠️ Por favor especifica el rol o ítem que deseas comprar. Ejemplo: \`!buy zelda\` o \`!buy copa\`. Para ver la lista usa \`!shop\`.`;
  }

  const cleanQuery = query.trim().toLowerCase().replace(/<@&|>|#/g, '');
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const eco = await getOrCreateUserEconomy(guildId, member.id);

  // 1. Match ShopRole first
  const shopRoles = await prisma.shopRole.findMany({ where: { guildId } });
  let matchedShopRole = shopRoles.find(sr => sr.roleId === cleanQuery);
  if (!matchedShopRole) {
    for (const sr of shopRoles) {
      const role = member.guild.roles.cache.get(sr.roleId);
      if (role) {
        const rName = role.name.toLowerCase();
        if (rName === cleanQuery || rName.includes(cleanQuery) || cleanQuery.includes(rName)) {
          matchedShopRole = sr;
          break;
        }
      }
    }
  }

  if (matchedShopRole) {
    const role = member.guild.roles.cache.get(matchedShopRole.roleId);
    const roleName = role ? role.name : `ID: ${matchedShopRole.roleId}`;

    if (member.roles.cache.has(matchedShopRole.roleId)) {
      return `⚠️ Ya posees el rol **${roleName}**. ¡No necesitas volver a comprarlo!`;
    }

    if (eco.cash < matchedShopRole.price) {
      return `❌ No tienes suficiente dinero en efectivo para comprar **${roleName}** (Precio: ${fmtMoney(matchedShopRole.price, sym)} | Tu efectivo: ${fmtMoney(eco.cash, sym)}).`;
    }

    await prisma.userEconomy.update({
      where: { id: `${guildId}-${member.id}` },
      data: { cash: { decrement: matchedShopRole.price } },
    });

    if (role) {
      await member.roles.add(role.id).catch(() => null);
    }

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('🛒 REGISTRO — COMPRA DE ROL EN TIENDA (!buy)')
      .setColor(0xF1C40F)
      .setDescription(`<@${member.id}> ha comprado el rol **${roleName}** por ${fmtMoney(matchedShopRole.price, sym)}.`)
      .setFooter({ text: `Usuario ID: ${member.id} | Rol ID: ${matchedShopRole.roleId}` })
    );

    return `🎉 **¡COMPRA EXITOSA!** Has adquirido el rol **${roleName}** por ${fmtMoney(matchedShopRole.price, sym)} y te ha sido asignado automáticamente en Discord. ¡Disfrútalo! 👑`;
  }

  // 2. Match ShopItem (Collectible)
  const shopItems = await prisma.shopItem.findMany({ where: { guildId, isAvailable: true } });
  let matchedShopItem = shopItems.find(si => si.id === cleanQuery || si.name.toLowerCase() === cleanQuery);
  if (!matchedShopItem) {
    matchedShopItem = shopItems.find(si => si.name.toLowerCase().includes(cleanQuery) || cleanQuery.includes(si.name.toLowerCase()));
  }

  if (matchedShopItem) {
    if (eco.cash < matchedShopItem.price) {
      return `❌ No tienes suficiente dinero en efectivo para comprar el coleccionable **${matchedShopItem.name}** (Precio: ${fmtMoney(matchedShopItem.price, sym)} | Tu efectivo: ${fmtMoney(eco.cash, sym)}).`;
    }

    // Deduct cash
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${member.id}` },
      data: { cash: { decrement: matchedShopItem.price } },
    });

    // Add to UserInventory
    const invId = `${guildId}-${member.id}-${matchedShopItem.id}`;
    const existingInv = await prisma.userInventory.findUnique({ where: { id: invId } });
    let newQty = 1;
    if (existingInv) {
      newQty = existingInv.quantity + 1;
      await prisma.userInventory.update({
        where: { id: invId },
        data: { quantity: newQty },
      });
    } else {
      await prisma.userInventory.create({
        data: {
          id: invId,
          guildId,
          userId: member.id,
          shopItemId: matchedShopItem.id,
          quantity: 1,
        },
      });
    }

    sendCasinoLog(guildId, new EmbedBuilder()
      .setTitle('🎒 REGISTRO — COMPRA DE COLECCIONABLE (!buy)')
      .setColor(0x9B59B6)
      .setDescription(`<@${member.id}> ha comprado el coleccionable ${matchedShopItem.icon} **${matchedShopItem.name}** (\`[${matchedShopItem.rarity}]\`) por ${fmtMoney(matchedShopItem.price, sym)}.`)
      .setFooter({ text: `Usuario ID: ${member.id} | Item ID: ${matchedShopItem.id}` })
    );

    return `🎉 **¡COMPRA EXITOSA!** Has adquirido el coleccionable ${matchedShopItem.icon} **${matchedShopItem.name}** (\`[${matchedShopItem.rarity}]\`) por ${fmtMoney(matchedShopItem.price, sym)}. ¡Se ha añadido a tu mochila! (Total en inventario: **x${newQty}**). Puedes consultar tus ítems con \`!inventory\`. 🎒`;
  }

  return `❌ No se encontró ningún rol ni objeto coleccionable que coincida con "**${query}**". Revisa los artículos disponibles ejecutando \`!shop\`.`;
}

// Alias for backwards compatibility
export const handleBuyRole = handleBuy;

// ── INVENTORY SYSTEM (!inventory / !inv CON PAGINACIÓN) ───────────────────
export async function buildInventoryView(guildId: string, member: any, targetUser: any, page: number = 1): Promise<any> {
  const user = targetUser || member.user;
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';

  const userItems = await prisma.userInventory.findMany({
    where: { guildId, userId: user.id },
  });

  const shopItemIds = userItems.map(ui => ui.shopItemId);
  const shopItems = await prisma.shopItem.findMany({
    where: { id: { in: shopItemIds } },
  });

  const shopItemMap = new Map(shopItems.map(si => [si.id, si]));

  const embed = new EmbedBuilder()
    .setTitle(`🎒 INVENTARIO DE COLECCIONABLES — ${user.username}`)
    .setColor(0x9B59B6)
    .setThumbnail(user.displayAvatarURL({ extension: 'png', size: 256 }));

  if (userItems.length === 0) {
    embed.setDescription(`❌ **${user.username}** no tiene ningún objeto coleccionable en su inventario.\n\n*¡Usa \`!shop\` o \`/shop\` para descubrir y comprar objetos coleccionables exclusivos!*`);
    return { embeds: [embed] };
  }

  const pageSize = 5;
  const totalItemsCount = userItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItemsCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedUserItems = userItems.slice(startIndex, startIndex + pageSize);

  let descriptionText = `¡Consulta tus ítems exclusivos reunidos!\n\n---`;
  let totalCount = 0;

  for (const ui of userItems) {
    totalCount += ui.quantity;
  }

  for (const ui of pagedUserItems) {
    const item = shopItemMap.get(ui.shopItemId);
    if (!item) continue;

    const rarityBadge = `\`[${item.rarity || 'Común'}]\``;
    descriptionText += `\n\n${item.icon} **${item.name}** ${rarityBadge} x**${ui.quantity}**\n• *${item.description || 'Objeto Coleccionable'}*\n• **Valor original**: ${fmtMoney(item.price, sym)}`;
  }

  embed.setDescription(descriptionText);
  embed.setFooter({ text: `Total de ítems en mochila: ${totalCount} | Página ${currentPage} de ${totalPages}` });

  const components: any[] = [];

  if (totalPages > 1) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`inv_page_${user.id}_${currentPage - 1}_${member.id}`)
        .setLabel('◀️ Anterior')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage <= 1),
      new ButtonBuilder()
        .setCustomId(`inv_info_${currentPage}`)
        .setLabel(`Página ${currentPage}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`inv_page_${user.id}_${currentPage + 1}_${member.id}`)
        .setLabel('Siguiente ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages)
    );
    components.push(row);
  }

  return { embeds: [embed], components };
}

export async function handleInventory(guildId: string, member: any, targetUser: any): Promise<any> {
  return await buildInventoryView(guildId, member, targetUser, 1);
}

export async function handleShopAndInventoryInteraction(interaction: any) {
  if (!interaction.isButton() || !interaction.guild) return;

  const { customId, guild, member, user } = interaction;

  // 1. Shop Tabs & Pages: shop_tab_CATEGORY_userId or shop_page_CATEGORY_page_userId
  if (customId.startsWith('shop_tab_') || customId.startsWith('shop_page_')) {
    const parts = customId.split('_'); // ['shop', 'tab'|'page', CATEGORY, page/userId, ownerId]
    const action = parts[1]; // 'tab' or 'page'
    const category = parts[2] as 'ROLES' | 'ITEMS';

    let targetPage = 1;
    let ownerId = '';

    if (action === 'tab') {
      ownerId = parts[3];
    } else if (action === 'page') {
      targetPage = parseInt(parts[3], 10) || 1;
      ownerId = parts[4];
    }

    if (ownerId && user.id !== ownerId) {
      return interaction.reply({ content: '❌ Solo la persona que abrió la tienda puede cambiar de pestaña.', ephemeral: true });
    }

    await interaction.deferUpdate();
    const view = await buildShopView(guild.id, member, category, targetPage);
    return interaction.editReply(view);
  }

  // 3. Top Money Pages: topmoney_page_pageNum_ownerId
  if (customId.startsWith('topmoney_page_')) {
    const parts = customId.split('_'); // ['topmoney', 'page', pageNum, ownerId]
    const targetPage = parseInt(parts[2], 10) || 1;
    const ownerId = parts[3];

    if (ownerId && user.id !== ownerId) {
      return interaction.reply({ content: '❌ Solo la persona que abrió la clasificación puede cambiar de página.', ephemeral: true });
    }

    await interaction.deferUpdate();
    const view = await buildTopMoneyView(guild.id, member, targetPage);
    return interaction.editReply(view);
  }

  // 4. Buy Chicken button: buy_chicken_userId
  if (customId.startsWith('buy_chicken_')) {
    const ownerId = customId.replace('buy_chicken_', '');
    if (user.id !== ownerId) {
      return interaction.reply({ content: '❌ Solo el jugador de esta pelea puede presionar este botón.', ephemeral: true });
    }

    const config = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } });
    const sym = config?.currencySymbol || '💶';
    const cost = config?.chickenCost || 5000;
    const eco = await getOrCreateUserEconomy(guild.id, ownerId);

    if (eco.hasChicken) {
      return interaction.reply({ content: '🐔 ¡Ya tienes un gallo listo en tu corral! Usa `!cf <apuesta>` para pelear.', ephemeral: true });
    }

    if (eco.cash < cost) {
      return interaction.reply({ content: `❌ El pollo de pelea cuesta ${fmtMoney(cost, sym)}. No tienes suficiente dinero en efectivo (${fmtMoney(eco.cash, sym)}).`, ephemeral: true });
    }

    await prisma.userEconomy.update({
      where: { id: `${guild.id}-${ownerId}` },
      data: {
        cash: { decrement: cost },
        hasChicken: true,
      },
    });

    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_chicken_done`)
        .setLabel('✅ ¡Gallo Adquirido!')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    );

    const embed = new EmbedBuilder()
      .setTitle('🐔 ¡NUEVO GALLO ADQUIRIDO!')
      .setColor(0x57F287)
      .setDescription(`🎉 Has comprado un temible **Pollo de Pelea** por **${fmtMoney(cost, sym)}**.\n\n*¡Ya está en tu corral listo para luchar! Usa \`!cf <apuesta>\` para volver a la pelea.*`)
      .setFooter({ text: `Tu efectivo restante: ${fmtMoney(eco.cash - cost, sym)}` });

    return interaction.update({ embeds: [embed], components: [disabledRow] });
  }
}

// ── TOP RICHEST USERS LEADERBOARD (!top / !baltop) ─────────────────────
export async function buildTopMoneyView(guildId: string, member: any, page: number = 1): Promise<any> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';

  const allEcos = await prisma.userEconomy.findMany({
    where: { guildId },
  });

  const sortedEcos = allEcos
    .map(e => ({
      ...e,
      totalNetWorth: e.cash + e.bank,
    }))
    .filter(e => e.totalNetWorth > 0)
    .sort((a, b) => b.totalNetWorth - a.totalNetWorth);

  const embed = new EmbedBuilder()
    .setTitle('🏆 CLASIFICACIÓN DE RIQUEZA — TOP MILLONARIOS')
    .setColor(0xF1C40F)
    .setThumbnail(member.guild.iconURL() || null);

  if (sortedEcos.length === 0) {
    embed.setDescription('❌ Aún no hay registros de economía en esta temporada.');
    return { embeds: [embed] };
  }

  const pageSize = 10;
  const totalUsers = sortedEcos.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedUsers = sortedEcos.slice(startIndex, startIndex + pageSize);

  let description = `¡Consulta los usuarios más ricos del servidor esta temporada!\n\n`;
  const medals = ['🥇', '🥈', '🥉'];

  pagedUsers.forEach((e, idx) => {
    const globalRank = startIndex + idx + 1;
    const rankBadge = globalRank <= 3 ? medals[globalRank - 1] : `\`#${globalRank}\``;
    const userMention = `<@${e.userId}>`;
    const totalFormatted = fmtMoney(e.totalNetWorth, sym);

    description += `${rankBadge} ${userMention} ➔ **${totalFormatted}**\n`;
  });

  embed.setDescription(description);
  embed.setFooter({ text: `Página ${currentPage} de ${totalPages} | Total registrado: ${totalUsers} usuarios` });

  const components: any[] = [];
  if (totalPages > 1) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`topmoney_page_${currentPage - 1}_${member.id}`)
        .setLabel('◀️ Anterior')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage <= 1),
      new ButtonBuilder()
        .setCustomId(`topmoney_info_${currentPage}`)
        .setLabel(`Página ${currentPage}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`topmoney_page_${currentPage + 1}_${member.id}`)
        .setLabel('Siguiente ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages)
    );
    components.push(row);
  }

  return { embeds: [embed], components };
}

export async function handleTopMoney(guildId: string, member: any): Promise<any> {
  return await buildTopMoneyView(guildId, member, 1);
}
export async function isStaffOrAdmin(guildId: string, member: any): Promise<boolean> {
  if (!member) return false;
  if (member.permissions && typeof member.permissions.has === 'function' && member.permissions.has('Administrator')) {
    return true;
  }
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (config?.adminRoleIds && member.roles?.cache) {
    const adminRoles = config.adminRoleIds.split(',').map((id: string) => id.trim()).filter(Boolean);
    if (adminRoles.some((rId: string) => member.roles.cache.has(rId))) {
      return true;
    }
  }
  return false;
}

// ── TRANSFER MONEY BETWEEN USERS (!pay) ──────────────────────────────────
export async function handlePay(guildId: string, senderMember: any, targetUser: any, amountStr: string): Promise<string> {
  if (!targetUser) return `⚠️ Debes mencionar al usuario a quien deseas transferirle dinero. Ejemplo: \`!pay @Usuario 50k\``;
  if (targetUser.bot) return `❌ No puedes transferir dinero a un bot.`;
  if (targetUser.id === senderMember.id) return `❌ No puedes transferirte dinero a ti mismo.`;

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const senderEco = await getOrCreateUserEconomy(guildId, senderMember.id);
  const targetEco = await getOrCreateUserEconomy(guildId, targetUser.id);

  const amount = parseMoneyAmount(amountStr, senderEco.cash);
  if (!amount || amount <= 0) {
    return `⚠️ Especifica una cantidad válida a transferir (puedes usar 50k, 1.5m, 1e6, half, all). Ejemplo: \`!pay @Usuario 100k\``;
  }

  if (amount > senderEco.cash) {
    return `❌ No tienes suficiente dinero en efectivo (${fmtMoney(senderEco.cash, sym)}) para enviar ${fmtMoney(amount, sym)}.`;
  }

  // $transaction garantiza que el débito y el crédito son atómicos (sin dinero perdido en el medio)
  await prisma.$transaction([
    prisma.userEconomy.update({
      where: { id: `${guildId}-${senderMember.id}` },
      data: { cash: { decrement: amount } },
    }),
    prisma.userEconomy.update({
      where: { id: `${guildId}-${targetUser.id}` },
      data: { cash: { increment: amount } },
    }),
  ]);

  sendCasinoLog(guildId, new EmbedBuilder()
    .setTitle('💸 REGISTRO — TRANSFERENCIA DE DINERO (!pay)')
    .setColor(0x3498DB)
    .setDescription(`<@${senderMember.id}> ha enviado ${fmtMoney(amount, sym)} a <@${targetUser.id}> (${targetUser.username}).`)
    .setFooter({ text: `Emisor: ${senderMember.id} | Receptor: ${targetUser.id}` })
  );

  return `💸 **TRANSFERENCIA EXITOSA**: Le has enviado ${fmtMoney(amount, sym)} en efectivo a **${targetUser.username}**!`;
}

// ── STAFF / ADMIN MONEY MANAGEMENT ────────────────────────────────────────
export async function handleAddMoney(guildId: string, staffMember: any, targetUser: any, amountStr: string): Promise<string> {
  const isAdmin = await isStaffOrAdmin(guildId, staffMember);
  if (!isAdmin) return `❌ No tienes permisos de administración o rol de Staff para usar este comando.`;
  if (!targetUser) return `⚠️ Especifica el usuario y la cantidad. Ejemplo: \`!add-money @Usuario 100k\``;

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const targetEco = await getOrCreateUserEconomy(guildId, targetUser.id);

  const amount = parseMoneyAmount(amountStr, 1000000000);
  if (!amount || amount <= 0) return `⚠️ Especifica una cantidad válida a añadir.`;

  await prisma.userEconomy.update({
    where: { id: `${guildId}-${targetUser.id}` },
    data: { cash: { increment: amount } },
  });

  sendCasinoLog(guildId, new EmbedBuilder()
    .setTitle('🛡️ REGISTRO ADMIN — AÑADIR DINERO (!add-money)')
    .setColor(0x2ECC71)
    .setDescription(`El staff <@${staffMember.id}> añadió ${fmtMoney(amount, sym)} a <@${targetUser.id}> (${targetUser.username}).`)
    .setFooter({ text: `Staff ID: ${staffMember.id} | Usuario ID: ${targetUser.id}` })
  );

  return `✅ **STAFF**: Se han añadido ${fmtMoney(amount, sym)} al efectivo de **${targetUser.username}** (Nuevo saldo: ${fmtMoney(targetEco.cash + amount, sym)}).`;
}

export async function handleRemoveMoney(guildId: string, staffMember: any, targetUser: any, amountStr: string): Promise<string> {
  const isAdmin = await isStaffOrAdmin(guildId, staffMember);
  if (!isAdmin) return `❌ No tienes permisos de administración o rol de Staff para usar este comando.`;
  if (!targetUser) return `⚠️ Especifica el usuario y la cantidad. Ejemplo: \`!remove-money @Usuario 50k\``;

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const targetEco = await getOrCreateUserEconomy(guildId, targetUser.id);

  const amount = parseMoneyAmount(amountStr, targetEco.cash);
  if (!amount || amount <= 0) return `⚠️ Especifica una cantidad válida a quitar.`;

  const newCash = Math.max(0, targetEco.cash - amount);

  await prisma.userEconomy.update({
    where: { id: `${guildId}-${targetUser.id}` },
    data: { cash: newCash },
  });

  sendCasinoLog(guildId, new EmbedBuilder()
    .setTitle('🛡️ REGISTRO ADMIN — RETIRAR DINERO (!remove-money)')
    .setColor(0xED4245)
    .setDescription(`El staff <@${staffMember.id}> retiró ${fmtMoney(amount, sym)} a <@${targetUser.id}> (${targetUser.username}).`)
    .setFooter({ text: `Staff ID: ${staffMember.id} | Usuario ID: ${targetUser.id}` })
  );

  return `✅ **STAFF**: Se han retirado ${fmtMoney(amount, sym)} del efectivo de **${targetUser.username}** (Nuevo saldo: ${fmtMoney(newCash, sym)}).`;
}

export async function handleSetMoney(guildId: string, staffMember: any, targetUser: any, amountStr: string): Promise<string> {
  const isAdmin = await isStaffOrAdmin(guildId, staffMember);
  if (!isAdmin) return `❌ No tienes permisos de administración o rol de Staff para usar este comando.`;
  if (!targetUser) return `⚠️ Especifica el usuario y la cantidad. Ejemplo: \`!set-money @Usuario 500k\``;

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';

  const amount = parseMoneyAmount(amountStr, 1000000000);
  if (amount === null || amount < 0) return `⚠️ Especifica una cantidad válida.`;

  await getOrCreateUserEconomy(guildId, targetUser.id);
  await prisma.userEconomy.update({
    where: { id: `${guildId}-${targetUser.id}` },
    data: { cash: amount },
  });

  sendCasinoLog(guildId, new EmbedBuilder()
    .setTitle('🛡️ REGISTRO ADMIN — AJUSTAR DINERO (!set-money)')
    .setColor(0xF1C40F)
    .setDescription(`El staff <@${staffMember.id}> fijó el efectivo de <@${targetUser.id}> (${targetUser.username}) a ${fmtMoney(amount, sym)}.`)
    .setFooter({ text: `Staff ID: ${staffMember.id} | Usuario ID: ${targetUser.id}` })
  );

  return `✅ **STAFF**: Se ha establecido el efectivo de **${targetUser.username}** a ${fmtMoney(amount, sym)}.`;
}

// ── MANEJADOR DE COMANDOS DE PREFIJO (!work, !dep, !bj, !roulette, etc.) ───
export async function handlePrefixEconomyCommands(message: Message) {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim();
  if (!content.startsWith('!')) return;

  const args = content.slice(1).split(/\s+/);
  const cmd = args[0].toLowerCase();

  const economyCmds = [
    'bal', 'balance', 'money', 'dinero',
    'dep', 'deposit', 'with', 'withdraw',
    'work', 'crime', 'slut', 'rob',
    'pay', 'dar', 'pagar', 'transfer', 'transferir', 'give-money', 'givemoney', 'give',
    'add-money', 'addmoney', 'dar-dinero', 'dar-efectivo',
    'remove-money', 'removemoney', 'quitar-dinero', 'take-money',
    'set-money', 'setmoney', 'fijar-dinero',
    'collect-income', 'collect', 'cobrar', 'role-income',
    'shop', 'store', 'tienda',
    'inv', 'inventory', 'mochila', 'inventario', 'items',
    'bj', 'blackjack', 'sm', 'slot', 'slot-machine',
    'roulette', 'cf', 'chicken-fight', 'buy-chicken', 'buy-ken', 'buy',
    'gallo', 'gallos', 'gallinero', 'cockfight', 'pelear-gallo',
    'top', 'baltop', 'richest', 'top-dinero', 'top-money', 'topmoney', 'topdinero'
  ];

  if (!economyCmds.includes(cmd)) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  // Staff commands bypass channel restrictions if caller is staff
  const staffCmds = ['add-money', 'addmoney', 'dar-dinero', 'dar-efectivo', 'remove-money', 'removemoney', 'quitar-dinero', 'take-money', 'set-money', 'setmoney', 'fijar-dinero'];
  const isStaffCmd = staffCmds.includes(cmd);

  // Check channel restriction
  const isAllowed = await isCasinoChannelAllowed(guildId, message.channelId, message.member);
  if (!isAllowed && !isStaffCmd) {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    const allowedMention = (config?.casinoChannels || '')
      .split(',')
      .map(id => `<#${id.trim()}>`)
      .join(', ');

    return message.reply(`❌ Los comandos de Casino y Economía solo están permitidos en los canales de juego: ${allowedMention}`);
  }

  // Helper to auto-expire message buttons after 5 minutes
  const sendWithAutoExpire = async (res: any) => {
    const msg = await message.reply(res as any);
    if (msg.components && msg.components.length > 0) {
      setTimeout(async () => {
        try {
          const disabledRows = msg.components.map((row: any) => {
            const newRow = new ActionRowBuilder<ButtonBuilder>();
            row.components.forEach((btn: any) => {
              newRow.addComponents(
                ButtonBuilder.from(btn).setDisabled(true)
              );
            });
            return newRow;
          });
          const embeds = msg.embeds.map((e: any) => {
            return EmbedBuilder.from(e).setFooter({ text: `⏰ Este menú ha caducado por inactividad.` });
          });
          await msg.edit({ embeds, components: disabledRows }).catch(() => null);
        } catch { }
      }, 5 * 60 * 1000);
    }
    return msg;
  };

  // 1. Balance (!bal / !money)
  if (cmd === 'bal' || cmd === 'balance' || cmd === 'money' || cmd === 'dinero') {
    const targetUser = message.mentions.users.first() || message.author;
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    const sym = config?.currencySymbol || '💶';
    const eco = await getOrCreateUserEconomy(guildId, targetUser.id);
    const total = eco.cash + eco.bank;

    const embed = new EmbedBuilder()
      .setTitle(`💳 MONEDERO Y BANCO — ${targetUser.username}`)
      .setColor(0x5865F2)
      .addFields(
        { name: '💵 En Efectivo', value: fmtMoney(eco.cash, sym), inline: true },
        { name: '🏦 En el Banco', value: fmtMoney(eco.bank, sym), inline: true },
        { name: '💰 Total Neto', value: fmtMoney(total, sym), inline: true }
      )
      .setThumbnail(targetUser.displayAvatarURL());

    return message.reply({ embeds: [embed] });
  }

  // 2. Deposit (!dep)
  if (cmd === 'dep' || cmd === 'deposit') {
    const res = await handleDeposit(guildId, userId, args[1] || '');
    return message.reply(res);
  }

  // 3. Withdraw (!with || !withdraw)
  if (cmd === 'with' || cmd === 'withdraw') {
    const res = await handleWithdraw(guildId, userId, args[1] || '');
    return message.reply(res);
  }

  // 4. Work (!work)
  if (cmd === 'work') {
    const res = await handleWork(guildId, userId);
    return message.reply(res);
  }

  // 5. Crime (!crime)
  if (cmd === 'crime') {
    const res = await handleCrime(guildId, userId);
    return message.reply(res);
  }

  // 6. Slut (!slut)
  if (cmd === 'slut') {
    const res = await handleSlut(guildId, userId);
    return message.reply(res);
  }

  // 7. Rob (!rob @user)
  if (cmd === 'rob') {
    const victim = message.mentions.users.first();
    if (!victim) return message.reply('❌ Debes mencionar al usuario al que quieres robar. Ej: `!rob @RetraBot`');
    const res = await handleRob(guildId, userId, victim.id, victim.username);
    return message.reply(res);
  }

  // 8. Collect Income (!collect-income / !collect)
  if (cmd === 'collect-income' || cmd === 'collect' || cmd === 'cobrar') {
    const res = await handleCollectIncome(guildId, message.member);
    return message.reply(res);
  }

  // 9. Role Income info (!role-income)
  if (cmd === 'role-income') {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    const sym = config?.currencySymbol || '💶';
    const roleIncomes = await prisma.roleIncome.findMany({
      where: { guildId },
      orderBy: { incomeAmount: 'desc' },
    });

    if (roleIncomes.length === 0) {
      return message.reply('❌ No hay roles con ingresos pasivos de temporada configurados.');
    }

    const lines = roleIncomes.map(ri => `<@&${ri.roleId}> ➔ ${fmtMoney(ri.incomeAmount, sym)} cada **${ri.intervalHours || 3}h**`);
    const embed = new EmbedBuilder()
      .setTitle('📅 INGRESOS PASIVOS POR ROLES (TEMPORADA ACTUAL)')
      .setColor(0xF1C40F)
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Usa !collect-income para reclamar tus pagos.' });

    return message.reply({ embeds: [embed] });
  }

  // 10. Blackjack (!bj / !blackjack)
  if (cmd === 'bj' || cmd === 'blackjack') {
    const res = await startBlackjack(guildId, userId, args[1] || '');
    return sendWithAutoExpire(res);
  }

  // 11. Slot Machine (!sm / !slot)
  if (cmd === 'sm' || cmd === 'slot' || cmd === 'slot-machine') {
    const res = await handleSlotMachine(guildId, userId, args[1] || '');
    return sendWithAutoExpire(res);
  }

  // 12. Roulette (!roulette)
  if (cmd === 'roulette') {
    const res = await handleRoulette(guildId, userId, args[1] || '', args[2] || '');
    return sendWithAutoExpire(res);
  }

  // 13. Chicken Fight (!cf / !chicken-fight)
  if (cmd === 'cf' || cmd === 'chicken-fight') {
    const res = await handleChickenFight(guildId, userId, args[1] || '', args[2] || '');
    return sendWithAutoExpire(res);
  }

  // 14. Buy Chicken (!buy-chicken / !buy chicken / !buy ken / !buy-ken / !buy item chicken)
  if (
    cmd === 'buy-chicken' ||
    cmd === 'buy-ken' ||
    (cmd === 'buy' && ['chicken', 'ken', 'gallo'].includes(args[1]?.toLowerCase())) ||
    (cmd === 'buy' && args[1]?.toLowerCase() === 'item' && ['chicken', 'ken', 'gallo'].includes(args[2]?.toLowerCase()))
  ) {
    const res = await handleBuyChicken(guildId, userId);
    return message.reply(res);
  }

  // 15. Shop / Store (!shop / !store / !tienda)
  if (cmd === 'shop' || cmd === 'store' || cmd === 'tienda') {
    const res = await handleShop(guildId, message.member);
    return sendWithAutoExpire(res);
  }

  // 16. Inventory / Mochila (!inv / !inventory / !mochila)
  if (cmd === 'inv' || cmd === 'inventory' || cmd === 'mochila' || cmd === 'inventario' || cmd === 'items') {
    const targetUser = message.mentions.users.first() || message.author;
    const res = await handleInventory(guildId, message.member, targetUser);
    return sendWithAutoExpire(res);
  }

  // 17. Buy Role or Item (!buy <nombre>)
  if (cmd === 'buy') {
    const itemQuery = args.slice(1).join(' ');
    const res = await handleBuy(guildId, message.member, itemQuery);
    return message.reply(res);
  }

  // 17. Transfer Money (!pay / !dar / !pagar / !give-money)
  if (cmd === 'pay' || cmd === 'dar' || cmd === 'pagar' || cmd === 'transfer' || cmd === 'transferir' || cmd === 'give-money' || cmd === 'givemoney' || cmd === 'give') {
    let targetUser = message.mentions.users.first();
    let amountStr = '';
    if (targetUser) {
      amountStr = args[1]?.includes(targetUser.id) ? (args[2] || '') : (args[1] || '');
    } else if (args[1]) {
      const cleanId = args[1].replace(/<@!?|>|#/g, '');
      try {
        targetUser = await message.client.users.fetch(cleanId);
        amountStr = args[2] || '';
      } catch {
        if (args[2]) {
          const cleanId2 = args[2].replace(/<@!?|>|#/g, '');
          try {
            targetUser = await message.client.users.fetch(cleanId2);
            amountStr = args[1] || '';
          } catch { }
        }
      }
    }
    const res = await handlePay(guildId, message.member, targetUser, amountStr);
    return message.reply(res);
  }

  // 18. Staff Add Money (!add-money @user <amount>)
  if (cmd === 'add-money' || cmd === 'addmoney' || cmd === 'dar-dinero' || cmd === 'dar-efectivo') {
    let targetUser = message.mentions.users.first();
    let amountStr = '';
    if (targetUser) {
      amountStr = args[1]?.includes(targetUser.id) ? (args[2] || '') : (args[1] || '');
    } else if (args[1]) {
      const cleanId = args[1].replace(/<@!?|>|#/g, '');
      try {
        targetUser = await message.client.users.fetch(cleanId);
        amountStr = args[2] || '';
      } catch { }
    }
    const res = await handleAddMoney(guildId, message.member, targetUser, amountStr);
    return message.reply(res);
  }

  // 19. Staff Remove Money (!remove-money @user <amount>)
  if (cmd === 'remove-money' || cmd === 'removemoney' || cmd === 'quitar-dinero' || cmd === 'take-money') {
    let targetUser = message.mentions.users.first();
    let amountStr = '';
    if (targetUser) {
      amountStr = args[1]?.includes(targetUser.id) ? (args[2] || '') : (args[1] || '');
    } else if (args[1]) {
      const cleanId = args[1].replace(/<@!?|>|#/g, '');
      try {
        targetUser = await message.client.users.fetch(cleanId);
        amountStr = args[2] || '';
      } catch { }
    }
    const res = await handleRemoveMoney(guildId, message.member, targetUser, amountStr);
    return message.reply(res);
  }

  // 20. Staff Set Money (!set-money @user <amount>)
  if (cmd === 'set-money' || cmd === 'setmoney' || cmd === 'fijar-dinero') {
    let targetUser = message.mentions.users.first();
    let amountStr = '';
    if (targetUser) {
      amountStr = args[1]?.includes(targetUser.id) ? (args[2] || '') : (args[1] || '');
    } else if (args[1]) {
      const cleanId = args[1].replace(/<@!?|>|#/g, '');
      try {
        targetUser = await message.client.users.fetch(cleanId);
        amountStr = args[2] || '';
      } catch { }
    }
    const res = await handleSetMoney(guildId, message.member, targetUser, amountStr);
    return message.reply(res);
  }

  // 21. Top Money (!top / !baltop / !richest)
  if (['top', 'baltop', 'richest', 'top-dinero', 'top-money', 'topmoney', 'topdinero'].includes(cmd)) {
    const res = await handleTopMoney(guildId, message.member);
    return sendWithAutoExpire(res);
  }

  // 22. GalloRPG Prefix Commands (!gallo / !gallinero / !entrenar / !pelear)
  if (['gallo', 'gallos', 'gallinero', 'cockfight', 'pelear-gallo'].includes(cmd)) {
    const sub = (args[1] || '').toLowerCase();
    const sym = (await prisma.guildConfig.findUnique({ where: { guildId } }))?.currencySymbol || '💶';

    if (sub === 'comprar' || sub === 'buy') {
      const res = await handleChickenBuy(guildId, message.author.id, args[2]);
      return message.reply(res);
    }

    if (sub === 'entrenar' || sub === 'train') {
      const res = await handleChickenTrain(guildId, message.author.id, args[2], parseInt(args[3], 10) || 15);
      return message.reply(res);
    }

    if (sub === 'pelear' || sub === 'fight') {
      const res = await handleChickenFight(guildId, message.author.id, args[2] || '', args[3] || '');
      return message.reply(typeof res === 'string' ? res : { embeds: res.embeds });
    }

    // Default: View Interactive Gallinero Hub
    const hub = await buildGallineroHub(guildId, message.author.id, 'HUB');
    return sendWithAutoExpire(hub);
  }
}

// ── GALLO RPG HELPER & HANDLER FUNCTIONS ─────────────────────────────────────

/**
 * Maps real WinRate (0% - 85%) to visual strength percentage (0% - 100%).
 */
export function getVisualStrength(winRate: number): number {
  return Math.min(100, Math.round((winRate / 85) * 100));
}

/**
 * Buy a new Chicken (Max 3 per user).
 * Generates initial WinRate between 30.0% and 55.0% (Visual Strength 35% - 65%).
 */
export async function handleChickenBuy(guildId: string, userId: string, customName?: string) {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const cost = config?.chickenCost || 5000;
  const minBirth = config?.chickenMinBirthWinRate || 30.0;
  const maxBirth = config?.chickenMaxBirthWinRate || 55.0;

  const userCount = await prisma.chicken.count({ where: { guildId, userId } });
  if (userCount >= 3) {
    return '❌ **¡Gallinero Lleno!** Solo puedes tener un máximo de **3 gallos vivos** al mismo tiempo.';
  }

  const eco = await getOrCreateUserEconomy(guildId, userId);
  if (eco.cash < cost) {
    return `❌ No tienes suficiente dinero en efectivo para comprar un gallo (${fmtMoney(cost, sym)}). Saldo actual: ${fmtMoney(eco.cash, sym)}.`;
  }

  // Deduct money
  await prisma.userEconomy.update({
    where: { id: `${guildId}-${userId}` },
    data: { cash: { decrement: cost } },
  });

  // Pick random name from pool if not provided
  const namePool = (config?.chickenNames || 'El Espolón Rojo,Cresta de Acero,Pico de Sangre,El Asesino,Rayo Plumado').split(',');
  const selectedName = customName && customName.trim() ? customName.trim() : namePool[Math.floor(Math.random() * namePool.length)].trim();

  // Generate random birth WinRate between 30% and 55%
  const birthWinRate = parseFloat((minBirth + Math.random() * (maxBirth - minBirth)).toFixed(1));
  const visualStrength = getVisualStrength(birthWinRate);

  const chicken = await prisma.chicken.create({
    data: {
      guildId,
      userId,
      name: selectedName,
      winRate: birthWinRate,
    },
  });

  return `🎉 **¡NUEVO GALLO ADQUIRIDO!** 🐓\n\nName: **${chicken.name}**\n💪 **Fuerza Inicial Visual**: **${visualStrength}%**\n💰 Coste: ${fmtMoney(cost, sym)}\n\n*Usa \`!gallo\` para ver tu gallinero o \`!gallo entrenar\` para ponerlo a punto.*`;
}

/**
 * Display User Gallinero (List of up to 3 chickens with visual strength bar & training status).
 */
export async function handleGallinero(guildId: string, userId: string) {
  const chickens = await prisma.chicken.findMany({
    where: { guildId, userId },
    orderBy: { createdAt: 'asc' },
  });

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';

  if (chickens.length === 0) {
    return `🐔 **TU GALLINERO ESTÁ VACÍO**\n\nNo tienes ningún gallo en tu gallinero. Compra uno por **${fmtMoney(config?.chickenCost || 5000, sym)}** usando \`!gallo comprar <nombre_opcional>\`.`;
  }

  const embed = new EmbedBuilder()
    .setTitle('🐓 GALLINERO DE COMBATE')
    .setColor(0xE67E22)
    .setDescription(`Tienes **${chickens.length}/3** gallos vivos en tu gallinero.\n\n*Recuerda: Entrena a tus gallos en la jaula para asegurar la victoria en las batallas.*`)
    .setFooter({ text: 'Usa !gallo entrenar <id> o !gallo pelear <id> <apuesta>' });

  for (let idx = 0; idx < chickens.length; idx++) {
    const c = chickens[idx];
    const strength = getVisualStrength(c.winRate);
    const progressBar = '█'.repeat(Math.round(strength / 10)) + '░'.repeat(10 - Math.round(strength / 10));

    let statusText = '🟢 Listo para pelear';
    if (c.isTraining && c.trainingEndsAt) {
      const now = new Date();
      if (now < c.trainingEndsAt) {
        const minsLeft = Math.ceil((c.trainingEndsAt.getTime() - now.getTime()) / 60000);
        statusText = `🏋️‍♂️ En Jaula de Entreno (${minsLeft}m restantes)`;
      } else {
        statusText = '✨ Entreno Finalizado (Usa !gallo para reclamar)';
      }
    }

    embed.addFields({
      name: `#${idx + 1} — 🐓 ${c.name} (ID corto: \`${c.id.slice(0, 4)}\`)`,
      value: `💪 **Fuerza**: **${strength}%** [${progressBar}]\n📌 **Estado**: ${statusText}`,
      inline: false,
    });
  }

  return { embeds: [embed] };
}

/**
 * Train a chicken in the cage for 5, 15, 30 or 60 minutes.
 */
export async function handleChickenTrain(guildId: string, userId: string, chickenIdOrIndex: string, minutes = 15) {
  const chickens = await prisma.chicken.findMany({ where: { guildId, userId } });
  if (chickens.length === 0) return '❌ No tienes ningún gallo en tu gallinero. Compra uno primero.';

  let target = chickens.find(c => c.id.startsWith(chickenIdOrIndex));
  if (!target && !isNaN(parseInt(chickenIdOrIndex, 10))) {
    const idx = parseInt(chickenIdOrIndex, 10) - 1;
    target = chickens[idx];
  }
  if (!target) target = chickens[0];

  const now = new Date();

  // Check current training status or completed training
  if (target.isTraining && target.trainingEndsAt) {
    if (now >= target.trainingEndsAt) {
      const cage = await getOrCreateUserCage(guildId, userId);
      let multiplier = 1.0;
      if (cage.muscleLevel === 1) multiplier += 0.25;
      if (cage.muscleLevel === 2) multiplier += 0.50;
      if (cage.muscleLevel === 3) multiplier += 1.00;
      if (cage.hasProtein) multiplier += 0.50;

      const duration = target.trainingDuration || 15;
      const baseGain = duration === 5 ? 1.5 : duration === 15 ? 3.0 : duration === 30 ? 5.5 : 9.0;
      const winRateGain = parseFloat((baseGain * multiplier).toFixed(1));
      const newWinRate = Math.min(85.0, parseFloat((target.winRate + winRateGain).toFixed(1)));

      const isPhysioImmune = cage.physioLevel >= 2;

      await prisma.chicken.update({
        where: { id: target.id },
        data: {
          winRate: newWinRate,
          isTraining: false,
          trainingEndsAt: null,
          injuryImmune: isPhysioImmune ? true : target.injuryImmune,
        },
      });

      const newStrength = getVisualStrength(newWinRate);
      const strengthGain = Math.round((winRateGain / 85) * 100);
      return `🎉 **¡ENTRENAMIENTO FINALIZADO!** 🏋️‍♂️\nTu gallo **${target.name}** ha ganado **+${strengthGain}% de Fuerza** (Multiplicador de Gimnasio: x${multiplier.toFixed(2)}).\n💪 **Nueva Fuerza**: **${newStrength}%** (Máx 100%).${isPhysioImmune ? '\n🩺 **¡Inmunidad Fisioterapéutica!** Tu gallo ha ganado inmunidad a lesiones para su próxima victoria.' : ''}`;
    } else {
      const minsLeft = Math.ceil((target.trainingEndsAt.getTime() - now.getTime()) / 60000);
      return `🏋️‍♂️ **${target.name}** ya está entrenando en la jaula. Tiempo restante: **${minsLeft} minutos**.`;
    }
  }

  const cage = await getOrCreateUserCage(guildId, userId);
  const trainingChickens = chickens.filter(c => c.isTraining);
  const maxSlots = cage.capacityLevel || 1;

  if (trainingChickens.length >= maxSlots && !target.isTraining) {
    return `❌ **¡Gimnasio Ocupado!** Ya tienes **${trainingChickens.length}/${maxSlots} gallo(s)** entrenando al mismo tiempo. Mejora la Capacidad de tu gimnasio para entrenar a más gallos simultáneamente.`;
  }

  const validDuration = [5, 15, 30, 60].includes(minutes) ? minutes : 15;

  let timeMultiplier = 1.0;
  if (cage.cardioLevel === 1) timeMultiplier -= 0.15;
  if (cage.cardioLevel === 2) timeMultiplier -= 0.30;
  if (cage.cardioLevel === 3) timeMultiplier -= 0.50;
  if (cage.hasBooster) timeMultiplier -= 0.20;
  timeMultiplier = Math.max(0.2, timeMultiplier);

  const effectiveMinutes = Math.max(1, Math.round(validDuration * timeMultiplier));
  const trainingEndsAt = new Date(now.getTime() + effectiveMinutes * 60 * 1000);

  await prisma.chicken.update({
    where: { id: target.id },
    data: {
      isTraining: true,
      trainingEndsAt,
      trainingDuration: validDuration,
    },
  });

  return `🏋️‍♂️ **¡GALLO EN LA JAULA DE ENTRENO!** 🐓\n**${target.name}** ha comenzado un entrenamiento de **${validDuration} minutos**.\nRegresa al finalizar para reclamar su aumento de Fuerza.`;
}

/**
 * Cancel training for a chicken in the cage.
 */
export async function handleChickenCancelTrain(guildId: string, userId: string, chickenIdOrIndex?: string) {
  const chickens = await prisma.chicken.findMany({ where: { guildId, userId } });
  if (chickens.length === 0) return '❌ No tienes ningún gallo.';

  let target = chickens.find(c => c.isTraining);
  if (chickenIdOrIndex) {
    const specific = chickens.find(c => c.id.startsWith(chickenIdOrIndex));
    if (specific) target = specific;
  }

  if (!target || !target.isTraining) {
    return '❌ No tienes ningún gallo entrenando actualmente en la jaula.';
  }

  await prisma.chicken.update({
    where: { id: target.id },
    data: {
      isTraining: false,
      trainingEndsAt: null,
      trainingDuration: null,
    },
  });

  return `🛑 **ENTRENAMIENTO CANCELADO**: Has sacado a **${target.name}** de la jaula. Su entrenamiento ha sido cancelado sin ganar fuerza.`;
}

/**
 * Chicken Fight to Death (High Risk, Double Money Win or Definitive Death).
 */
export async function handleChickenFight(guildId: string, userId: string, chickenIdOrIndex: string, betStr: string) {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const eco = await getOrCreateUserEconomy(guildId, userId);

  // If no arguments passed, display comprehensive help Embed for Chicken Fight
  if (!chickenIdOrIndex && !betStr) {
    const embed = new EmbedBuilder()
      .setTitle('🐓 GUÍA DE PELEAS DE GALLOS — GalloRPG (!cf)')
      .setColor(0xE67E22)
      .setDescription(`Envía a tu gallo a una batalla de alto riesgo contra un rival. Si gana, **duplicas tu apuesta** 💰, pero si pierde sin protección... **¡muere definitivamente!** 🪦\n\n📜 **MODOS DE USO:**\n- \`!cf <apuesta>\` — Pelea con tu primer gallo disponible.\n- \`!cf <gallo_#1_#2_#3> <apuesta>\` — Pelea con un gallo específico.\n- \`!gallo pelear <apuesta>\` — Lo mismo usando comando de gallo.\n\n💡 **EJEMPLOS:**\n- \`!cf 50k\`\n- \`!cf 1 100k\`\n- \`!cf all\` (apuesta todo tu efectivo)\n\n🛡️ **OBJETOS DE PROTECCIÓN Y MEJORAS:**\n- 🩹 **Vendas de Espolón** (\`!buy Vendas\`): Protegen a tu gallo evitando que muera si pierde la pelea.\n- 💊 **Suplemento Vitamínico** (\`!buy Suplemento\`): Aumenta +15% su Fuerza para la siguiente batalla.\n- 🌾 **Pienso Proteico** (\`!buy Pienso\`): Bonus temporal de Fuerza durante 30 min.\n- 🏋️ **Gimnasio de Entreno** (\`!gallo\`): Entrena a tus gallos para subir su Fuerza permanente antes de combatir.`)
      .setFooter({ text: `Tu efectivo actual: ${eco.cash.toLocaleString()} ${sym}` });

    return { embeds: [embed] };
  }

  const chickens = await prisma.chicken.findMany({ where: { guildId, userId } });
  if (chickens.length === 0) return '❌ No tienes ningún gallo para pelear. Compra uno con `!gallo comprar`.';

  let target = chickens.find(c => c.id.startsWith(chickenIdOrIndex));
  if (!target && !isNaN(parseInt(chickenIdOrIndex, 10))) {
    const idx = parseInt(chickenIdOrIndex, 10) - 1;
    target = chickens[idx];
  }

  // If no target match, assume chickenIdOrIndex was the bet amount and pick first available non-training chicken
  let betInput = betStr;
  if (!target) {
    target = chickens.find(c => !c.isTraining) || chickens[0];
    betInput = chickenIdOrIndex;
  }

  if (target.isTraining && target.trainingEndsAt && new Date() < target.trainingEndsAt) {
    return `❌ **${target.name}** está en la jaula de entrenamiento y no puede pelear ahora.`;
  }

  const now = new Date();

  if (target.isInjured && target.injuredEndsAt) {
    if (now < target.injuredEndsAt) {
      const minsLeft = Math.ceil((target.injuredEndsAt.getTime() - now.getTime()) / 60000);
      return `❌ **${target.name}** está **lesionado (🤕)** y requiere **${minsLeft} minutos** de reposo (o usa un 🩹 **Botiquín** para curarlo al instante).`;
    } else {
      await prisma.chicken.update({
        where: { id: target.id },
        data: { isInjured: false, injuredEndsAt: null },
      });
      target.isInjured = false;
      target.injuredEndsAt = null;
    }
  }

  const bet = parseMoneyAmount(betInput, eco.cash);
  if (!bet || bet <= 0) {
    const embed = new EmbedBuilder()
      .setTitle('🐓 GUÍA DE PELEAS DE GALLOS — GalloRPG (!cf)')
      .setColor(0xE67E22)
      .setDescription(`Envía a tu gallo a una batalla de alto riesgo contra un rival. Si gana, **duplicas tu apuesta** 💰, pero si pierde sin protección... **¡muere definitivamente!** 🪦\n\n📜 **MODOS DE USO:**\n- \`!cf <apuesta>\` — Pelea con tu primer gallo disponible.\n- \`!cf <gallo_#1_#2_#3> <apuesta>\` — Pelea con un gallo específico.\n- \`!gallo pelear <apuesta>\` — Lo mismo usando comando de gallo.\n\n💡 **EJEMPLOS:**\n- \`!cf 50k\`\n- \`!cf 1 100k\`\n- \`!cf all\` (apuesta todo tu efectivo)`)
      .setFooter({ text: `Tu efectivo actual: ${eco.cash.toLocaleString()} ${sym}` });

    return { embeds: [embed] };
  }

  if (bet > eco.cash) {
    return `❌ No tienes suficiente dinero en efectivo (${fmtMoney(eco.cash, sym)}).`;
  }

  const hasPiensoBoost = target.piensoBoostEndsAt && now < target.piensoBoostEndsAt;
  const hasVitaminBoost = target.hasVitamin;

  const pensoBoostVal = config?.piensoBoostPercent ?? 10;
  const vitaminBoostVal = config?.vitaminBoostPercent ?? 15;

  let baseWinRate = target.winRate;
  if (hasPiensoBoost) baseWinRate += Math.round(pensoBoostVal * 0.85);
  if (hasVitaminBoost) baseWinRate += Math.round(vitaminBoostVal * 0.85);

  const effectiveWinRate = Math.min(85, baseWinRate);

  if (hasVitaminBoost) {
    await prisma.chicken.update({
      where: { id: target.id },
      data: { hasVitamin: false },
    });
  }

  // Fight simulation using real WinRate (30% - 85%)
  const roll = Math.random() * 100;
  const isVictory = roll <= effectiveWinRate;

  if (isVictory) {
    const winnings = bet * 2;
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${userId}` },
      data: { cash: { increment: bet } }, // +1x profit (total x2)
    });

    let injuryText = '';
    let isInjured = false;

    const cage = await getOrCreateUserCage(guildId, userId);

    if (target.injuryImmune) {
      await prisma.chicken.update({
        where: { id: target.id },
        data: { injuryImmune: false },
      });
      injuryText = `\n\n🛡️ **¡INMUNIDAD DE FISIOTERAPIA!** Tu gallo contaba con inmunidad de entrenamiento y no sufrió ninguna lesión.`;
    } else {
      let injuryChance = config?.chickenInjuryChance ?? 25;
      if (cage.physioLevel === 1) injuryChance = Math.round(injuryChance * 0.5);

      const isInjuredNow = Math.random() * 100 <= injuryChance;
      if (isInjuredNow) {
        isInjured = true;
        const restMins = config?.chickenInjuryMins ?? 5;
        const injuredEndsAt = new Date(now.getTime() + restMins * 60 * 1000);
        await prisma.chicken.update({
          where: { id: target.id },
          data: { isInjured: true, injuredEndsAt },
        });
        injuryText = `\n\n🤕 **¡ATENCIÓN!** Tu gallo ha quedado **lesionado** tras el combate. Debe descansar **${restMins} minutos** (o cúralo al instante con un 🩹 **Botiquín**).`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 ¡VICTORIA EN LA BATALLA! ⚔️')
      .setColor(0x2ECC71)
      .setDescription(`🐓 Tu gallo **${target.name}** (Fuerza: **${getVisualStrength(target.winRate)}%**) ha ganado la batalla!\n\n💰 **Recompensa x2**: **${fmtMoney(winnings, sym)}** (+${fmtMoney(bet, sym)} netos)\n✨ Tu gallo suma una victoria más a su historial.${injuryText}`)
      .setFooter({ text: `Tu nuevo efectivo: ${fmtMoney(eco.cash + bet, sym)}` });

    return { embeds: [embed], isVictory: true, isInjured, bet, chickenId: target.id };
  } else {
    // DEFEAT: Check Vendas de Espolón protection!
    await prisma.userEconomy.update({
      where: { id: `${guildId}-${userId}` },
      data: { cash: { decrement: bet } },
    });

    if (target.hasBandage) {
      await prisma.chicken.update({
        where: { id: target.id },
        data: { hasBandage: false },
      });

      const embed = new EmbedBuilder()
        .setTitle('🛡️ ¡PROTEGIDO POR VENDAS DE ESPOLÓN! 🥊')
        .setColor(0xE67E22)
        .setDescription(
          `Tu gallo **${target.name}** ha caído derrotado en la batalla, ¡pero sus **Vendas de Espolón** han evitado que abandone tu gallinero!\n\n` +
          `💸 **Entrada Perdida**: **${fmtMoney(bet, sym)}**\n` +
          `💨 Las vendas se han destruido, pero **${target.name}** permanece en tu equipo.`
        )
        .setFooter({ text: `Tu nuevo efectivo: ${fmtMoney(eco.cash - bet, sym)}` });

      return { embeds: [embed] };
    } else {
      await prisma.chicken.delete({ where: { id: target.id } });

      const embed = new EmbedBuilder()
        .setTitle('💥 DERROTA EN LA BATALLA')
        .setColor(0xE74C3C)
        .setDescription(`💥 Tu gallo **${target.name}** ha caído derrotado en la batalla.\n\n📊 **Estadística Revelada**: Tenía un **WinRate Real Oculto de ${target.winRate}%** (Fuerza: **${getVisualStrength(target.winRate)}%**).\n💸 **Entrada Perdida**: **${fmtMoney(bet, sym)}**\n💨 El gallo ha quedado exhausto y ha abandonado tu gallinero.`)
        .setFooter({ text: `Gallos restantes: ${chickens.length - 1}/3` });

      return { embeds: [embed] };
    }
  }
}

export async function getOrCreateUserCage(guildId: string, userId: string) {
  const id = `${guildId}-${userId}`;
  let cage = await prisma.userCage.findUnique({ where: { id } });
  if (!cage) {
    cage = await prisma.userCage.create({
      data: { id, guildId, userId, hasCage: false, cageLevel: 1, capacityLevel: 1, muscleLevel: 0, cardioLevel: 0, physioLevel: 0, hasProtein: false, hasBooster: false, piensoCount: 0, medkitCount: 0, bandageCount: 0, vitaminCount: 0 },
    });
  }
  return cage;
}

export async function buildGallineroHub(
  guildId: string,
  userId: string,
  view: 'HUB' | 'CHICKENS' | 'CAGE' | 'SHOP' | 'FIGHT' = 'HUB',
  selectedChickenId?: string,
  feedbackMsg?: string
) {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const sym = config?.currencySymbol || '💶';
  const eco = await getOrCreateUserEconomy(guildId, userId);
  const cage = await getOrCreateUserCage(guildId, userId);
  const chickens = await prisma.chicken.findMany({
    where: { guildId, userId },
    orderBy: { createdAt: 'asc' },
  });

  const now = new Date();

  // Auto-claim completed trainings & auto-cure expired injuries!
  for (const c of chickens) {
    if (c.isTraining && c.trainingEndsAt && now >= c.trainingEndsAt) {
      let multiplier = 1.0;
      if (cage.muscleLevel === 1) multiplier += 0.25;
      if (cage.muscleLevel === 2) multiplier += 0.50;
      if (cage.muscleLevel === 3) multiplier += 1.00;
      if (cage.hasProtein) multiplier += 0.50;

      const duration = c.trainingDuration || 15;
      const baseGain = duration === 5 ? 1.5 : duration === 15 ? 3.0 : duration === 30 ? 5.5 : 9.0;
      const winRateGain = parseFloat((baseGain * multiplier).toFixed(1));
      const newWinRate = Math.min(85.0, parseFloat((c.winRate + winRateGain).toFixed(1)));
      const strengthGain = Math.round((winRateGain / 85) * 100);
      const newStrength = getVisualStrength(newWinRate);

      const isPhysioImmune = cage.physioLevel >= 2;

      await prisma.chicken.update({
        where: { id: c.id },
        data: {
          winRate: newWinRate,
          isTraining: false,
          trainingEndsAt: null,
          trainingDuration: null,
          injuryImmune: isPhysioImmune ? true : c.injuryImmune,
        },
      });

      c.winRate = newWinRate;
      c.isTraining = false;
      c.trainingEndsAt = null;
      c.trainingDuration = null;

      const autoClaimMsg = `✨ **¡${c.name} ha finalizado su entrenamiento!** Ha ganado **+${strengthGain}% de Fuerza** automáticamente (Fuerza total: **${newStrength}%**).${isPhysioImmune ? ' 🩺 (Ganó Inmunidad a Lesiones)' : ''}`;
      feedbackMsg = feedbackMsg ? `${feedbackMsg}\n\n${autoClaimMsg}` : autoClaimMsg;
    }

    if (c.isInjured && c.injuredEndsAt && now >= c.injuredEndsAt) {
      await prisma.chicken.update({
        where: { id: c.id },
        data: { isInjured: false, injuredEndsAt: null },
      });
      c.isInjured = false;
      c.injuredEndsAt = null;

      const autoHealMsg = `✨ **¡${c.name} se ha recuperado de su lesión!** Ha cumplido su tiempo de reposo y está listo para combatir.`;
      feedbackMsg = feedbackMsg ? `${feedbackMsg}\n\n${autoHealMsg}` : autoHealMsg;
    }
  }

  // Navigation row
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`gallo_nav_HUB_${userId}`)
      .setLabel('🏠 Inicio')
      .setStyle(view === 'HUB' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`gallo_nav_CHICKENS_${userId}`)
      .setLabel(`🐓 Mis Gallos (${chickens.length}/3)`)
      .setStyle(view === 'CHICKENS' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`gallo_nav_CAGE_${userId}`)
      .setLabel(cage.hasCage ? `🏋️ Jaula (Lvl ${cage.cageLevel})` : '🔒 Jaula (Sin Jaula)')
      .setStyle(view === 'CAGE' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`gallo_nav_SHOP_${userId}`)
      .setLabel('🛒 Tienda')
      .setStyle(view === 'SHOP' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const components: any[] = [navRow];
  const embed = new EmbedBuilder();

  // ── VIEW 1: HUB (VISTA PRINCIPAL) ─────────────────────────────────────────
  if (view === 'HUB') {
    embed
      .setTitle('🐓 CENTRAL DEL GALLINERO DE COMBATE')
      .setColor(0xE67E22)
      .setDescription(
        (feedbackMsg ? `${feedbackMsg}\n\n` : '') +
        `👋 **¡Bienvenido a tu Central de Gallos!**\n` +
        `Usa los botones navegables de abajo para comprar gallos, alimentarlos con pienso, meterlos a la jaula de entrenamiento o llevarlos a batallas.\n\n` +
        `💰 **Efectivo Disponible**: ${fmtMoney(eco.cash, sym)}\n` +
        `🐓 **Gallos en Propiedad**: **${chickens.length}/3**\n` +
        `🏋️ **Jaula de Entreno**: ${cage.hasCage ? `✅ Nivel ${cage.cageLevel}` : '🔒 No Comprada'}\n` +
        `🌾 **Pienso Proteico en Mochila**: **${cage.piensoCount} unidades**`
      );

    if (chickens.length === 0) {
      embed.addFields({
        name: '🐔 Gallinero Vacío',
        value: `No tienes ningún gallo aún. ¡Ve a la **🛒 Tienda** para comprar tu primer gallo por **${fmtMoney(config?.chickenCost || 5000, sym)}**!`,
      });
    } else {
      for (let idx = 0; idx < chickens.length; idx++) {
        const c = chickens[idx];
        const strength = getVisualStrength(c.winRate);
        const progressBar = '█'.repeat(Math.round(strength / 10)) + '░'.repeat(10 - Math.round(strength / 10));

        let statusText = '🟢 Listo para pelear';
        if (c.isTraining && c.trainingEndsAt) {
          if (now < c.trainingEndsAt) {
            const minsLeft = Math.ceil((c.trainingEndsAt.getTime() - now.getTime()) / 60000);
            statusText = `🏋️‍♂️ En Jaula de Entreno (${minsLeft}m restantes)`;
          } else {
            statusText = '✨ Entreno Finalizado (¡Reclama tu aumento!)';
          }
        }

        let boostText = '';
        if (c.piensoBoostEndsAt && now < c.piensoBoostEndsAt) {
          const minsBoost = Math.ceil((c.piensoBoostEndsAt.getTime() - now.getTime()) / 60000);
          boostText = `\n🌾 **Pienso Proteico Activo**: +18% Fuerza por ${minsBoost}m más`;
        }

        embed.addFields({
          name: `#${idx + 1} — 🐓 ${c.name} (ID: \`${c.id.slice(0, 4)}\`)`,
          value: `💪 **Fuerza**: **${strength}%** [${progressBar}]${boostText}\n📌 **Estado**: ${statusText}`,
          inline: false,
        });
      }
    }
  }

  // ── VIEW 2: MIS GALLOS (INSPECCIÓN & ALIMENTACIÓN) ──────────────────────
  else if (view === 'CHICKENS') {
    embed
      .setTitle('🐓 INSPECCIÓN DE GALLOS Y MOCHILA')
      .setColor(0x3498DB)
      .setDescription(
        (feedbackMsg ? `${feedbackMsg}\n\n` : '') +
        `Aquí puedes administrar tu equipo de gallos, darles Pienso, curarlos con Botiquines o equiparles Vendas y Vitaminas.`
      );

    if (chickens.length === 0) {
      embed.addFields({
        name: '🐔 Sin Gallos',
        value: 'Aún no posees ningún gallo. Cómpralo desde la pestaña 🛒 Tienda.',
      });
    } else {
      const chickenOptions = chickens.map((c, i) => new StringSelectMenuOptionBuilder()
        .setLabel(`#${i + 1} ${c.name} (${getVisualStrength(c.winRate)}% Fuerza)`)
        .setValue(c.id)
        .setDescription(`Fuerza: ${getVisualStrength(c.winRate)}% ${c.isInjured ? '(🤕 Lesionado)' : c.isTraining ? '(En Jaula)' : '(Listo)'}`)
      );

      const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`gallo_select_chicken_${userId}`)
          .setPlaceholder('Selecciona un gallo para administrar...')
          .addOptions(chickenOptions)
      );

      components.push(selectMenu);

      const target = chickens.find(c => c.id === selectedChickenId) || chickens[0];
      const strength = getVisualStrength(target.winRate);
      const progressBar = '█'.repeat(Math.round(strength / 10)) + '░'.repeat(10 - Math.round(strength / 10));

      const hasBoost = target.piensoBoostEndsAt && now < target.piensoBoostEndsAt;
      const boostMins = hasBoost ? Math.ceil((target.piensoBoostEndsAt!.getTime() - now.getTime()) / 60000) : 0;

      const piensoBoostPercent = config?.piensoBoostPercent ?? 10;
      const vitaminBoostPercent = config?.vitaminBoostPercent ?? 15;

      let statusText = '🟢 Listo para combatir';
      if (target.isTraining) {
        statusText = '🏋️ En Jaula de Entreno';
      } else if (target.isInjured && target.injuredEndsAt && now < target.injuredEndsAt) {
        const minsLeft = Math.ceil((target.injuredEndsAt.getTime() - now.getTime()) / 60000);
        statusText = `🤕 Lesionado (${minsLeft}m de reposo restantes)`;
      }

      embed.addFields({
        name: `🐓 Gallo Seleccionado: ${target.name}`,
        value: `🆔 **ID Corto**: \`${target.id.slice(0, 4)}\`\n` +
          `💪 **Fuerza**: **${strength}%** [${progressBar}]\n` +
          `📌 **Estado**: ${statusText}\n` +
          `🌾 **Pienso Proteico**: ${hasBoost ? `✅ Activo (+${piensoBoostPercent}% Fuerza por ${boostMins}m más)` : '❌ Sin Pienso Activo'}\n` +
          `🛡️ **Vendas de Espolón**: ${target.hasBandage ? '✅ Equipadas (Protege 1 derrota)' : '❌ Sin Vendas'}\n` +
          `💊 **Suplemento Vitamínico**: ${target.hasVitamin ? `✅ Equipado (+${vitaminBoostPercent}% Fuerza 1 combate)` : '❌ Sin Vitamina'}`,
      });

      const actionRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`gallo_act_rename_${target.id}_${userId}`)
          .setLabel('✏️ Cambiar Nombre')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`gallo_act_feed_${target.id}_${userId}`)
          .setLabel(`🌾 Dar Pienso (${cage.piensoCount} disp.)`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(cage.piensoCount <= 0 || !!hasBoost)
      );

      if (target.isInjured) {
        if (cage.medkitCount > 0) {
          actionRow1.addComponents(
            new ButtonBuilder()
              .setCustomId(`gallo_use_medkit_${target.id}_${userId}`)
              .setLabel(`🩹 Curar Botiquín (${cage.medkitCount} disp.)`)
              .setStyle(ButtonStyle.Success)
          );
        } else {
          actionRow1.addComponents(
            new ButtonBuilder()
              .setCustomId(`gallo_buy_medkit_${userId}`)
              .setLabel(`🛒 Comprar Botiquín (${fmtMoney(2500, sym).replace(/\*/g, '')})`)
              .setStyle(ButtonStyle.Success)
          );
        }
      } else {
        actionRow1.addComponents(
          new ButtonBuilder()
            .setCustomId(`gallo_act_train_${target.id}_${userId}`)
            .setLabel('🏋️ Enviar a Jaula')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!cage.hasCage || target.isTraining),
          new ButtonBuilder()
            .setCustomId(`gallo_act_fight_${target.id}_${userId}`)
            .setLabel('⚔️ Llevar a Pelear')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(target.isTraining)
        );
      }

      components.push(actionRow1);

      const actionRow2 = new ActionRowBuilder<ButtonBuilder>();
      if (cage.bandageCount > 0 && !target.hasBandage) {
        actionRow2.addComponents(
          new ButtonBuilder()
            .setCustomId(`gallo_equip_bandage_${target.id}_${userId}`)
            .setLabel(`🥊 Equipar Vendas (${cage.bandageCount} disp.)`)
            .setStyle(ButtonStyle.Secondary)
        );
      }
      if (cage.vitaminCount > 0 && !target.hasVitamin) {
        actionRow2.addComponents(
          new ButtonBuilder()
            .setCustomId(`gallo_equip_vitamin_${target.id}_${userId}`)
            .setLabel(`💊 Dar Vitamina (${cage.vitaminCount} disp.)`)
            .setStyle(ButtonStyle.Secondary)
        );
      }
      if (actionRow2.components.length > 0) {
        components.push(actionRow2);
      }
    }
  }

  // ── VIEW 3: JAULA DE ENTRENAMIENTO & GIMNASIO ──────────────────────────────
  else if (view === 'CAGE') {
    const capLevel = cage.capacityLevel || 1;
    const musLevel = cage.muscleLevel || 0;
    const carLevel = cage.cardioLevel || 0;
    const phyLevel = cage.physioLevel || 0;

    const muscleText = musLevel === 0 ? 'Base (+0%)' : musLevel === 1 ? '🔥 Lvl 1 (+25% Fuerza)' : musLevel === 2 ? '🔥 Lvl 2 (+50% Fuerza)' : '🔥 Lvl 3 (+100% Fuerza)';
    const cardioText = carLevel === 0 ? 'Base (0%)' : carLevel === 1 ? '⚡ Lvl 1 (-15% Tiempo)' : carLevel === 2 ? '⚡ Lvl 2 (-30% Tiempo)' : '⚡ Lvl 3 (-50% Tiempo)';
    const physioText = phyLevel === 0 ? 'Sin Fisioterapia' : phyLevel === 1 ? '🩺 Lvl 1 (-50% Riesgo Lesión)' : '🩺 Lvl 2 (Inmunidad Post-Entreno)';

    const trainingChickens = chickens.filter(c => c.isTraining);

    embed
      .setTitle('🏋️ GIMNASIO DE GALLOS Y ÁRBOL DE INSTALACIONES')
      .setColor(0x9B59B6)
      .setDescription(
        (feedbackMsg ? `${feedbackMsg}\n\n` : '') +
        `El Gimnasio de Gallos te permite entrenar la fuerza de tus gallos y mejorar instalaciones especializadas.\n\n` +
        `📌 **Estado**: ${cage.hasCage ? `✅ Desbloqueado (${capLevel} Plaza${capLevel > 1 ? 's' : ''})` : '🔒 No Comprado'}\n` +
        `👥 **Capacidad**: **${trainingChickens.length} / ${capLevel} gallos en entreno simultáneo**\n` +
        `🥩 **Musculación**: **${muscleText}**\n` +
        `⚡ **Cardio**: **${cardioText}**\n` +
        `🩺 **Fisioterapia**: **${physioText}**`
      );

    if (!cage.hasCage) {
      embed.addFields({
        name: '🔒 Cómo desbloquear el Gimnasio?',
        value: `Puedes adquirir el **Gimnasio Base (1 Plaza)** por **${fmtMoney(config?.cageCost || 15000, sym)}** para empezar a entrenar tus gallos.`,
      });

      const cageRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`gallo_buy_cage_${userId}`)
          .setLabel(`🔓 Desbloquear Gimnasio (${fmtMoney(config?.cageCost || 15000, sym)})`)
          .setStyle(ButtonStyle.Success)
      );

      components.push(cageRow);
    } else {
      if (trainingChickens.length > 0) {
        for (const tc of trainingChickens) {
          if (tc.trainingEndsAt && now < tc.trainingEndsAt) {
            const minsLeft = Math.ceil((tc.trainingEndsAt.getTime() - now.getTime()) / 60000);
            embed.addFields({
              name: `⏳ ${tc.name} — Entrenando en Gimnasio`,
              value: `Tiempo restante: **${minsLeft} minutos**.`,
              inline: true,
            });
          }
        }
      }

      // Branch upgrade buttons Row 1 (Capacidad & Musculación)
      const upgradeRow1 = new ActionRowBuilder<ButtonBuilder>();
      if (capLevel < 3) {
        const nextCapCost = capLevel === 1 ? (config?.cageCapacityLvl2Cost ?? 40000) : (config?.cageCapacityLvl3Cost ?? 80000);
        upgradeRow1.addComponents(
          new ButtonBuilder()
            .setCustomId(`gallo_upgrade_capacity_${userId}`)
            .setLabel(`👥 Capacidad Lvl ${capLevel + 1} (${fmtMoney(nextCapCost, sym).replace(/\*/g, '')})`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(eco.cash < nextCapCost)
        );
      }
      if (musLevel < 3) {
        const nextMusCost = musLevel === 0 ? (config?.cageMuscleLvl1Cost ?? 15000) : musLevel === 1 ? (config?.cageMuscleLvl2Cost ?? 35000) : (config?.cageMuscleLvl3Cost ?? 70000);
        upgradeRow1.addComponents(
          new ButtonBuilder()
            .setCustomId(`gallo_upgrade_muscle_${userId}`)
            .setLabel(`🥩 Musculación Lvl ${musLevel + 1} (${fmtMoney(nextMusCost, sym).replace(/\*/g, '')})`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(eco.cash < nextMusCost)
        );
      }

      // Branch upgrade buttons Row 2 (Cardio & Fisioterapia)
      const upgradeRow2 = new ActionRowBuilder<ButtonBuilder>();
      if (carLevel < 3) {
        const nextCarCost = carLevel === 0 ? (config?.cageCardioLvl1Cost ?? 10000) : carLevel === 1 ? (config?.cageCardioLvl2Cost ?? 25000) : (config?.cageCardioLvl3Cost ?? 50000);
        upgradeRow2.addComponents(
          new ButtonBuilder()
            .setCustomId(`gallo_upgrade_cardio_${userId}`)
            .setLabel(`⚡ Cardio Lvl ${carLevel + 1} (${fmtMoney(nextCarCost, sym).replace(/\*/g, '')})`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(eco.cash < nextCarCost)
        );
      }
      if (phyLevel < 2) {
        const nextPhyCost = phyLevel === 0 ? (config?.cagePhysioLvl1Cost ?? 20000) : (config?.cagePhysioLvl2Cost ?? 45000);
        upgradeRow2.addComponents(
          new ButtonBuilder()
            .setCustomId(`gallo_upgrade_physio_${userId}`)
            .setLabel(`🩺 Fisioterapia Lvl ${phyLevel + 1} (${fmtMoney(nextPhyCost, sym).replace(/\*/g, '')})`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(eco.cash < nextPhyCost)
        );
      }

      if (upgradeRow1.components.length > 0) components.push(upgradeRow1);
      if (upgradeRow2.components.length > 0) components.push(upgradeRow2);

      const freeChickens = chickens.filter(c => !c.isTraining);
      if (freeChickens.length > 0 && trainingChickens.length < capLevel) {
        const chickenOptions = freeChickens.map((c, i) => new StringSelectMenuOptionBuilder()
          .setLabel(`#${i + 1} ${c.name} (${getVisualStrength(c.winRate)}% Fuerza)`)
          .setValue(c.id)
          .setDescription(`Fuerza: ${getVisualStrength(c.winRate)}%`)
        );

        const selectCageMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`gallo_select_cage_${userId}`)
            .setPlaceholder('Elige qué gallo poner a entrenar en la jaula...')
            .addOptions(chickenOptions)
        );

        components.push(selectCageMenu);

        const targetChicken = freeChickens.find(c => c.id === selectedChickenId) || freeChickens[0];

        embed.addFields({
          name: `🐓 Gallo para Entrenar: ${targetChicken.name}`,
          value: `💪 **Fuerza Actual**: **${getVisualStrength(targetChicken.winRate)}%**\n*Elige la duración de la rutina de entrenamiento para **${targetChicken.name}**:*`,
        });

        let timeMul = 1.0;
        if (carLevel === 1) timeMul -= 0.15;
        if (carLevel === 2) timeMul -= 0.30;
        if (carLevel === 3) timeMul -= 0.50;

        const m15 = Math.max(1, Math.round(15 * timeMul));
        const m30 = Math.max(1, Math.round(30 * timeMul));
        const m60 = Math.max(1, Math.round(60 * timeMul));

        const trainSelectRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`gallo_start_train_15_${targetChicken.id}_${userId}`)
            .setLabel(`🏃 Light (${m15}m)`)
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`gallo_start_train_30_${targetChicken.id}_${userId}`)
            .setLabel(`🥊 Sombra (${m30}m)`)
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`gallo_start_train_60_${targetChicken.id}_${userId}`)
            .setLabel(`🏋️ Potencia (${m60}m)`)
            .setStyle(ButtonStyle.Success)
        );
        components.push(trainSelectRow);
      }
    }
  }

  // ── VIEW 4: TIENDA DE GALLEROS ───────────────────────────────────────────
  else if (view === 'SHOP') {
    const chickenCost = config?.chickenCost ?? 5000;
    const piensoCost = config?.piensoCost ?? 3000;
    const piensoDuration = config?.piensoDurationMins ?? 30;
    const piensoBoost = config?.piensoBoostPercent ?? 10;
    const medkitCost = config?.medkitCost ?? 2500;
    const bandageCost = config?.bandageCost ?? 5000;
    const vitaminCost = config?.vitaminCost ?? 2500;
    const vitaminBoost = config?.vitaminBoostPercent ?? 15;

    embed
      .setTitle('🛒 TIENDA DE GALLEROS Y EQUIPAMIENTO DE COMBATE')
      .setColor(0xF1C40F)
      .setDescription(
        (feedbackMsg ? `${feedbackMsg}\n\n` : '') +
        `Aquí puedes adquirir nuevos gallos y objetos de combate para potenciar a tu equipo.\n\n` +
        `💰 **Tu Dinero**: ${fmtMoney(eco.cash, sym)}\n\n` +
        `🐓 **1. Nuevo Gallo de Pelea**: **${fmtMoney(chickenCost, sym)}** (Fuerza inicial 35-65%)\n` +
        `🌾 **2. Pienso Proteico**: **${fmtMoney(piensoCost, sym)}** (+${piensoBoost}% Fuerza durante ${piensoDuration}m)\n` +
        `🩹 **3. Botiquín de Curación**: **${fmtMoney(medkitCost, sym)}** (Cura la lesión al instante)\n` +
        `🥊 **4. Vendas de Espolón**: **${fmtMoney(bandageCost, sym)}** (1 Uso: Protege al gallo si pierde)\n` +
        `💊 **5. Suplemento Vitamínico**: **${fmtMoney(vitaminCost, sym)}** (1 Uso: +${vitaminBoost}% Fuerza en 1 combate)`
      );

    const shopRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`gallo_buy_chicken_${userId}`)
        .setLabel(`🐓 Gallo (${fmtMoney(chickenCost, sym).replace(/\*/g, '')})`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(chickens.length >= 3 || eco.cash < chickenCost),
      new ButtonBuilder()
        .setCustomId(`gallo_buy_pienso_${userId}`)
        .setLabel(`🌾 Pienso (${fmtMoney(piensoCost, sym).replace(/\*/g, '')})`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(eco.cash < piensoCost),
      new ButtonBuilder()
        .setCustomId(`gallo_buy_medkit_${userId}`)
        .setLabel(`🩹 Botiquín (${fmtMoney(medkitCost, sym).replace(/\*/g, '')})`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(eco.cash < medkitCost)
    );

    const shopRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`gallo_buy_bandage_${userId}`)
        .setLabel(`🥊 Vendas (${fmtMoney(bandageCost, sym).replace(/\*/g, '')})`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(eco.cash < bandageCost),
      new ButtonBuilder()
        .setCustomId(`gallo_buy_vitamin_${userId}`)
        .setLabel(`💊 Vitamina (${fmtMoney(vitaminCost, sym).replace(/\*/g, '')})`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(eco.cash < vitaminCost)
    );

    components.push(shopRow1, shopRow2);
  }

  // ── VIEW 5: BATALLAS DE GALLOS ───────────────────────────────────────────
  else if (view === 'FIGHT') {
    embed
      .setTitle('⚔️ BATALLAS DE GALLOS')
      .setColor(0xE74C3C)
      .setDescription(
        (feedbackMsg ? `${feedbackMsg}\n\n` : '') +
        `🎮 **ESTADIO DE BATALLAS DE GALLOS**\n` +
        `Entra al estadio y pon a prueba la fuerza de tu gallo. Si tu gallo gana la batalla, **duplicas tu entrada**. Si pierde, **abandona tu gallinero**.\n\n` +
        `💰 **Tu Saldo**: ${fmtMoney(eco.cash, sym)}`
      );

    const readyChickens = chickens.filter(c => !c.isTraining);

    if (readyChickens.length === 0) {
      embed.addFields({
        name: '❌ Sin Gallos Disponibles',
        value: 'Todos tus gallos están entrenando o no tienes ninguno. Compra uno en la Tienda o espera a que terminen su entrenamiento.',
      });
    } else {
      const selected = readyChickens.find(c => c.id === selectedChickenId) || readyChickens[0];
      const strength = getVisualStrength(selected.winRate);

      const hasBoost = selected.piensoBoostEndsAt && now < selected.piensoBoostEndsAt;
      const effectiveWinRate = hasBoost ? Math.min(85, selected.winRate + 15) : selected.winRate;
      const effectiveStrength = getVisualStrength(effectiveWinRate);

      embed.addFields({
        name: `🐓 Gallo Seleccionado: ${selected.name}`,
        value: `💪 **Fuerza de Combate**: **${effectiveStrength}%** ${hasBoost ? '(🌾 +18% Boost Pienso Activo)' : ''}\n\n*Selecciona una cantidad de entrada:*`,
      });

      const fightBetRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`gallo_do_fight_${selected.id}_10000_${userId}`)
          .setLabel('💰 Entrada 10k')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(eco.cash < 10000),
        new ButtonBuilder()
          .setCustomId(`gallo_do_fight_${selected.id}_50000_${userId}`)
          .setLabel('💰 Entrada 50k')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(eco.cash < 50000),
        new ButtonBuilder()
          .setCustomId(`gallo_do_fight_${selected.id}_100000_${userId}`)
          .setLabel('💰 Entrada 100k')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(eco.cash < 100000),
        new ButtonBuilder()
          .setCustomId(`gallo_do_fight_${selected.id}_all_${userId}`)
          .setLabel('🔥 ENTRADA TOTAL')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(eco.cash <= 0)
      );

      components.push(fightBetRow);
    }
  }

  embed.setFooter({ text: 'GalloRPG — Sistema de Crianza y Combate Interactiva' });

  return { embeds: [embed], components };
}

export async function handleGalloInteraction(interaction: any) {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
  const customId: string = interaction.customId || '';
  if (!customId.startsWith('gallo_')) return;

  const parts = customId.split('_');
  const actionType = parts[1]; // "nav" | "select" | "act" | "buy" | "claim" | "start" | "upgrade" | "do" | "submit"

  const targetUserId = parts[parts.length - 1];
  if (interaction.user.id !== targetUserId) {
    return interaction.reply({ content: '❌ Solo el propietario de este gallinero puede usar estos controles.', ephemeral: true });
  }

  const guildId = interaction.guildId;
  if (!guildId) return;

  // Handle rename modal trigger BEFORE deferUpdate
  if (actionType === 'act' && parts[2] === 'rename') {
    const chickenId = parts[3];
    const chicken = await prisma.chicken.findUnique({ where: { id: chickenId } });
    if (!chicken) return interaction.reply({ content: '❌ Gallo no encontrado.', ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId(`gallo_submit_rename_${chickenId}_${targetUserId}`)
      .setTitle('✏️ Cambiar Nombre del Gallo');

    const nameInput = new TextInputBuilder()
      .setCustomId('gallo_new_name')
      .setLabel('Nuevo Nombre para tu Gallo')
      .setValue(chicken.name)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(32)
      .setRequired(true);

    const modalRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    modal.addComponents(modalRow);

    return interaction.showModal(modal);
  }

  // Handle rename modal submit
  if (interaction.isModalSubmit() && actionType === 'submit' && parts[2] === 'rename') {
    await interaction.deferUpdate().catch(() => null);
    const chickenId = parts[3];
    const newName = interaction.fields.getTextInputValue('gallo_new_name').trim();
    if (!newName) {
      const hub = await buildGallineroHub(guildId, targetUserId, 'CHICKENS', chickenId, '❌ El nombre no puede estar vacío.');
      return interaction.editReply(hub);
    }

    await prisma.chicken.update({
      where: { id: chickenId },
      data: { name: newName },
    });

    const hub = await buildGallineroHub(guildId, targetUserId, 'CHICKENS', chickenId, `✏️ **¡Nombre actualizado!** Tu gallo ahora se llama **${newName}**.`);
    return interaction.editReply(hub);
  }

  await interaction.deferUpdate().catch(() => null);

  if (actionType === 'nav') {
    const targetView = parts[2] as 'HUB' | 'CHICKENS' | 'CAGE' | 'SHOP' | 'FIGHT';
    const hub = await buildGallineroHub(guildId, targetUserId, targetView);
    return interaction.editReply(hub);
  }

  if (actionType === 'select') {
    const subSelect = parts[2];
    const selectedChickenId = interaction.values[0];
    const targetView = subSelect === 'cage' ? 'CAGE' : 'CHICKENS';
    const hub = await buildGallineroHub(guildId, targetUserId, targetView, selectedChickenId);
    return interaction.editReply(hub);
  }

  if (actionType === 'act') {
    const subAct = parts[2];
    const chickenId = parts[3];

    if (subAct === 'feed') {
      const cage = await getOrCreateUserCage(guildId, targetUserId);
      if (cage.piensoCount > 0) {
        await prisma.userCage.update({
          where: { id: `${guildId}-${targetUserId}` },
          data: { piensoCount: { decrement: 1 } },
        });

        const config = await prisma.guildConfig.findUnique({ where: { guildId } });
        const piensoDuration = config?.piensoDurationMins ?? 30;
        const piensoBoost = config?.piensoBoostPercent ?? 10;

        const endsAt = new Date(Date.now() + piensoDuration * 60 * 1000);
        await prisma.chicken.update({
          where: { id: chickenId },
          data: { piensoBoostEndsAt: endsAt },
        });

        const hub = await buildGallineroHub(guildId, targetUserId, 'CHICKENS', chickenId, `🌾 **¡Pienso Proteico aplicado!** Tu gallo gana +${piensoBoost}% de Fuerza durante ${piensoDuration} minutos.`);
        return interaction.editReply(hub);
      }
    }

    if (subAct === 'train') {
      const res = await handleChickenTrain(guildId, targetUserId, chickenId, 15);
      const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', chickenId, typeof res === 'string' ? res : '');
      return interaction.editReply(hub);
    }

    if (subAct === 'fight') {
      const hub = await buildGallineroHub(guildId, targetUserId, 'FIGHT', chickenId);
      return interaction.editReply(hub);
    }
  }

  if (actionType === 'buy') {
    const itemType = parts[2];

    if (itemType === 'chicken') {
      const res = await handleChickenBuy(guildId, targetUserId);
      const hub = await buildGallineroHub(guildId, targetUserId, 'HUB', undefined, typeof res === 'string' ? res : '');
      return interaction.editReply(hub);
    }

    if (itemType === 'cage') {
      const config = await prisma.guildConfig.findUnique({ where: { guildId } });
      const cost = config?.cageCost || 15000;
      const eco = await getOrCreateUserEconomy(guildId, targetUserId);

      if (eco.cash < cost) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'SHOP', undefined, `❌ No tienes suficiente dinero para comprar la jaula (${cost} 💶).`);
        return interaction.editReply(hub);
      }

      await prisma.userEconomy.update({
        where: { id: `${guildId}-${targetUserId}` },
        data: { cash: { decrement: cost } },
      });

      await prisma.userCage.upsert({
        where: { id: `${guildId}-${targetUserId}` },
        update: { hasCage: true, cageLevel: 1 },
        create: { id: `${guildId}-${targetUserId}`, guildId, userId: targetUserId, hasCage: true, cageLevel: 1 },
      });

      const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, '🎉 **¡JAULA DE ENTRENO COMPRADA!** Ahora puedes entrenar a tus gallos.');
      return interaction.editReply(hub);
    }

    if (itemType === 'pienso') {
      const config = await prisma.guildConfig.findUnique({ where: { guildId } });
      const cost = config?.piensoCost ?? 3000;
      const sym = config?.currencySymbol || '💶';
      const eco = await getOrCreateUserEconomy(guildId, targetUserId);

      if (eco.cash < cost) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'SHOP', undefined, `❌ No tienes ${fmtMoney(cost, sym)} para comprar Pienso Proteico.`);
        return interaction.editReply(hub);
      }

      await prisma.userEconomy.update({
        where: { id: `${guildId}-${targetUserId}` },
        data: { cash: { decrement: cost } },
      });

      await prisma.userCage.upsert({
        where: { id: `${guildId}-${targetUserId}` },
        update: { piensoCount: { increment: 1 } },
        create: { id: `${guildId}-${targetUserId}`, guildId, userId: targetUserId, piensoCount: 1 },
      });

      const hub = await buildGallineroHub(guildId, targetUserId, 'SHOP', undefined, '🌾 **¡Pienso Proteico Comprado!** Se ha añadido a tu mochila.');
      return interaction.editReply(hub);
    }

    if (itemType === 'medkit') {
      const config = await prisma.guildConfig.findUnique({ where: { guildId } });
      const cost = config?.medkitCost ?? 2500;
      const sym = config?.currencySymbol || '💶';
      const eco = await getOrCreateUserEconomy(guildId, targetUserId);

      if (eco.cash < cost) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'SHOP', undefined, `❌ No tienes ${fmtMoney(cost, sym)} para comprar un Botiquín de Curación.`);
        return interaction.editReply(hub);
      }

      await prisma.userEconomy.update({
        where: { id: `${guildId}-${targetUserId}` },
        data: { cash: { decrement: cost } },
      });

      await prisma.userCage.upsert({
        where: { id: `${guildId}-${targetUserId}` },
        update: { medkitCount: { increment: 1 } },
        create: { id: `${guildId}-${targetUserId}`, guildId, userId: targetUserId, medkitCount: 1 },
      });

      const hub = await buildGallineroHub(guildId, targetUserId, 'SHOP', undefined, '🩹 **¡Botiquín de Curación Comprado!** Se ha añadido a tu mochila.');
      return interaction.editReply(hub);
    }

    if (itemType === 'bandage') {
      const config = await prisma.guildConfig.findUnique({ where: { guildId } });
      const cost = config?.bandageCost ?? 5000;
      const sym = config?.currencySymbol || '💶';
      const eco = await getOrCreateUserEconomy(guildId, targetUserId);

      if (eco.cash < cost) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'SHOP', undefined, `❌ No tienes ${fmtMoney(cost, sym)} para comprar Vendas de Espolón.`);
        return interaction.editReply(hub);
      }

      await prisma.userEconomy.update({
        where: { id: `${guildId}-${targetUserId}` },
        data: { cash: { decrement: cost } },
      });

      await prisma.userCage.upsert({
        where: { id: `${guildId}-${targetUserId}` },
        update: { bandageCount: { increment: 1 } },
        create: { id: `${guildId}-${targetUserId}`, guildId, userId: targetUserId, bandageCount: 1 },
      });

      const hub = await buildGallineroHub(guildId, targetUserId, 'SHOP', undefined, '🥊 **¡Vendas de Espolón Compradas!** Equípalas en "Mis Gallos".');
      return interaction.editReply(hub);
    }

    if (itemType === 'vitamin') {
      const config = await prisma.guildConfig.findUnique({ where: { guildId } });
      const cost = config?.vitaminCost ?? 2500;
      const sym = config?.currencySymbol || '💶';
      const eco = await getOrCreateUserEconomy(guildId, targetUserId);

      if (eco.cash < cost) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'SHOP', undefined, `❌ No tienes ${fmtMoney(cost, sym)} para comprar un Suplemento Vitamínico.`);
        return interaction.editReply(hub);
      }

      await prisma.userEconomy.update({
        where: { id: `${guildId}-${targetUserId}` },
        data: { cash: { decrement: cost } },
      });

      await prisma.userCage.upsert({
        where: { id: `${guildId}-${targetUserId}` },
        update: { vitaminCount: { increment: 1 } },
        create: { id: `${guildId}-${targetUserId}`, guildId, userId: targetUserId, vitaminCount: 1 },
      });

      const hub = await buildGallineroHub(guildId, targetUserId, 'SHOP', undefined, '💊 **¡Suplemento Vitamínico Comprado!** Dáselo a tu gallo en "Mis Gallos".');
      return interaction.editReply(hub);
    }
  }

  if (actionType === 'upgrade') {
    const branch = parts[2]; // "capacity" | "muscle" | "cardio" | "physio"
    const cage = await getOrCreateUserCage(guildId, targetUserId);
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    const sym = config?.currencySymbol || '💶';
    const eco = await getOrCreateUserEconomy(guildId, targetUserId);

    if (branch === 'capacity') {
      const curLvl = cage.capacityLevel || 1;
      if (curLvl >= 3) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, '❌ Ya has alcanzado la capacidad máxima (3 plazas).');
        return interaction.editReply(hub);
      }
      const cost = curLvl === 1 ? (config?.cageCapacityLvl2Cost ?? 40000) : (config?.cageCapacityLvl3Cost ?? 80000);
      if (eco.cash < cost) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, `❌ No tienes ${fmtMoney(cost, sym)} para mejorar la Capacidad.`);
        return interaction.editReply(hub);
      }
      await prisma.userEconomy.update({ where: { id: `${guildId}-${targetUserId}` }, data: { cash: { decrement: cost } } });
      await prisma.userCage.update({ where: { id: `${guildId}-${targetUserId}` }, data: { capacityLevel: curLvl + 1 } });
      const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, `🎉 **¡Capacidad Ampliada a Nivel ${curLvl + 1}!** Puedes entrenar **${curLvl + 1} gallos a la vez**.`);
      return interaction.editReply(hub);
    }

    if (branch === 'muscle') {
      const curLvl = cage.muscleLevel || 0;
      if (curLvl >= 3) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, '❌ Musculación ya está al nivel máximo (Nivel 3).');
        return interaction.editReply(hub);
      }
      const cost = curLvl === 0 ? (config?.cageMuscleLvl1Cost ?? 15000) : curLvl === 1 ? (config?.cageMuscleLvl2Cost ?? 35000) : (config?.cageMuscleLvl3Cost ?? 70000);
      if (eco.cash < cost) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, `❌ No tienes ${fmtMoney(cost, sym)} para mejorar la Musculación.`);
        return interaction.editReply(hub);
      }
      await prisma.userEconomy.update({ where: { id: `${guildId}-${targetUserId}` }, data: { cash: { decrement: cost } } });
      await prisma.userCage.update({ where: { id: `${guildId}-${targetUserId}` }, data: { muscleLevel: curLvl + 1 } });
      const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, `🥩 **¡Musculación Mejorada a Nivel ${curLvl + 1}!** Tus entrenamientos ganan más fuerza.`);
      return interaction.editReply(hub);
    }

    if (branch === 'cardio') {
      const curLvl = cage.cardioLevel || 0;
      if (curLvl >= 3) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, '❌ Cardio ya está al nivel máximo (Nivel 3).');
        return interaction.editReply(hub);
      }
      const cost = curLvl === 0 ? (config?.cageCardioLvl1Cost ?? 10000) : curLvl === 1 ? (config?.cageCardioLvl2Cost ?? 25000) : (config?.cageCardioLvl3Cost ?? 50000);
      if (eco.cash < cost) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, `❌ No tienes ${fmtMoney(cost, sym)} para mejorar Cardio.`);
        return interaction.editReply(hub);
      }
      await prisma.userEconomy.update({ where: { id: `${guildId}-${targetUserId}` }, data: { cash: { decrement: cost } } });
      await prisma.userCage.update({ where: { id: `${guildId}-${targetUserId}` }, data: { cardioLevel: curLvl + 1 } });
      const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, `⚡ **¡Cardio Mejorado a Nivel ${curLvl + 1}!** Tus entrenamientos duran menos tiempo.`);
      return interaction.editReply(hub);
    }

    if (branch === 'physio') {
      const curLvl = cage.physioLevel || 0;
      if (curLvl >= 2) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, '❌ Fisioterapia ya está al nivel máximo (Nivel 2).');
        return interaction.editReply(hub);
      }
      const cost = curLvl === 0 ? (config?.cagePhysioLvl1Cost ?? 20000) : (config?.cagePhysioLvl2Cost ?? 45000);
      if (eco.cash < cost) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, `❌ No tienes ${fmtMoney(cost, sym)} para mejorar Fisioterapia.`);
        return interaction.editReply(hub);
      }
      await prisma.userEconomy.update({ where: { id: `${guildId}-${targetUserId}` }, data: { cash: { decrement: cost } } });
      await prisma.userCage.update({ where: { id: `${guildId}-${targetUserId}` }, data: { physioLevel: curLvl + 1 } });
      const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, `🩺 **¡Fisioterapia Mejorada a Nivel ${curLvl + 1}!** Tus gallos reducen riesgo de lesión.`);
      return interaction.editReply(hub);
    }
  }

  if (actionType === 'claim') {
    const chickenId = parts[2];
    const res = await handleChickenTrain(guildId, targetUserId, chickenId);
    const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', chickenId, typeof res === 'string' ? res : '');
    return interaction.editReply(hub);
  }

  if (actionType === 'cancel') {
    const chickenId = parts[2];
    const res = await handleChickenCancelTrain(guildId, targetUserId, chickenId);
    const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', chickenId, res);
    return interaction.editReply(hub);
  }

  if (actionType === 'start') {
    const mins = parseInt(parts[3], 10) || 15;
    const targetChickenId = parts[4];
    const chickens = await prisma.chicken.findMany({ where: { guildId, userId: targetUserId } });

    const trainingChicken = chickens.find(c => c.isTraining);
    if (trainingChicken) {
      const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, `❌ **¡Jaula Ocupada!** Tu gallo **${trainingChicken.name}** ya está entrenando. Solo puedes entrenar 1 gallo a la vez.`);
      return interaction.editReply(hub);
    }

    let targetChicken = chickens.find(c => c.id === targetChickenId && !c.isTraining);
    if (!targetChicken) targetChicken = chickens.find(c => !c.isTraining);

    if (!targetChicken) {
      const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', undefined, '❌ No tienes ningún gallo libre para entrenar.');
      return interaction.editReply(hub);
    }

    const res = await handleChickenTrain(guildId, targetUserId, targetChicken.id, mins);
    const hub = await buildGallineroHub(guildId, targetUserId, 'CAGE', targetChicken.id, typeof res === 'string' ? res : '');
    return interaction.editReply(hub);
  }

  if (actionType === 'use') {
    const item = parts[2]; // "medkit"
    const chickenId = parts[3];

    if (item === 'medkit') {
      const cage = await getOrCreateUserCage(guildId, targetUserId);
      const eco = await getOrCreateUserEconomy(guildId, targetUserId);
      const config = await prisma.guildConfig.findUnique({ where: { guildId } });
      const medCost = config?.medkitCost ?? 2500;

      if (cage.medkitCount > 0) {
        await prisma.userCage.update({
          where: { id: `${guildId}-${targetUserId}` },
          data: { medkitCount: { decrement: 1 } },
        });
      } else if (eco.cash >= medCost) {
        await prisma.userEconomy.update({
          where: { id: `${guildId}-${targetUserId}` },
          data: { cash: { decrement: medCost } },
        });
      } else {
        const hub = await buildGallineroHub(guildId, targetUserId, 'CHICKENS', chickenId, `❌ No tienes Botiquines ni dinero suficiente (${medCost} 💶).`);
        return interaction.editReply(hub);
      }

      await prisma.chicken.update({
        where: { id: chickenId },
        data: { isInjured: false, injuredEndsAt: null },
      });

      const hub = await buildGallineroHub(guildId, targetUserId, 'CHICKENS', chickenId, '🩹 **¡Gallo Curado!** Tu gallo se ha curado por completo de su lesión y está listo para combatir.');
      return interaction.editReply(hub);
    }
  }

  if (actionType === 'equip') {
    const item = parts[2]; // "bandage" | "vitamin"
    const chickenId = parts[3];
    const cage = await getOrCreateUserCage(guildId, targetUserId);

    if (item === 'bandage') {
      if (cage.bandageCount <= 0) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'CHICKENS', chickenId, '❌ No tienes Vendas de Espolón en tu mochila.');
        return interaction.editReply(hub);
      }

      await prisma.userCage.update({
        where: { id: `${guildId}-${targetUserId}` },
        data: { bandageCount: { decrement: 1 } },
      });

      await prisma.chicken.update({
        where: { id: chickenId },
        data: { hasBandage: true },
      });

      const hub = await buildGallineroHub(guildId, targetUserId, 'CHICKENS', chickenId, '🥊 **¡Vendas de Espolón Equipadas!** Tu gallo estará protegido en su próxima batalla.');
      return interaction.editReply(hub);
    }

    if (item === 'vitamin') {
      if (cage.vitaminCount <= 0) {
        const hub = await buildGallineroHub(guildId, targetUserId, 'CHICKENS', chickenId, '❌ No tienes Suplementos Vitamínicos en tu mochila.');
        return interaction.editReply(hub);
      }

      await prisma.userCage.update({
        where: { id: `${guildId}-${targetUserId}` },
        data: { vitaminCount: { decrement: 1 } },
      });

      await prisma.chicken.update({
        where: { id: chickenId },
        data: { hasVitamin: true },
      });

      const hub = await buildGallineroHub(guildId, targetUserId, 'CHICKENS', chickenId, '💊 **¡Vitamina Aplicada!** Tu gallo ganará +18% Fuerza extra en su próxima batalla.');
      return interaction.editReply(hub);
    }
  }

  if (actionType === 'do') {
    const subDo = parts[2]; // "fight"
    const chickenId = parts[3];
    const betAmountStr = parts[4];
    const res = await handleChickenFight(guildId, targetUserId, chickenId, betAmountStr);

    if (typeof res === 'string') {
      const hub = await buildGallineroHub(guildId, targetUserId, 'FIGHT', chickenId, res);
      return interaction.editReply(hub);
    }

    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    const sym = config?.currencySymbol || '💶';

    const resultRow = new ActionRowBuilder<ButtonBuilder>();

    if (res.isVictory && !res.isInjured) {
      resultRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`gallo_do_fight_${res.chickenId}_${res.bet}_${targetUserId}`)
          .setLabel(`🔁 Repetir Entrada (${fmtMoney(res.bet, sym).replace(/\*/g, '')})`)
          .setStyle(ButtonStyle.Success)
      );
    } else if (res.isVictory && res.isInjured) {
      const userCage = await getOrCreateUserCage(guildId, targetUserId);
      if (userCage.medkitCount > 0) {
        resultRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`gallo_use_medkit_${res.chickenId}_${targetUserId}`)
            .setLabel(`🩹 Curar Botiquín (${userCage.medkitCount} disp.)`)
            .setStyle(ButtonStyle.Success)
        );
      } else {
        resultRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`gallo_buy_medkit_${targetUserId}`)
            .setLabel(`🛒 Comprar Botiquín (${fmtMoney(2500, sym).replace(/\*/g, '')})`)
            .setStyle(ButtonStyle.Success)
        );
      }
    }

    resultRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`gallo_nav_FIGHT_${targetUserId}`)
        .setLabel('⚔️ Volver a Batallas')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`gallo_nav_HUB_${targetUserId}`)
        .setLabel('🏠 Inicio')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({ embeds: res.embeds, components: [resultRow] });
  }
}
