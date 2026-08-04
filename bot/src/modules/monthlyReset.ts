import { Client, EmbedBuilder } from 'discord.js';
import { prisma } from 'shared';

/**
 * Runs on the 1st of every month to process monthly top roles and clan immunity checks.
 * STAFF ALWAYS HAS THE FINAL SAY: No clans are ever auto-deleted by the bot.
 */
let lastProcessedMonth = '';

/**
 * Starts a background hourly checker so that when day 1 midnight arrives,
 * the monthly tasks trigger automatically without restarting the bot.
 */
export function startMonthlyScheduler(client: Client) {
  console.log('⏰ Programador de tareas mensuales iniciado (Verificación automática activa).');

  // Check every hour
  setInterval(async () => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Execute on day 1 if not already processed for this month
    if (now.getDate() === 1 && lastProcessedMonth !== currentMonthStr) {
      lastProcessedMonth = currentMonthStr;
      console.log(`🎉 ¡Es 1 de mes (${currentMonthStr})! Ejecutando tareas mensuales automáticamente...`);
      await processMonthlyServerTasks(client, true).catch(() => null);
    }
  }, 60 * 60 * 1000); // Every 1 hour
}

export async function processMonthlyServerTasks(client: Client, force = false) {
  const today = new Date();
  if (!force && today.getDate() !== 1) {
    console.log(`ℹ️ Hoy es día ${today.getDate()} del mes. La revisión mensual se ejecutará únicamente el día 1 de mes.`);
    return;
  }

  console.log('🔄 Ejecutando revisión mensual de servidores...');

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const config = await prisma.guildConfig.findUnique({ where: { guildId } });
      if (!config) continue;

      // ── 1. PROCESAR ROLES MENSUALES: CHARLETERO (TEXTO) Y CHARLATÁN (VOZ) ────
      if (config.charleteroRoleId || config.charlatanRoleId) {
        await guild.members.fetch().catch(() => null);

        // A. Top Mensajes del Mes Cerrado (Charletero del Mes - Texto)
        if (config.charleteroRoleId) {
          const topMsgUser = await prisma.userXP.findFirst({
            where: { guildId, monthlyMessageCount: { gt: 0 } },
            orderBy: { monthlyMessageCount: 'desc' },
          });

          const role = guild.roles.cache.get(config.charleteroRoleId);
          if (role && topMsgUser) {
            for (const [_, member] of role.members) {
              if (member.id !== topMsgUser.userId) {
                await member.roles.remove(role).catch(() => null);
              }
            }

            const winnerMember = guild.members.cache.get(topMsgUser.userId);
            if (winnerMember) {
              await winnerMember.roles.add(role).catch(() => null);
              console.log(`💬 Rol Charletero del Mes (Texto) asignado a ${winnerMember.displayName} con ${topMsgUser.monthlyMessageCount} mensajes este mes.`);
            }
          }
        }

        // B. Top Voz del Mes Cerrado (Charlatán del Mes - VC)
        if (config.charlatanRoleId) {
          const topVcUser = await prisma.userXP.findFirst({
            where: { guildId, monthlyVcSeconds: { gt: 0 } },
            orderBy: { monthlyVcSeconds: 'desc' },
          });

          const role = guild.roles.cache.get(config.charlatanRoleId);
          if (role && topVcUser) {
            for (const [_, member] of role.members) {
              if (member.id !== topVcUser.userId) {
                await member.roles.remove(role).catch(() => null);
              }
            }

            const winnerMember = guild.members.cache.get(topVcUser.userId);
            if (winnerMember) {
              await winnerMember.roles.add(role).catch(() => null);
              console.log(`🎙️ Rol Charlatán del Mes (Voz) asignado a ${winnerMember.displayName} con ${(topVcUser.monthlyVcSeconds / 3600).toFixed(1)}h de voz este mes.`);
            }
          }
        }

        // C. Reiniciar los contadores MENSUALES a 0 para dar comienzo a la carrera del nuevo mes natural
        await prisma.userXP.updateMany({
          where: { guildId },
          data: {
            monthlyMessageCount: 0,
            monthlyVcSeconds: 0,
          },
        });
        console.log(`🔄 Contadores de mensajes y voz mensuales reiniciados a 0 para la nueva temporada.`);
      }

      // ── 2. REVISIÓN SUPERVISADA DE CLANES (HIELITOS & LOGS STAFF) ───────────
      const clans = await prisma.clan.findMany({ where: { guildId } });
      const now = new Date();
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

      const unfulfilledClansNoImmunity: string[] = [];

      for (const clan of clans) {
        // Calculate total hours for last month from ClanMemberMonthlyStats
        const stats = await prisma.clanMemberMonthlyStats.findMany({
          where: { clanId: clan.id, yearMonth: lastMonthStr },
        });

        const totalSeconds = stats.reduce((acc, s) => acc + s.secondsSpent, 0);
        const totalHours = totalSeconds / 3600;
        const membersCount = await prisma.clanMember.count({ where: { clanId: clan.id } });
        const goalHours = (config.clanGoalMode || 'FIXED') === 'PER_MEMBER'
          ? (config.clanHoursPerMember || 10) * membersCount
          : config.monthlyClanHoursGoal || 50;

        // Check if goal was met
        if (totalHours < goalHours) {
          if (clan.immunityShields > 0) {
            // Deduct 1 Immunity Shield (Hielito) automatically
            await prisma.clan.update({
              where: { id: clan.id },
              data: { immunityShields: { decrement: 1 } },
            });

            console.log(`🧊 Clan ${clan.name} no alcanzó la meta de ${goalHours}h (${totalHours}h), se consumió 1 Hielito (Quedan: ${clan.immunityShields - 1}).`);
          } else {
            // No immunity shield: Flag for Staff review (NEVER AUTO-DELETE)
            unfulfilledClansNoImmunity.push(`• <@&${clan.roleId}> (**${clan.name}**) ➔ **${totalHours.toFixed(1)}h** / **${goalHours}h**`);
          }
        }
      }

      // Send Staff Audit Report if there are clans needing review
      if (unfulfilledClansNoImmunity.length > 0 && config.clansLogChannelId) {
        const logChannel = guild.channels.cache.get(config.clansLogChannelId);
        if (logChannel && logChannel.isTextBased()) {
          const alertEmbed = new EmbedBuilder()
            .setTitle('⚠️ REVISIÓN MENSUAL DE CLANES EN RIESGO')
            .setColor(0xE74C3C)
            .setDescription(`Los siguientes clanes **no cumplieron su meta mensual** del mes \`${lastMonthStr}\` y **no tienen Escudos de Inmunidad (Hielitos)**.\n\n*Nota: El Staff tiene la decisión final para otorgar una oportunidad o eliminar el clan desde el panel web.*\n\n${unfulfilledClansNoImmunity.join('\n')}`)
            .setFooter({ text: 'Decisión del Staff requerida en el Panel de Control' })
            .setTimestamp();

          await (logChannel as any).send({ embeds: [alertEmbed] }).catch(() => null);
        }
      }
    } catch (err) {
      console.error(`Error en revisión mensual de guild ${guildId}:`, err);
    }
  }
}
