import { Client, EmbedBuilder, Guild, GuildMember } from 'discord.js';
import { prisma } from 'shared';

// Guard para evitar múltiples timers si ClientReady se dispara varias veces
let birthdaySchedulerStarted = false;

/**
 * Starts a background hourly checker for birthdays.
 * Safe to call multiple times — only registers the interval once.
 */
export function startBirthdayScheduler(client: Client) {
  if (birthdaySchedulerStarted) return;
  birthdaySchedulerStarted = true;

  console.log('⏰ Programador de cumpleaños iniciado (Verificación automática activa).');

  // Check every hour
  setInterval(async () => {
    try {
      await checkBirthdays(client);
    } catch (error) {
      console.error('Error al verificar cumpleaños en scheduler:', error);
    }
  }, 60 * 60 * 1000); // Every 1 hour
}


/**
 * Checks for birthdays on the current day, assigns roles, sends messages,
 * and removes birthday roles only from users who were assigned the role by the bot.
 */
export async function checkBirthdays(client: Client) {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const currentYear = now.getFullYear();

  console.log(`📅 Ejecutando revisión de cumpleaños para hoy (${currentDay}/${currentMonth}/${currentYear})...`);

  // 1. Process active birthdays (assign roles and send messages)
  const birthdaysToday = await prisma.userBirthday.findMany({
    where: {
      birthDay: currentDay,
      birthMonth: currentMonth,
    },
  });

  for (const birthday of birthdaysToday) {
    try {
      const guild = client.guilds.cache.get(birthday.guildId);
      if (!guild) continue;

      const config = await prisma.guildConfig.findUnique({
        where: { guildId: birthday.guildId },
      });
      if (!config || !config.birthdayEnabled) continue;

      // Fetch the member safely
      const member = await guild.members.fetch(birthday.userId).catch(() => null);
      if (!member) continue;

      // A. Assign Birthday Role if configured and member doesn't already have it
      let roleAssignedByBot = false;
      if (config.birthdayRoleId) {
        const role = guild.roles.cache.get(config.birthdayRoleId);
        if (role) {
          if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role).catch((err) =>
              console.error(`Error al añadir rol de cumpleaños a ${member.user.tag}:`, err)
            );
            roleAssignedByBot = true;
          }
        }
      }

      // B. Send message if not already celebrated this year (or if we need to update status)
      if (birthday.lastCelebratedYear !== currentYear || (roleAssignedByBot && !birthday.birthdayRoleAssigned)) {
        // Update DB to mark as celebrated this year and if we assigned the role
        await prisma.userBirthday.update({
          where: { id: birthday.id },
          data: { 
            lastCelebratedYear: currentYear,
            birthdayRoleAssigned: roleAssignedByBot || birthday.birthdayRoleAssigned // Keep true if it was already true
          },
        });

        // Only send congratulations message once per year
        if (birthday.lastCelebratedYear !== currentYear) {
          // Format message
          const welcomeMsg = (config.birthdayMessage || '🎉 ¡Feliz cumpleaños {user}! Que pases un gran día.')
            .replace(/{user}/g, `<@${member.id}>`);

          const embed = new EmbedBuilder()
            .setColor('#a78bfa')
            .setTitle('🎂 ¡Feliz Cumpleaños!')
            .setDescription(welcomeMsg)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

          // Check channel destination
          if (config.birthdayChannelId === 'dm') {
            await member.send({ embeds: [embed] }).catch(() =>
              console.log(`No se pudo enviar DM de felicitación a ${member.user.tag} (DMs cerrados).`)
            );
          } else if (config.birthdayChannelId) {
            const channel = guild.channels.cache.get(config.birthdayChannelId);
            if (channel?.isTextBased()) {
              await channel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch((err) =>
                console.error(`Error al enviar felicitación en canal ${channel.id}:`, err)
              );
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error al procesar cumpleaños de usuario ${birthday.userId} en servidor ${birthday.guildId}:`, err);
    }
  }

  // 2. Cleanup expired birthday roles (only for users where birthdayRoleAssigned: true)
  const activeAssignments = await prisma.userBirthday.findMany({
    where: {
      birthdayRoleAssigned: true,
    },
  });

  for (const assignment of activeAssignments) {
    // If today is their birthday, keep the role
    if (assignment.birthDay === currentDay && assignment.birthMonth === currentMonth) {
      continue;
    }

    try {
      const guild = client.guilds.cache.get(assignment.guildId);
      if (!guild) continue;

      const config = await prisma.guildConfig.findUnique({
        where: { guildId: assignment.guildId },
      });
      if (!config || !config.birthdayRoleId) {
        // If config changed or role removed, just untrack in DB
        await prisma.userBirthday.update({
          where: { id: assignment.id },
          data: { birthdayRoleAssigned: false },
        });
        continue;
      }

      const member = await guild.members.fetch(assignment.userId).catch(() => null);
      if (member) {
        const role = guild.roles.cache.get(config.birthdayRoleId);
        if (role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role).catch((err) =>
            console.error(`Error al retirar rol de cumpleaños a ${member.user.tag}:`, err)
          );
          console.log(`🧹 Retirado rol de cumpleaños temporal a ${member.displayName}.`);
        }
      }

      // Untrack assignment in DB
      await prisma.userBirthday.update({
        where: { id: assignment.id },
        data: { birthdayRoleAssigned: false },
      });
    } catch (err) {
      console.error(`Error al limpiar asignación de rol de cumpleaños para usuario ${assignment.userId}:`, err);
    }
  }
}
