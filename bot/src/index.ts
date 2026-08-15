import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} from 'discord.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { prisma } from 'shared';
import { handleMessageXP, handleVoiceXP, xpForLevel, xpForVoiceLevel, getTotalXpForLevel, getTotalXpForVoiceLevel, getLevelAndXpFromTotal, getLevelAndXpFromTotalVoice, addXP, syncActiveVoiceChannels, flushVoiceXPBeforeShutdown, checkAndAssignLevelRoles } from './modules/leveling';
import { handleTempVCJoin, handleTempVCLeave, handleTempVCInteraction, cleanupTempChannels, handleVCCommand } from './modules/tempvc';
import { handleClanVoiceXP, flushClanVoiceStatsBeforeShutdown, handleClanCommand, handleClanInteraction, createClanInDiscordAndDB, importClanToDB, deleteClanFromDiscordAndDB, setClansClient, getOrCreateDefaultClanShopItems, buyClanShopItem } from './modules/clans';
import { generateRankCard, generateLeaderboardCard } from './modules/cardGenerator';
import {
  handlePrefixEconomyCommands,
  handleBJInteraction,
  handleDeposit,
  handleWithdraw,
  handleWork,
  handleCrime,
  handleSlut,
  handleRob,
  handleCollectIncome,
  handleSlotMachine,
  handleRoulette,
  handleChickenFight,
  handleBuyChicken,
  startBlackjack,
  getOrCreateUserEconomy,
  fmtMoney,
  handlePay,
  handleAddMoney,
  handleRemoveMoney,
  handleSetMoney,
  handleInventory,
  handleShop,
  handleBuy,
  setEconomyClient,
  handleShopAndInventoryInteraction,
  handleTopMoney,
  handleChickenBuy,
  handleChickenTrain,
  handleGallinero,
  handleGalloInteraction,
  buildGallineroHub
} from './modules/economy';
import { processMonthlyServerTasks, startMonthlyScheduler } from './modules/monthlyReset';
import { startBirthdayScheduler, checkBirthdays } from './modules/birthdays';
import { setCustomTriggersClient, handleCustomTriggers } from './modules/customTriggers';

dotenv.config();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

// Setup bot event listeners
client.on(Events.ClientReady, async (c) => {
  console.log(`🤖 Bot listo y conectado como: ${c.user.tag}`);
  setEconomyClient(c);
  setClansClient(c);
  setCustomTriggersClient(c);
  try {
    console.log('📦 Ruta de @prisma/client:', require.resolve('@prisma/client'));
    console.log('📦 Ruta de shared:', require.resolve('shared'));
  } catch (err) {}
  console.log('🔑 Modelos de Prisma disponibles:', Object.keys(prisma).filter(k => !k.startsWith('_')));

  // Start background monthly scheduler & run check
  startMonthlyScheduler(c);
  await processMonthlyServerTasks(c).catch(() => null);

  // Start background birthday scheduler & run check
  startBirthdayScheduler(c);
  await checkBirthdays(c).catch(() => null);

  // Clean up any orphaned temp voice channels in DB/Discord from previous sessions
  await cleanupTempChannels(c);

  // Sync active voice channels for leveling
  await syncActiveVoiceChannels(c);

  // Register basic global slash commands
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || 'dummy-token');
  try {
    const commands = [
      new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Muestra tu nivel y XP actual')
        .addUserOption(option =>
          option.setName('usuario').setDescription('El usuario del que quieres ver el rango')
        ),
      new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Muestra el top de nivel del servidor'),
      new SlashCommandBuilder()
        .setName('cumpleaños')
        .setDescription('Gestión de cumpleaños')
        .addSubcommand(sub =>
          sub.setName('establecer')
            .setDescription('Registra o actualiza tu fecha de cumpleaños')
            .addIntegerOption(opt => opt.setName('dia').setDescription('Día de nacimiento (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
            .addIntegerOption(opt => opt.setName('mes').setDescription('Mes de nacimiento (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
        )
        .addSubcommand(sub =>
          sub.setName('ver')
            .setDescription('Muestra tu fecha de cumpleaños registrada')
        ),
      new SlashCommandBuilder()
        .setName('setup-tempvc')
        .setDescription('Configura el canal maestro para VCs temporales')
        .addChannelOption(option =>
          option.setName('canal').setDescription('El canal de voz que servirá de creador').setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
      new SlashCommandBuilder()
        .setName('vc')
        .setDescription('Controles del canal de voz temporal')
        .addSubcommand(sub =>
          sub.setName('lock').setDescription('Bloquea el canal para evitar que entren nuevos usuarios')
        )
        .addSubcommand(sub =>
          sub.setName('unlock').setDescription('Desbloquea el canal')
        )
        .addSubcommand(sub =>
          sub.setName('hide').setDescription('Oculta el canal para que nadie lo vea')
        )
        .addSubcommand(sub =>
          sub.setName('show').setDescription('Hace el canal visible de nuevo')
        )
        .addSubcommand(sub =>
          sub.setName('rename')
            .setDescription('Cambia el nombre de tu canal temporal')
            .addStringOption(opt => opt.setName('nombre').setDescription('Nuevo nombre del canal').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('limit')
            .setDescription('Ajusta el límite de usuarios de tu canal')
            .addIntegerOption(opt => opt.setName('limite').setDescription('Número máximo de usuarios (0 = ilimitado)').setRequired(true).setMinValue(0).setMaxValue(99))
        )
        .addSubcommand(sub =>
          sub.setName('kick')
            .setDescription('Expulsa y veta a un miembro de tu canal temporal')
            .addUserOption(opt => opt.setName('usuario').setDescription('El usuario a expulsar').setRequired(false))
            .addStringOption(opt => opt.setName('id').setDescription('O introduce su ID de usuario').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('admit')
            .setDescription('Permite la entrada a un usuario a tu canal bloqueado')
            .addUserOption(opt => opt.setName('usuario').setDescription('El usuario a admitir').setRequired(false))
            .addStringOption(opt => opt.setName('id').setDescription('O introduce su ID de usuario').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('transfer')
            .setDescription('Transfiere la propiedad de tu canal temporal a otro miembro')
            .addUserOption(opt => opt.setName('usuario').setDescription('El nuevo propietario').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('claim')
            .setDescription('Reclama la propiedad del canal si el dueño no está')
        ),
      new SlashCommandBuilder()
        .setName('xp')
        .setDescription('Comandos administrativos para gestionar XP y Niveles')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        // Subcommand Group: Texto (txt)
        .addSubcommandGroup(group =>
          group.setName('txt')
            .setDescription('Administrar nivel y XP de Texto')
            .addSubcommand(sub =>
              sub.setName('add')
                .setDescription('Añade puntos de XP o Niveles de Texto a un usuario')
                .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
                .addIntegerOption(opt => opt.setName('xp').setDescription('Puntos de XP a añadir').setRequired(false).setMinValue(1))
                .addIntegerOption(opt => opt.setName('niveles').setDescription('Niveles directos a añadir').setRequired(false).setMinValue(1))
            )
            .addSubcommand(sub =>
              sub.setName('remove')
                .setDescription('Quita puntos de XP o Niveles de Texto a un usuario')
                .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
                .addIntegerOption(opt => opt.setName('xp').setDescription('Puntos de XP a quitar').setRequired(false).setMinValue(1))
                .addIntegerOption(opt => opt.setName('niveles').setDescription('Niveles directos a quitar').setRequired(false).setMinValue(1))
            )
            .addSubcommand(sub =>
              sub.setName('set')
                .setDescription('Establece el nivel o XP exacto de Texto')
                .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
                .addIntegerOption(opt => opt.setName('nivel').setDescription('Nuevo nivel de texto').setRequired(false).setMinValue(0))
                .addIntegerOption(opt => opt.setName('xp').setDescription('Nueva XP de texto').setRequired(false).setMinValue(0))
            )
            .addSubcommand(sub =>
              sub.setName('reset')
                .setDescription('Reinicia la XP y nivel de Texto de un usuario')
                .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
            )
        )
        // Subcommand Group: Voz (vc)
        .addSubcommandGroup(group =>
          group.setName('vc')
            .setDescription('Administrar nivel y XP de Voz')
            .addSubcommand(sub =>
              sub.setName('add')
                .setDescription('Añade puntos de XP o Niveles de Voz a un usuario')
                .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
                .addIntegerOption(opt => opt.setName('xp').setDescription('Puntos de XP a añadir').setRequired(false).setMinValue(1))
                .addIntegerOption(opt => opt.setName('niveles').setDescription('Niveles directos a añadir').setRequired(false).setMinValue(1))
            )
            .addSubcommand(sub =>
              sub.setName('remove')
                .setDescription('Quita puntos de XP o Niveles de Voz a un usuario')
                .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
                .addIntegerOption(opt => opt.setName('xp').setDescription('Puntos de XP a quitar').setRequired(false).setMinValue(1))
                .addIntegerOption(opt => opt.setName('niveles').setDescription('Niveles directos a quitar').setRequired(false).setMinValue(1))
            )
            .addSubcommand(sub =>
              sub.setName('set')
                .setDescription('Establece el nivel o XP exacto de Voz')
                .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
                .addIntegerOption(opt => opt.setName('nivel').setDescription('Nuevo nivel de voz').setRequired(false).setMinValue(0))
                .addIntegerOption(opt => opt.setName('xp').setDescription('Nueva XP de voz').setRequired(false).setMinValue(0))
            )
            .addSubcommand(sub =>
              sub.setName('reset')
                .setDescription('Reinicia la XP y nivel de Voz de un usuario')
                .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
            )
        )
        // Subcommand: Reinicio completo
        .addSubcommand(sub =>
          sub.setName('reset-all')
            .setDescription('Reinicia completamente la XP y niveles (Texto y Voz) de un usuario')
            .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
        ),
      new SlashCommandBuilder()
        .setName('prestigiar')
        .setDescription('Otorga la opción de prestigiar a un usuario que haya alcanzado el Nivel 100 de Texto')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(opt => opt.setName('usuario').setDescription('El usuario que va a prestigiar').setRequired(true)),
      new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Transfiere dinero en efectivo a otro usuario')
        .addUserOption(opt => opt.setName('usuario').setDescription('El usuario a quien transferir dinero').setRequired(true))
        .addStringOption(opt => opt.setName('cantidad').setDescription('Cantidad a enviar (ej: 50k, 1.5m, half, all)').setRequired(true)),
      new SlashCommandBuilder()
        .setName('economy')
        .setDescription('Comandos administrativos para gestionar la economía')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Añade dinero al saldo de un usuario')
            .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
            .addStringOption(opt => opt.setName('cantidad').setDescription('Cantidad a añadir (ej: 100k, 1m)').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Retira dinero del saldo de un usuario')
            .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
            .addStringOption(opt => opt.setName('cantidad').setDescription('Cantidad a retirar').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('set')
            .setDescription('Establece el saldo exacto de dinero de un usuario')
            .addUserOption(opt => opt.setName('usuario').setDescription('El usuario objetivo').setRequired(true))
            .addStringOption(opt => opt.setName('cantidad').setDescription('Nuevo saldo exacto').setRequired(true))
        ),
      new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Muestra tus objetos coleccionables de la temporada')
        .addUserOption(opt => opt.setName('usuario').setDescription('El usuario del que quieres ver la mochila').setRequired(false)),
      new SlashCommandBuilder()
        .setName('top')
        .setDescription('Muestra la clasificación de los usuarios más ricos del servidor esta temporada'),
      new SlashCommandBuilder()
        .setName('baltop')
        .setDescription('Muestra la clasificación de los usuarios más ricos del servidor esta temporada'),
      new SlashCommandBuilder()
        .setName('gallo')
        .setDescription('Mini-RPG de crianza, entrenamiento y batallas de gallos')
        .addSubcommand(sub => sub.setName('gallinero').setDescription('Ver tus 3 gallos en propiedad, su fuerza y estado'))
        .addSubcommand(sub =>
          sub.setName('comprar')
            .setDescription('Comprar un nuevo gallo para tu gallinero')
            .addStringOption(opt => opt.setName('nombre').setDescription('Nombre del gallo (opcional)').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('entrenar')
            .setDescription('Poner a entrenar un gallo en la jaula para subir su fuerza')
            .addStringOption(opt => opt.setName('gallo').setDescription('ID o número del gallo (#1, #2, #3)').setRequired(true))
            .addIntegerOption(opt => opt.setName('minutos').setDescription('Tiempo de entreno (5, 15, 30, 60)').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('pelear')
            .setDescription('Enviar un gallo a combatir en la batalla (¡Consigue el x2 de premio!)')
            .addStringOption(opt => opt.setName('apuesta').setDescription('Cantidad de dinero de entrada (ej: 50k, 1m)').setRequired(true))
            .addStringOption(opt => opt.setName('gallo').setDescription('ID o número del gallo (#1, #2, #3)').setRequired(false))
        ),
      new SlashCommandBuilder()
        .setName('say')
        .setDescription('Envía un mensaje a través del bot en el canal actual (Solo Staff)')
        .addStringOption(opt => opt.setName('mensaje').setDescription('El texto que enviará el bot').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    ].map(cmd => cmd.toJSON());

    console.log('🔄 Registrando comandos slash...');
    await rest.put(
      Routes.applicationCommands(c.user.id),
      { body: commands }
    );
    console.log('✅ Comandos registrados con éxito.');
  } catch (error) {
    console.warn('⚠️ ï No se pudieron registrar los comandos (puede ser por falta de DISCORD_TOKEN válido):', error);
  }
});

// Message XP, Prefix Economy & Clan Command Listener
client.on(Events.MessageCreate, async (message) => {
  await handleMessageXP(message);
  await handlePrefixEconomyCommands(message);
  await handleClanCommand(message);
  await handleCustomTriggers(message);
});

// Voice State Listener (VC XP, Temp VC & Clan VC Anti-AFK)
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  // Leveling Voice XP
  await handleVoiceXP(oldState, newState);

  // Clan Voice Time Anti-AFK Tracking
  await handleClanVoiceXP(oldState, newState);

  // Temp VC Creation/Deletion
  if (oldState.channelId !== newState.channelId) {
    await handleTempVCJoin(oldState, newState);
    await handleTempVCLeave(oldState, newState);
  }
});

/**
 * Helper to build interactive Leaderboard image view with buttons.
 */
async function buildLeaderboardView(guild: any, category: 'OVERVIEW' | 'TEXT' | 'VOICE' | 'PRESTIGE') {
  let textUsers: any[] = [];
  let voiceUsers: any[] = [];
  let usersToFormat: any[] = [];

  if (category === 'OVERVIEW') {
    const [topText, topVoice] = await Promise.all([
      prisma.userXP.findMany({
        where: { guildId: guild.id },
        orderBy: [{ textLevel: 'desc' }, { textXp: 'desc' }],
        take: 5,
      }),
      prisma.userXP.findMany({
        where: { guildId: guild.id },
        orderBy: [{ voiceLevel: 'desc' }, { voiceXp: 'desc' }],
        take: 5,
      })
    ]);

    textUsers = await Promise.all(
      topText.map(async (u, idx) => {
        let displayName = 'Usuario';
        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
        try {
          const member = await guild.members.fetch(u.userId);
          displayName = member.displayName;
          avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 128 });
        } catch {
          displayName = `ID: ${u.userId}`;
        }
        return {
          rank: idx + 1,
          displayName,
          avatarUrl,
          textLevel: u.textLevel,
          textXp: u.textXp,
          voiceLevel: u.voiceLevel,
          vcSeconds: u.vcSeconds,
          prestige: u.prestige || 0,
        };
      })
    );

    voiceUsers = await Promise.all(
      topVoice.map(async (u, idx) => {
        let displayName = 'Usuario';
        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
        try {
          const member = await guild.members.fetch(u.userId);
          displayName = member.displayName;
          avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 128 });
        } catch {
          displayName = `ID: ${u.userId}`;
        }
        return {
          rank: idx + 1,
          displayName,
          avatarUrl,
          textLevel: u.textLevel,
          textXp: u.textXp,
          voiceLevel: u.voiceLevel,
          vcSeconds: u.vcSeconds,
          prestige: u.prestige || 0,
        };
      })
    );
  } else {
    let orderBy: any[] = [];
    if (category === 'TEXT') {
      orderBy = [{ textLevel: 'desc' }, { textXp: 'desc' }];
    } else if (category === 'VOICE') {
      orderBy = [{ voiceLevel: 'desc' }, { voiceXp: 'desc' }];
    } else {
      orderBy = [{ prestige: 'desc' }, { textLevel: 'desc' }];
    }

    const topUsers = await prisma.userXP.findMany({
      where: {
        guildId: guild.id,
        ...(category === 'PRESTIGE' ? { prestige: { gt: 0 } } : {})
      },
      orderBy,
      take: 10,
    });

    usersToFormat = await Promise.all(
      topUsers.map(async (u, idx) => {
        let displayName = 'Usuario';
        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
        try {
          const member = await guild.members.fetch(u.userId);
          displayName = member.displayName;
          avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 128 });
        } catch {
          displayName = `ID: ${u.userId}`;
        }

        return {
          rank: idx + 1,
          displayName,
          avatarUrl,
          textLevel: u.textLevel,
          textXp: u.textXp,
          voiceLevel: u.voiceLevel,
          vcSeconds: u.vcSeconds,
          prestige: u.prestige || 0,
        };
      })
    );
  }

  const imageBuffer = await generateLeaderboardCard({
    guildName: guild.name || 'Servidor',
    category,
    users: category === 'OVERVIEW' ? textUsers : usersToFormat,
    voiceUsers: category === 'OVERVIEW' ? voiceUsers : undefined,
  });

  const attachment = new AttachmentBuilder(imageBuffer, { name: `leaderboard-${category.toLowerCase()}.png` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('lb_cat_OVERVIEW')
      .setLabel('🌐 General')
      .setStyle(category === 'OVERVIEW' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(category === 'OVERVIEW'),
    new ButtonBuilder()
      .setCustomId('lb_cat_TEXT')
      .setLabel('💵 Top Texto')
      .setStyle(category === 'TEXT' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(category === 'TEXT'),
    new ButtonBuilder()
      .setCustomId('lb_cat_VOICE')
      .setLabel('🎙️ Top Voz')
      .setStyle(category === 'VOICE' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(category === 'VOICE'),
    new ButtonBuilder()
      .setCustomId('lb_cat_PRESTIGE')
      .setLabel('🌟 Top Prestigio')
      .setStyle(category === 'PRESTIGE' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(category === 'PRESTIGE')
  );

  return { files: [attachment], components: [row] };
}

/**
 * Helper to check if a guild member has staff/admin permissions.
 */
async function isUserStaffOrAdmin(guildId: string, member: any): Promise<boolean> {
  if (!member) return false;
  const memberPermissions = member.permissions;
  if (typeof memberPermissions === 'object' && memberPermissions.has('Administrator')) {
    return true;
  }
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (config?.adminRoleIds && member.roles?.cache) {
    const adminRoles = config.adminRoleIds.split(',').map(id => id.trim()).filter(Boolean);
    if (adminRoles.some(rId => member.roles.cache.has(rId))) {
      return true;
    }
  }
  return false;
}

// Command & Button & Modal Interactions
client.on(Events.InteractionCreate, async (interaction) => {
  // Temp VC, Blackjack & Shop/Inventory button interactions
  await handleTempVCInteraction(interaction);
  await handleBJInteraction(interaction);
  await handleShopAndInventoryInteraction(interaction);
  await handleGalloInteraction(interaction);

  // Leaderboard Button category switcher
  if (interaction.isButton() && interaction.customId.startsWith('lb_cat_')) {
    if (!interaction.guild) return;
    await interaction.deferUpdate();
    const cat = interaction.customId.replace('lb_cat_', '') as 'OVERVIEW' | 'TEXT' | 'VOICE' | 'PRESTIGE';
    const view = await buildLeaderboardView(interaction.guild, cat);
    return interaction.editReply(view);
  }

  // Slash commands
  if (interaction.isChatInputCommand()) {
    const { commandName, guildId, member, user } = interaction;
    if (!guildId) return;

    const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId } });

    // Module enablement checks
    const levelingCommands = ['rank', 'leaderboard', 'xp', 'prestigiar'];
    if (levelingCommands.includes(commandName) && guildConfig?.levelingEnabled === false) {
      return interaction.reply({
        content: '❌ El módulo de niveles está desactivado en este servidor.',
        ephemeral: true,
      });
    }

    const economyCommands = ['pay', 'economy', 'inventory', 'top', 'baltop', 'gallo'];
    if (economyCommands.includes(commandName) && guildConfig?.economyEnabled === false) {
      return interaction.reply({
        content: '❌ El módulo de economía y casino está desactivado en este servidor.',
        ephemeral: true,
      });
    }

    const tempvcCommands = ['setup-tempvc', 'vc'];
    if (tempvcCommands.includes(commandName) && guildConfig?.tempVcEnabled === false) {
      return interaction.reply({
        content: '❌ El módulo de canales de voz temporales está desactivado en este servidor.',
        ephemeral: true,
      });
    }

    if (commandName === 'cumpleaños' && guildConfig?.birthdayEnabled === false) {
      return interaction.reply({
        content: '❌ El módulo de cumpleaños está desactivado en este servidor.',
        ephemeral: true,
      });
    }

    // Check command channel restriction for non-staff on /rank & /leaderboard
    if (commandName === 'rank' || commandName === 'leaderboard') {
      const config = guildConfig;
      if (config?.commandsChannelId && interaction.channelId !== config.commandsChannelId) {
        const isStaff = await isUserStaffOrAdmin(guildId, member);
        if (!isStaff) {
          return interaction.reply({
            content: `❌ Este comando solo se puede usar en el canal <#${config.commandsChannelId}>.`,
            ephemeral: true,
          });
        }
      }
    }

    if (commandName === 'say') {
      const isStaff = await isUserStaffOrAdmin(guildId, member);
      if (!isStaff) {
        return interaction.reply({
          content: '❌ No tienes permisos para usar el comando `/say`. (Requiere Staff o Administrador).',
          ephemeral: true,
        });
      }

      const messageText = interaction.options.getString('mensaje', true);

      await interaction.reply({ content: '✅ Mensaje enviado correctamente.', ephemeral: true });

      if (interaction.channel && 'send' in interaction.channel) {
        await (interaction.channel as any).send(messageText);
      }
      return;
    }

    if (commandName === 'rank') {
      try {
        const targetUser = interaction.options.getUser('usuario') || user;
        const targetId = `${guildId}-${targetUser.id}`;

        let userXP = await prisma.userXP.findUnique({
          where: { id: targetId },
        });

        if (!userXP) {
          return interaction.reply({ content: `❌ **${targetUser.username}** no tiene registro de actividad aún.`, ephemeral: true });
        }

        await interaction.deferReply();

        // Calculate rank position in server
        const higherCount = await prisma.userXP.count({
          where: {
            guildId,
            OR: [
              { textLevel: { gt: userXP.textLevel ?? 0 } },
              { textLevel: userXP.textLevel ?? 0, textXp: { gt: userXP.textXp ?? 0 } }
            ]
          }
        });
        const rankPosition = higherCount + 1;

        const memberObj = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
        const displayName = memberObj?.displayName || (targetUser as any).displayName || targetUser.username;
        const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });

        const imageBuffer = await generateRankCard({
          username: targetUser.username,
          displayName,
          avatarUrl,
          rankPosition,
          textLevel: userXP.textLevel ?? 0,
          textXp: userXP.textXp ?? 0,
          voiceLevel: userXP.voiceLevel ?? 0,
          voiceXp: userXP.voiceXp ?? 0,
          prestige: userXP.prestige ?? 0,
          messageCount: userXP.messageCount ?? 0,
          vcSeconds: userXP.vcSeconds ?? 0,
        });

        const attachment = new AttachmentBuilder(imageBuffer, { name: `rank-${targetUser.id}.png` });

        return interaction.editReply({
          files: [attachment],
        });
      } catch (err: any) {
        console.error('[Slash /rank Error]:', err);
        const errorMsg = '❌ Ocurrió un error al generar la tarjeta de rango.';
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: errorMsg });
        } else {
          return interaction.reply({ content: errorMsg, ephemeral: true });
        }
      }
    }

    if (commandName === 'leaderboard') {
      if (!interaction.guild) return;
      await interaction.deferReply();
      const view = await buildLeaderboardView(interaction.guild, 'OVERVIEW');
      const replyMsg = await interaction.editReply(view);

      // Auto-expire buttons after 5 minutes
      setTimeout(async () => {
        try {
          const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('lb_cat_OVERVIEW').setLabel('🌐 General').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('lb_cat_TEXT').setLabel('💵 Top Texto').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('lb_cat_VOICE').setLabel('🎙️ Top Voz').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('lb_cat_PRESTIGE').setLabel('🌟 Top Prestigio').setStyle(ButtonStyle.Secondary).setDisabled(true)
          );
          await replyMsg.edit({ components: [disabledRow] }).catch(() => null);
        } catch { }
      }, 5 * 60 * 1000);

      return replyMsg;
    }

    if (commandName === 'cumpleaños') {
      const config = await prisma.guildConfig.findUnique({ where: { guildId } });
      if (!config?.birthdayEnabled) {
        return interaction.reply({
          content: '❌ El sistema de cumpleaños está desactivado en este servidor.',
          ephemeral: true
        });
      }

      const subcommand = interaction.options.getSubcommand();
      const id = `${guildId}-${user.id}`;

      if (subcommand === 'establecer') {
        const dia = interaction.options.getInteger('dia', true);
        const mes = interaction.options.getInteger('mes', true);

        // Validate date
        const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (dia > daysInMonth[mes - 1]) {
          return interaction.reply({
            content: `❌ La fecha ingresada (${dia}/${mes}) no es una fecha válida.`,
            ephemeral: true
          });
        }

        const existing = await prisma.userBirthday.findUnique({
          where: { id }
        });

        const now = new Date();

        if (existing) {
          const isGracePeriod = (now.getTime() - existing.createdAt.getTime()) < 24 * 60 * 60 * 1000;
          const isCooldownOver = !existing.lockedUntil || now >= existing.lockedUntil;

          if (!isGracePeriod && !isCooldownOver) {
            const timeDiff = existing.lockedUntil!.getTime() - now.getTime();
            const daysLeft = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
            return interaction.reply({
              content: `🔒 Tu fecha de cumpleaños está bloqueada. Podrás editarla de nuevo en **${daysLeft} días** (el ${existing.lockedUntil!.toLocaleDateString()}).`,
              ephemeral: true
            });
          }

          // If updating outside grace period, set/update lockedUntil to 180 days from now
          const nextLock = isGracePeriod ? existing.lockedUntil : new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

          await prisma.userBirthday.update({
            where: { id },
            data: {
              birthDay: dia,
              birthMonth: mes,
              lastSetAt: now,
              lockedUntil: nextLock
            }
          });

          return interaction.reply({
            content: `🎂 Tu fecha de cumpleaños ha sido actualizada a **${dia}/${mes}**.${!isGracePeriod ? '\n🔒 La edición se ha bloqueado por 6 meses.' : ''}`,
            ephemeral: true
          });
        } else {
          // Create new record
          await prisma.userBirthday.create({
            data: {
              id,
              guildId,
              userId: user.id,
              birthDay: dia,
              birthMonth: mes,
              createdAt: now,
              lastSetAt: now,
              lockedUntil: null // No lock during first 24 hours (grace period)
            }
          });

          return interaction.reply({
            content: `🎂 Tu fecha de cumpleaños se ha registrado como **${dia}/${mes}**.\nTienes 24 horas para corregir cualquier error antes de que se bloquee por 6 meses.`,
            ephemeral: true
          });
        }
      }

      if (subcommand === 'ver') {
        const record = await prisma.userBirthday.findUnique({
          where: { id }
        });

        if (!record) {
          return interaction.reply({
            content: `❌ Aún no has registrado tu cumpleaños. Usa \`/cumpleaños establecer\` para registrarlo.`,
            ephemeral: true
          });
        }

        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const dateStr = `**${record.birthDay} de ${months[record.birthMonth - 1]}**`;

        let statusText = '';
        const now = new Date();
        const isGracePeriod = (now.getTime() - record.createdAt.getTime()) < 24 * 60 * 60 * 1000;

        if (isGracePeriod) {
          statusText = '\n✍️ Puedes editarlo libremente (dentro del periodo de gracia de 24h).';
        } else if (record.lockedUntil && now < record.lockedUntil) {
          const timeDiff = record.lockedUntil.getTime() - now.getTime();
          const daysLeft = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
          statusText = `\n🔒 Edición bloqueada por **${daysLeft} días** (hasta el ${record.lockedUntil.toLocaleDateString()}).`;
        } else {
          statusText = '\n🔓 Edición disponible.';
        }

        return interaction.reply({
          content: `🎂 Tu fecha de cumpleaños registrada es: ${dateStr}.${statusText}`,
          ephemeral: true
        });
      }
    }

    if (commandName === 'setup-tempvc') {
      // Check admin permissions
      const memberPermissions = member?.permissions;
      if (typeof memberPermissions === 'object' && !memberPermissions.has('Administrator')) {
        return interaction.reply({ content: '❌ Solo los administradores pueden usar este comando.', ephemeral: true });
      }

      const channel: any = interaction.options.getChannel('canal');
      if (!channel || channel.type !== 2) { // 2 = GuildVoice
        return interaction.reply({ content: '❌ Debes seleccionar un canal de voz válido.', ephemeral: true });
      }

      await prisma.guildConfig.upsert({
        where: { guildId },
        update: {
          tempVcChannelId: channel.id,
          tempVcCategoryId: channel.parentId || null,
        },
        create: {
          guildId,
          tempVcChannelId: channel.id,
          tempVcCategoryId: channel.parentId || null,
        },
      });

      await interaction.reply({ content: `✅ Canal de creación de VCs temporales configurado a: **${channel.name}**`, ephemeral: true });
    }

    if (commandName === 'vc') {
      await handleVCCommand(interaction);
    }

    if (commandName === 'xp') {
      // Helper function to check if member is admin or has Bot Admin Role
      const config = await prisma.guildConfig.findUnique({ where: { guildId } });
      const memberPermissions = member?.permissions;
      const isAdminByDiscord = typeof memberPermissions === 'object' && memberPermissions.has('Administrator');

      let isBotAdmin = isAdminByDiscord;
      if (!isBotAdmin && config?.adminRoleIds && member && 'roles' in member) {
        const allowedRoles = config.adminRoleIds.split(',').map(r => r.trim());
        const memberRoles = (member as any).roles.cache;
        isBotAdmin = allowedRoles.some(rId => memberRoles.has(rId));
      }

      if (!isBotAdmin) {
        return interaction.reply({
          content: '❌ No tienes permisos para usar comandos de administración de XP. (Requiere administrador o Rol Admin del Bot).',
          ephemeral: true
        });
      }

      const subcommandGroup = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand();
      const targetUser = interaction.options.getUser('usuario', true);
      const targetId = `${guildId}-${targetUser.id}`;

      let userXP = await prisma.userXP.findUnique({ where: { id: targetId } });
      if (!userXP) {
        userXP = await prisma.userXP.create({
          data: { id: targetId, guildId, userId: targetUser.id, textXp: 0, textLevel: 0, voiceXp: 0, voiceLevel: 0 }
        });
      }

      if (subcommand === 'reset-all') {
        await prisma.userXP.update({
          where: { id: targetId },
          data: { textXp: 0, textLevel: 0, voiceXp: 0, voiceLevel: 0, messageCount: 0, vcSeconds: 0 }
        });
        return interaction.reply({ content: `🔄 Se han reiniciado por completo todos los datos de XP (Texto y Voz) de **${targetUser.username}**.`, ephemeral: true });
      }

      const isText = subcommandGroup === 'txt';
      const typeLabel = isText ? 'Texto 💵' : 'Voz 🎙️';
      const type: 'TEXT' | 'VOICE' = isText ? 'TEXT' : 'VOICE';

      if (subcommand === 'add') {
        const xpToAdd = interaction.options.getInteger('xp') || 0;
        const levelsToAdd = interaction.options.getInteger('niveles') || 0;

        if (xpToAdd === 0 && levelsToAdd === 0) {
          return interaction.reply({ content: '❌ Debes indicar una cantidad de XP o de Niveles para añadir.', ephemeral: true });
        }

        let replyMsg = `✅ **${targetUser.username}**: `;
        const updates: string[] = [];

        if (levelsToAdd > 0) {
          const currentLevel = isText ? userXP.textLevel : userXP.voiceLevel;
          const newLevel = currentLevel + levelsToAdd;
          await prisma.userXP.update({
            where: { id: targetId },
            data: isText ? { textLevel: newLevel } : { voiceLevel: newLevel }
          });

          // Check & assign level roles for newly reached levels
          const memberObj = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
          if (memberObj) {
            await checkAndAssignLevelRoles(memberObj, type, newLevel);
          }
          updates.push(`+**${levelsToAdd} Niveles** de ${typeLabel} (Ahora Nivel **${newLevel}**)`);
        }

        if (xpToAdd > 0) {
          await addXP(guildId, targetUser.id, type, xpToAdd, null, 0, interaction.guild);
          updates.push(`+**${xpToAdd} XP** de ${typeLabel}`);
        }

        replyMsg += updates.join(' y ');
        return interaction.reply({ content: replyMsg, ephemeral: true });
      }

      if (subcommand === 'remove') {
        const xpToRemove = interaction.options.getInteger('xp') || 0;
        const levelsToRemove = interaction.options.getInteger('niveles') || 0;

        if (xpToRemove === 0 && levelsToRemove === 0) {
          return interaction.reply({ content: '❌ Debes indicar una cantidad de XP o de Niveles para quitar.', ephemeral: true });
        }

        let currentLevel = isText ? userXP.textLevel : userXP.voiceLevel;
        let currentXp = isText ? userXP.textXp : userXP.voiceXp;

        let newLevel = Math.max(0, currentLevel - levelsToRemove);
        let newXp = Math.max(0, currentXp - xpToRemove);

        const updateData: any = {};
        if (isText) {
          updateData.textLevel = newLevel;
          updateData.textXp = newXp;
        } else {
          updateData.voiceLevel = newLevel;
          updateData.voiceXp = newXp;
        }

        await prisma.userXP.update({
          where: { id: targetId },
          data: updateData
        });

        const updates: string[] = [];
        if (levelsToRemove > 0) updates.push(`-**${levelsToRemove} Niveles** (Nivel **${newLevel}**)`);
        if (xpToRemove > 0) updates.push(`-**${xpToRemove} XP** (XP actual **${newXp}**)`);

        return interaction.reply({ content: `✅ Se han restado a **${targetUser.username}** (${typeLabel}): ${updates.join(' y ')}.`, ephemeral: true });
      }

      if (subcommand === 'set') {
        const newLevel = interaction.options.getInteger('nivel');
        const newXp = interaction.options.getInteger('xp');

        if (newLevel === null && newXp === null) {
          return interaction.reply({ content: '❌ Debes indicar al menos un valor para nivel o XP.', ephemeral: true });
        }

        const updateData: any = {};
        if (newLevel !== null) {
          if (isText) updateData.textLevel = newLevel;
          else updateData.voiceLevel = newLevel;
        }
        if (newXp !== null) {
          if (isText) updateData.textXp = newXp;
          else updateData.voiceXp = newXp;
        }

        await prisma.userXP.update({
          where: { id: targetId },
          data: updateData
        });

        if (newLevel !== null) {
          const memberObj = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
          if (memberObj) {
            await checkAndAssignLevelRoles(memberObj, type, newLevel);
          }
        }

        return interaction.reply({ content: `✅ Ajustados datos de **${typeLabel}** para **${targetUser.username}**.`, ephemeral: true });
      }

      if (subcommand === 'reset') {
        const updateData: any = {};
        if (isText) {
          updateData.textXp = 0;
          updateData.textLevel = 0;
          updateData.messageCount = 0;
        } else {
          updateData.voiceXp = 0;
          updateData.voiceLevel = 0;
          updateData.vcSeconds = 0;
        }

        await prisma.userXP.update({
          where: { id: targetId },
          data: updateData
        });

        return interaction.reply({ content: `🔄 Se han reiniciado los datos de **${typeLabel}** de **${targetUser.username}**.`, ephemeral: true });
      }
    }

    if (commandName === 'prestigiar') {
      // Check admin permissions
      let isBotAdmin = false;
      const memberPermissions = member?.permissions;
      if (typeof memberPermissions === 'object' && memberPermissions.has('Administrator')) {
        isBotAdmin = true;
      } else {
        const config = await prisma.guildConfig.findUnique({ where: { guildId } });
        if (config?.adminRoleIds && member) {
          const adminRoles = config.adminRoleIds.split(',').map(id => id.trim());
          const memberRoles = (member as any).roles?.cache || new Map();
          if (adminRoles.some(roleId => memberRoles.has(roleId))) {
            isBotAdmin = true;
          }
        }
      }

      if (!isBotAdmin) {
        return interaction.reply({
          content: '❌ No tienes permisos para ejecutar el proceso de prestigio. (Requiere Administrador o Rol Admin del Bot).',
          ephemeral: true
        });
      }

      const targetUser = interaction.options.getUser('usuario', true);
      const targetId = `${guildId}-${targetUser.id}`;

      const userXP = await prisma.userXP.findUnique({ where: { id: targetId } });
      if (!userXP || userXP.textLevel < 100) {
        return interaction.reply({
          content: `❌ **${targetUser.username}** no cumple el requisito para prestigiar. Se requiere **Nivel 100 de Texto** (Nivel actual: **${userXP?.textLevel || 0}**).`,
          ephemeral: true
        });
      }

      const userTotalXp = getTotalXpForLevel(userXP.textLevel) + userXP.textXp;
      const prestigeCostXp = getTotalXpForLevel(100);
      const remainingXpPool = Math.max(0, userTotalXp - prestigeCostXp);
      const { level: carryoverLevel, xp: carryoverXp } = getLevelAndXpFromTotal(remainingXpPool);

      const nextPrestige = (userXP.prestige || 0) + 1;
      const excessInfo = carryoverLevel > 0
        ? `\n• 🎁 Se convertirá toda tu XP sobrante y recomenzarás en el **Nivel ${carryoverLevel}** (con ${carryoverXp.toLocaleString()} XP).`
        : `\n• Tu Nivel de Texto volverá a **Nivel 0**.`;

      const embed = {
        title: `🌟 AVISO DE PRESTIGIO: Nivel de Texto`,
        description: `¡Hola <@${targetUser.id}>! Un miembro del Staff ha iniciado tu proceso de **Prestigio**.\n\n⚠️ **Al confirmar:**\n• Consumirás la XP equivalente al **Nivel 100 de Texto** (coste del Prestigio).${excessInfo}\n• Se reajustarán tus roles por Nivel de Texto.\n• Ascenderás al **Prestigio ${nextPrestige}** y recibirás su rol correspondiente.\n\n*(Tu Nivel de Voz y XP de Voz se mantendrán intactos).*`,
        color: 0xF1C40F,
        thumbnail: { url: targetUser.displayAvatarURL() },
        footer: { text: `Solo ${targetUser.username} puede interactuar con estos botones.` }
      };

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`prestige_confirm_${targetUser.id}`)
          .setLabel('Confirmar Prestigio 🌟')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`prestige_cancel_${targetUser.id}`)
          .setLabel('Cancelar ❌')
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        content: `<@${targetUser.id}>`,
        embeds: [embed],
        components: [row]
      });
    }

    if (commandName === 'pay') {
      const targetUser = interaction.options.getUser('usuario', true);
      const amountStr = interaction.options.getString('cantidad', true);
      const res = await handlePay(guildId, member, targetUser, amountStr);
      return interaction.reply({ content: res });
    }

    if (commandName === 'economy') {
      const isStaff = await isUserStaffOrAdmin(guildId, member);
      if (!isStaff) {
        return interaction.reply({ content: '❌ No tienes permisos de Staff para usar comandos de administración de economía.', ephemeral: true });
      }

      const subcommand = interaction.options.getSubcommand();
      const targetUser = interaction.options.getUser('usuario', true);
      const amountStr = interaction.options.getString('cantidad', true);

      if (subcommand === 'add') {
        const res = await handleAddMoney(guildId, member, targetUser, amountStr);
        return interaction.reply({ content: res });
      } else if (subcommand === 'remove') {
        const res = await handleRemoveMoney(guildId, member, targetUser, amountStr);
        return interaction.reply({ content: res });
      } else if (subcommand === 'set') {
        const res = await handleSetMoney(guildId, member, targetUser, amountStr);
        return interaction.reply({ content: res });
      }
    }

    if (commandName === 'inventory') {
      const targetUser = interaction.options.getUser('usuario') || user;
      const res = await handleInventory(guildId, member, targetUser);
      return interaction.reply(res);
    }

    if (commandName === 'top' || commandName === 'baltop') {
      const res = await handleTopMoney(guildId, member);
      return interaction.reply(res);
    }

    if (commandName === 'gallo') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'comprar') {
        const nombre = interaction.options.getString('nombre') || undefined;
        const res = await handleChickenBuy(guildId, interaction.user.id, nombre);
        return interaction.reply(res);
      }

      if (subcommand === 'entrenar') {
        const galloInput = interaction.options.getString('gallo') || '1';
        const minutos = interaction.options.getInteger('minutos') || 15;
        const res = await handleChickenTrain(guildId, interaction.user.id, galloInput, minutos);
        return interaction.reply(res);
      }

      if (subcommand === 'pelear') {
        const apuesta = interaction.options.getString('apuesta') || '';
        const galloInput = interaction.options.getString('gallo') || '1';
        const res = await handleChickenFight(guildId, interaction.user.id, galloInput, apuesta);
        return interaction.reply(typeof res === 'string' ? res : { embeds: res.embeds });
      }

      // Default: gallinero interactive hub
      const hub = await buildGallineroHub(guildId, interaction.user.id, 'HUB');
      return interaction.reply(hub);
    }
  }

  // Prestige Button interaction
  if (interaction.isButton() && (interaction.customId.startsWith('prestige_confirm_') || interaction.customId.startsWith('prestige_cancel_'))) {
    const isConfirm = interaction.customId.startsWith('prestige_confirm_');
    const targetUserId = interaction.customId.replace('prestige_confirm_', '').replace('prestige_cancel_', '');

    if (interaction.user.id !== targetUserId) {
      return interaction.reply({ content: '❌ Solo la persona a prestigiar puede hacer clic en estos botones.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    if (!guildId) return;

    if (!isConfirm) {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('disabled_confirm').setLabel('Confirmar Prestigio 🌟').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('disabled_cancel').setLabel('Cancelado ❌').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      return interaction.update({
        content: `❌ **Prestigio cancelado por ${interaction.user.username}.**`,
        embeds: [],
        components: [disabledRow]
      });
    }

    const targetId = `${guildId}-${targetUserId}`;
    const userXP = await prisma.userXP.findUnique({ where: { id: targetId } });
    if (!userXP || userXP.textLevel < 100) {
      return interaction.reply({ content: '❌ No cumples el requisito de Nivel 100 de texto para prestigiar.', ephemeral: true });
    }

    const userTotalXp = getTotalXpForLevel(userXP.textLevel) + userXP.textXp;
    const prestigeCostXp = getTotalXpForLevel(100);
    const remainingXpPool = Math.max(0, userTotalXp - prestigeCostXp);
    const { level: carryoverLevel, xp: carryoverXp } = getLevelAndXpFromTotal(remainingXpPool);

    const nextPrestige = (userXP.prestige || 0) + 1;

    // 1. Consume Level 100 XP cost, convert surplus XP to exact level & increase prestige
    await prisma.userXP.update({
      where: { id: targetId },
      data: {
        textLevel: carryoverLevel,
        textXp: carryoverXp,
        prestige: nextPrestige
      }
    });

    // 2. Manage Roles
    const member = await interaction.guild?.members.fetch(targetUserId).catch(() => null);
    if (member) {
      // Remove previous text level roles
      const textRoles = await prisma.levelRole.findMany({
        where: { guildId, type: 'TEXT' }
      });
      for (const r of textRoles) {
        if (member.roles.cache.has(r.roleId)) {
          await member.roles.remove(r.roleId).catch(() => null);
        }
      }

      // Re-assign text level roles for remaining level if any
      if (carryoverLevel > 0) {
        const matchingLevelRoles = textRoles.filter(r => r.level <= carryoverLevel);
        for (const r of matchingLevelRoles) {
          await member.roles.add(r.roleId).catch(() => null);
        }
      }

      // Add prestige role if assigned
      const prestigeRole = await prisma.prestigeRole.findUnique({
        where: {
          guildId_prestigeLevel: {
            guildId,
            prestigeLevel: nextPrestige
          }
        }
      });

      if (prestigeRole && prestigeRole.roleId) {
        await member.roles.add(prestigeRole.roleId).catch(() => null);
      }
    }

    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('disabled_confirm').setLabel('¡Prestigiado! 🌟').setStyle(ButtonStyle.Success).setDisabled(true)
    );

    const levelMsg = carryoverLevel > 0
      ? `Has consumido la XP del **Nivel 100** para el Prestigio y has convertido tu XP acumulada sobrante en el **Nivel ${carryoverLevel}** (${carryoverXp.toLocaleString()} XP)!`
      : `Has alcanzado el **Prestigio ${nextPrestige}**!`;

    const successEmbed = {
      title: `🏆 ¡ASCENSIÓN A PRESTIGIO ${nextPrestige}! 🌟`,
      description: `¡Enhorabuena <@${targetUserId}>!\n\n${levelMsg} 🎉`,
      color: 0xF1C40F,
      thumbnail: { url: interaction.user.displayAvatarURL() },
      timestamp: new Date().toISOString()
    };

    return interaction.update({
      content: `🎉 **¡NUEVO PRESTIGIO EN EL SERVIDOR!**`,
      embeds: [successEmbed],
      components: [disabledRow]
    });
  }

  // Handle Clan Buttons & Select Menu Interactions
  await handleClanInteraction(interaction);
});

// Express API Server Setup
const app = express();
app.set('trust proxy', 1);

// ─────────────────────────────────────────────────────────────────────────SECURITY: CORS 
const ALLOWED_ORIGINS: string[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.DISCORD_REDIRECT_URI ? [process.env.DISCORD_REDIRECT_URI.replace(/\/$/, '')] : []),
  ...(process.env.DASHBOARD_URL ? [process.env.DASHBOARD_URL.replace(/\/$/, '')] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin (same-origin, curl, etc.) or known origins
    if (!origin || ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origen no permitido: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─────────────────────────────────────────────────────────────────────────SECURITY: HTTP Security Headers 
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // Only set HSTS in production (not on localhost)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────SECURITY: Rate Limiting 
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máximo 20 intentos de login por IP en 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.' },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 120, // 120 peticiones por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite de peticiones superado. Intenta de nuevo en un momento.' },
});

app.use('/api/', apiLimiter);

app.use(express.json({ limit: '1mb' }));

// ─────────────────────────────────────────────────────────────────────────API HELPERS 
/**
 * Valida que un string sea un Snowflake de Discord válido (17-20 dígitos numéricos).
 */
function isValidSnowflake(id: string): boolean {
  return /^\d{17,20}$/.test(id);
}

/**
 * Parsea y valida un entero dentro de [min, max]. Devuelve undefined si el valor es inválido.
 */
function sanitizeConfigInt(val: any, min: number, max: number): number | undefined {
  if (val === undefined || val === null) return undefined;
  const n = parseInt(val, 10);
  if (isNaN(n)) return undefined;
  return Math.min(Math.max(n, min), max);
}

function sanitizeConfigFloat(val: any, min: number, max: number): number | undefined {
  if (val === undefined || val === null) return undefined;
  const n = parseFloat(val);
  if (isNaN(n)) return undefined;
  return Math.min(Math.max(n, min), max);
}

// ─────────────────────────────────────────────────────────────────────────AUTHENTICATION SYSTEM & SESSIONS 
interface AuthUser {
  id: string;
  username: string;
  global_name?: string;
  avatar?: string;
  avatarUrl?: string;
  discriminator?: string;
}

interface AuthSession {
  token: string;
  user: AuthUser;
  adminGuilds: string[];
  createdAt: number;
}

const authSessions = new Map<string, AuthSession>();
const oauthStateStore = new Map<string, { createdAt: number }>(); // CVE-11: CSRF state nonces

// SESSION_TTL: 24h (CVE-12: reduced from 7 days)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// Cleanup expired sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of authSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      authSessions.delete(token);
    }
  }
  // Cleanup expired OAuth state nonces (5 min TTL)
  for (const [state, entry] of oauthStateStore.entries()) {
    if (now - entry.createdAt > 5 * 60 * 1000) {
      oauthStateStore.delete(state);
    }
  }
}, 60 * 60 * 1000);

function getAuthSession(req: express.Request): AuthSession | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return authSessions.get(token) || null;
}

// Middleware to enforce Administrator authorization for guild mutations
function requireGuildAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = getAuthSession(req);
  if (!session) {
    return res.status(401).json({ error: '401 No Autorizado: Debes iniciar sesión con Discord.' });
  }

  const { guildId } = req.params;
  if (guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Servidor no encontrado en la caché del bot.' });
    }

    const member = session.user?.id ? guild.members.cache.get(session.user.id) : null;
    const isDiscordAdmin = member ? member.permissions.has(PermissionFlagsBits.Administrator) || guild.ownerId === session.user.id : false;
    const isAuthorized = session.adminGuilds.includes(guildId) || isDiscordAdmin;

    if (!isAuthorized && session.adminGuilds.length > 0) {
      return res.status(403).json({ error: '403 Prohibido: No posees permisos de Administrador en este servidor.' });
    }
  }

  next();
}

// ─────────────────────────────────────────────────────────────────────────AUTH API ENDPOINTS 

// GET /api/auth/login-url (CVE-9: auth rate limiter | CVE-11: state nonce | CVE-13: CLIENT_ID required)
app.get('/api/auth/login-url', authLimiter, (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'Error de configuración del servidor: DISCORD_CLIENT_ID no definido.' });
  }

  // CVE-7: Use only the whitelisted redirectUri from .env — ignore client input
  const redirectUri = (process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173').replace(/\/$/, '');

  // CVE-11: Generate a CSRF state nonce
  const state = crypto.randomBytes(16).toString('hex');
  oauthStateStore.set(state, { createdAt: Date.now() });

  const scope = encodeURIComponent('identify guilds');
  const loginUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`;

  res.json({ loginUrl, redirectUri, state });
});

// POST /api/auth/callback (CVE-9: rate limiter | CVE-7: fixed redirectUri | CVE-11: state validation)
app.post('/api/auth/callback', authLimiter, async (req, res) => {
  const { code, state } = req.body;
  if (!code) return res.status(400).json({ error: 'Código de autorización requerido.' });

  // CVE-11: Validate OAuth state nonce to prevent CSRF
  if (!state || !oauthStateStore.has(state)) {
    return res.status(400).json({ error: 'Estado OAuth inválido o expirado. Inicia el proceso de login de nuevo.' });
  }
  oauthStateStore.delete(state); // One-time use

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Error de configuración del servidor.' });
  }

  // CVE-7: Always use the server-side whitelisted redirectUri, never trust client input
  const targetRedirectUri = (process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173').replace(/\/$/, '');

  try {
    if (true) { // clientSecret always required now (validated above)
      const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code.toString(),
        redirect_uri: targetRedirectUri,
      });

      const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error('[OAuth2] Error al canjear código:', errText);
        return res.status(400).json({ error: 'Error al autenticar con Discord.' });
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Fetch user profile
      const userRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData: AuthUser = await userRes.json();

      // Fetch user's guilds
      const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userGuilds: any[] = await guildsRes.json();

      // Filter guilds where user has Administrator (0x8), Manage Guild (0x20), or is Owner
      const adminGuildIds = Array.isArray(userGuilds)
        ? userGuilds
          .filter(g => {
            const perms = BigInt(g.permissions || 0);
            const isAdmin = (perms & BigInt(0x8)) !== BigInt(0) || (perms & BigInt(0x20)) !== BigInt(0) || g.owner;
            return isAdmin && client.guilds.cache.has(g.id);
          })
          .map(g => g.id)
        : [];

      const avatarUrl = userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';

      const userProfile = {
        ...userData,
        avatarUrl,
      };

      const sessionToken = 'sess_' + crypto.randomBytes(32).toString('hex');
      const sessionObj: AuthSession = {
        token: sessionToken,
        user: userProfile,
        adminGuilds: adminGuildIds,
        createdAt: Date.now(),
      };

      authSessions.set(sessionToken, sessionObj);

      return res.json({
        token: sessionToken,
        user: userProfile,
        adminGuilds: adminGuildIds,
      });
    }
  } catch (err: any) {
    console.error('[OAuth2] Excepción durante callback:', err);
    // CVE-8: Never leak internal error details
    res.status(500).json({ error: 'Error interno al procesar la autenticación. Inténtalo de nuevo.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  const session = getAuthSession(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });

  const validAdminGuilds = session.adminGuilds.filter(id => client.guilds.cache.has(id));

  res.json({
    user: session.user,
    adminGuilds: validAdminGuilds,
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    authSessions.delete(token);
  }
  res.json({ success: true });
});

// API Endpoints
app.get('/api/guilds', (req, res) => {
  const session = getAuthSession(req);
  if (!session) {
    return res.status(401).json({ error: '401 No Autorizado: Debes autenticarte con Discord.' });
  }

  let guilds = client.guilds.cache.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png',
    memberCount: g.memberCount,
  }));

  if (session.adminGuilds && session.adminGuilds.length >= 0) {
    guilds = guilds.filter(g => session.adminGuilds.includes(g.id));
  }

  res.json(guilds);
});

// Endpoint to fetch real server structure (CVE-4: auth required)
app.get('/api/guilds/:guildId/structure', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const guild = client.guilds.cache.get(guildId);

  if (!guild) {
    return res.status(404).json({ error: 'Servidor no encontrado en la caché del bot.' });
  }

  try {
    // Fetch channels and roles
    const channels = await guild.channels.fetch();
    const roles = await guild.roles.fetch();

    const textChannels = channels
      .filter(c => c && c.isTextBased() && !c.isThread())
      .map(c => ({ id: c!.id, name: c!.name }));

    const voiceChannels = channels
      .filter(c => c && c.isVoiceBased())
      .map(c => ({ id: c!.id, name: c!.name }));

    const categories = channels
      .filter(c => c && c.type === 4) // 4 = GuildCategory
      .map(c => ({ id: c!.id, name: c!.name }));

    const formattedRoles = roles
      .filter(r => r.name !== '@everyone')
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));

    res.json({
      textChannels,
      voiceChannels,
      categories,
      roles: formattedRoles,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener la estructura del servidor.' });
  }
});

// CVE-4: auth required
app.get('/api/guilds/:guildId/config', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  let config = await prisma.guildConfig.findUnique({
    where: { guildId },
  });

  if (!config) {
    config = await prisma.guildConfig.create({
      data: { guildId },
    });
  }

  const levelRoles = await prisma.levelRole.findMany({
    where: { guildId },
    orderBy: { level: 'asc' },
  });

  const prestigeRoles = await prisma.prestigeRole.findMany({
    where: { guildId },
    orderBy: { prestigeLevel: 'asc' },
  });

  const roleIncomes = await prisma.roleIncome.findMany({
    where: { guildId },
    orderBy: { incomeAmount: 'desc' },
  });

  const shopRoles = await prisma.shopRole.findMany({
    where: { guildId },
    orderBy: { price: 'asc' },
  });

  const shopItems = await prisma.shopItem.findMany({
    where: { guildId },
    orderBy: { price: 'asc' },
  });

  res.json({ ...config, levelRoles, prestigeRoles, roleIncomes, shopRoles, shopItems });
});

app.route('/api/guilds/:guildId/config')
  .all(requireGuildAdmin)
  .post(handleSaveConfig)
  .put(handleSaveConfig);

async function handleSaveConfig(req: any, res: any) {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const {
    levelingEnabled,
    tempVcEnabled,
    clansEnabled,
    tempVcChannelId,
    minXpPerMessage,
    maxXpPerMessage,
    xpCooldownSeconds,
    xpPerMinuteVc,
    levelUpChannelId,
    levelUpMessage,
    ignoredChannels,
    ignoredRoles,
    adminRoleIds,
    verifiedRoleId,
    seasonWinnerRoleId,
    commandsChannelId,
    economyEnabled,
    currencySymbol,
    workMinPayout,
    workMaxPayout,
    workCooldownSec,
    robCooldownSec,
    robMinPercent,
    robMaxPercent,
    casinoChannels,
    crimeMinPayout,
    crimeMaxPayout,
    crimeCooldownSec,
    slutMinPayout,
    slutMaxPayout,
    slutCooldownSec,
    chickenCost,
    piensoCost,
    piensoDurationMins,
    piensoBoostPercent,
    medkitCost,
    bandageCost,
    vitaminCost,
    vitaminBoostPercent,
    cageCost,
    cageCapacityLvl2Cost,
    cageCapacityLvl3Cost,
    cageMuscleLvl1Cost,
    cageMuscleLvl2Cost,
    cageMuscleLvl3Cost,
    cageCardioLvl1Cost,
    cageCardioLvl2Cost,
    cageCardioLvl3Cost,
    cagePhysioLvl1Cost,
    cagePhysioLvl2Cost,
    chickenMinBirthWinRate,
    chickenMaxBirthWinRate,
    chickenInjuryMins,
    chickenInjuryChance,
    chickenNames,
    incomeIntervalHours,
    workMessages,
    crimeMessages,
    crimeFailMessages,
    slutMessages,
    slutFailMessages,
    casinoLogChannelId,
    slotMachineDifficulty,
    startingBalance,
    clansCategoryId,
    clanLeaderRoleId,
    monthlyClanHoursGoal,
    clanGoalMode,
    clanHoursPerMember,
    clanCoinsPerHour,
    clanCurrencyName,
    clansLogChannelId,
    birthdayRoleId,
    birthdayChannelId,
    birthdayMessage,
    birthdayEnabled,
  } = req.body;

  const config = await prisma.guildConfig.upsert({
    where: { guildId },
    update: {
      levelingEnabled,
      tempVcEnabled,
      clansEnabled: typeof clansEnabled === 'boolean' ? clansEnabled : undefined,
      tempVcChannelId,
      minXpPerMessage: sanitizeConfigInt(minXpPerMessage, 1, 500),
      maxXpPerMessage: sanitizeConfigInt(maxXpPerMessage, 1, 500),
      xpCooldownSeconds: sanitizeConfigInt(xpCooldownSeconds, 1, 86400),
      xpPerMinuteVc: sanitizeConfigInt(xpPerMinuteVc, 0, 1000),
      levelUpChannelId,
      levelUpMessage,
      ignoredChannels,
      ignoredRoles,
      adminRoleIds,
      verifiedRoleId,
      seasonWinnerRoleId: seasonWinnerRoleId || null,
      commandsChannelId,
      economyEnabled,
      currencySymbol,
      workMinPayout: sanitizeConfigInt(workMinPayout, 0, 100_000_000),
      workMaxPayout: sanitizeConfigInt(workMaxPayout, 0, 100_000_000),
      workCooldownSec: sanitizeConfigInt(workCooldownSec, 1, 86400),
      crimeMinPayout: sanitizeConfigInt(crimeMinPayout, 0, 100_000_000),
      crimeMaxPayout: sanitizeConfigInt(crimeMaxPayout, 0, 100_000_000),
      crimeCooldownSec: sanitizeConfigInt(crimeCooldownSec, 1, 86400),
      slutMinPayout: sanitizeConfigInt(slutMinPayout, 0, 100_000_000),
      slutMaxPayout: sanitizeConfigInt(slutMaxPayout, 0, 100_000_000),
      slutCooldownSec: sanitizeConfigInt(slutCooldownSec, 1, 86400),
      robCooldownSec: sanitizeConfigInt(robCooldownSec, 1, 86400),
      robMinPercent: sanitizeConfigInt(robMinPercent, 1, 100) ?? 20,
      robMaxPercent: sanitizeConfigInt(robMaxPercent, 1, 100) ?? 80,
      chickenCost: sanitizeConfigInt(chickenCost, 0, 1_000_000_000),
      piensoCost: sanitizeConfigInt(piensoCost, 0, 1_000_000_000),
      piensoDurationMins: sanitizeConfigInt(piensoDurationMins, 1, 1440),
      piensoBoostPercent: sanitizeConfigInt(piensoBoostPercent, 1, 100),
      medkitCost: sanitizeConfigInt(medkitCost, 0, 1_000_000_000),
      bandageCost: sanitizeConfigInt(bandageCost, 0, 1_000_000_000),
      vitaminCost: sanitizeConfigInt(vitaminCost, 0, 1_000_000_000),
      vitaminBoostPercent: sanitizeConfigInt(vitaminBoostPercent, 1, 100),
      cageCost: sanitizeConfigInt(cageCost, 0, 1_000_000_000),
      cageCapacityLvl2Cost: sanitizeConfigInt(cageCapacityLvl2Cost, 0, 1_000_000_000),
      cageCapacityLvl3Cost: sanitizeConfigInt(cageCapacityLvl3Cost, 0, 1_000_000_000),
      cageMuscleLvl1Cost: sanitizeConfigInt(cageMuscleLvl1Cost, 0, 1_000_000_000),
      cageMuscleLvl2Cost: sanitizeConfigInt(cageMuscleLvl2Cost, 0, 1_000_000_000),
      cageMuscleLvl3Cost: sanitizeConfigInt(cageMuscleLvl3Cost, 0, 1_000_000_000),
      cageCardioLvl1Cost: sanitizeConfigInt(cageCardioLvl1Cost, 0, 1_000_000_000),
      cageCardioLvl2Cost: sanitizeConfigInt(cageCardioLvl2Cost, 0, 1_000_000_000),
      cageCardioLvl3Cost: sanitizeConfigInt(cageCardioLvl3Cost, 0, 1_000_000_000),
      cagePhysioLvl1Cost: sanitizeConfigInt(cagePhysioLvl1Cost, 0, 1_000_000_000),
      cagePhysioLvl2Cost: sanitizeConfigInt(cagePhysioLvl2Cost, 0, 1_000_000_000),
      chickenMinBirthWinRate: sanitizeConfigFloat(chickenMinBirthWinRate, 0, 100),
      chickenMaxBirthWinRate: sanitizeConfigFloat(chickenMaxBirthWinRate, 0, 100),
      chickenInjuryMins: sanitizeConfigInt(chickenInjuryMins, 1, 1440),
      chickenInjuryChance: sanitizeConfigInt(chickenInjuryChance, 0, 100),
      chickenNames: typeof chickenNames === 'string' ? chickenNames : undefined,
      incomeIntervalHours: sanitizeConfigInt(incomeIntervalHours, 1, 720),
      casinoChannels,
      workMessages,
      crimeMessages,
      crimeFailMessages,
      slutMessages,
      slutFailMessages,
      casinoLogChannelId,
      slotMachineDifficulty,
      startingBalance: sanitizeConfigInt(startingBalance, 0, 1_000_000_000),
      clansCategoryId: clansCategoryId || null,
      clanLeaderRoleId: clanLeaderRoleId || null,
      monthlyClanHoursGoal: sanitizeConfigInt(monthlyClanHoursGoal, 1, 10000),
      clanGoalMode: clanGoalMode === 'PER_MEMBER' ? 'PER_MEMBER' : 'FIXED',
      clanHoursPerMember: sanitizeConfigInt(clanHoursPerMember, 1, 1000) ?? 10,
      clanCoinsPerHour: typeof clanCoinsPerHour === 'number' && clanCoinsPerHour >= 0 ? clanCoinsPerHour : 0.5,
      clanCurrencyName: typeof clanCurrencyName === 'string' && clanCurrencyName.trim() ? clanCurrencyName.trim() : 'GloriCoins',
      clansLogChannelId: clansLogChannelId || null,
      birthdayRoleId: birthdayRoleId || null,
      birthdayChannelId: birthdayChannelId || null,
      birthdayMessage: typeof birthdayMessage === 'string' ? birthdayMessage : undefined,
      birthdayEnabled: typeof birthdayEnabled === 'boolean' ? birthdayEnabled : undefined,
    },
    create: {
      guildId,
      levelingEnabled,
      tempVcEnabled,
      clansEnabled: typeof clansEnabled === 'boolean' ? clansEnabled : true,
      tempVcChannelId,
      minXpPerMessage: sanitizeConfigInt(minXpPerMessage, 1, 500) ?? 15,
      maxXpPerMessage: sanitizeConfigInt(maxXpPerMessage, 1, 500) ?? 25,
      xpCooldownSeconds: sanitizeConfigInt(xpCooldownSeconds, 1, 86400) ?? 60,
      xpPerMinuteVc: sanitizeConfigInt(xpPerMinuteVc, 0, 1000) ?? 10,
      levelUpChannelId,
      levelUpMessage,
      ignoredChannels,
      ignoredRoles,
      adminRoleIds,
      verifiedRoleId,
      seasonWinnerRoleId: seasonWinnerRoleId || null,
      commandsChannelId,
      economyEnabled,
      currencySymbol,
      workMinPayout: sanitizeConfigInt(workMinPayout, 0, 100_000_000) ?? 1000,
      workMaxPayout: sanitizeConfigInt(workMaxPayout, 0, 100_000_000) ?? 5000,
      workCooldownSec: sanitizeConfigInt(workCooldownSec, 1, 86400) ?? 30,
      crimeMinPayout: sanitizeConfigInt(crimeMinPayout, 0, 100_000_000) ?? 1500,
      crimeMaxPayout: sanitizeConfigInt(crimeMaxPayout, 0, 100_000_000) ?? 5500,
      crimeCooldownSec: sanitizeConfigInt(crimeCooldownSec, 1, 86400) ?? 30,
      slutMinPayout: sanitizeConfigInt(slutMinPayout, 0, 100_000_000) ?? 1200,
      slutMaxPayout: sanitizeConfigInt(slutMaxPayout, 0, 100_000_000) ?? 4700,
      slutCooldownSec: sanitizeConfigInt(slutCooldownSec, 1, 86400) ?? 30,
      robCooldownSec: sanitizeConfigInt(robCooldownSec, 1, 86400) ?? 300,
      chickenCost: sanitizeConfigInt(chickenCost, 0, 1_000_000_000) ?? 5000,
      piensoCost: sanitizeConfigInt(piensoCost, 0, 1_000_000_000) ?? 3000,
      piensoDurationMins: sanitizeConfigInt(piensoDurationMins, 1, 1440) ?? 30,
      piensoBoostPercent: sanitizeConfigInt(piensoBoostPercent, 1, 100) ?? 10,
      medkitCost: sanitizeConfigInt(medkitCost, 0, 1_000_000_000) ?? 2500,
      bandageCost: sanitizeConfigInt(bandageCost, 0, 1_000_000_000) ?? 5000,
      vitaminCost: sanitizeConfigInt(vitaminCost, 0, 1_000_000_000) ?? 2500,
      vitaminBoostPercent: sanitizeConfigInt(vitaminBoostPercent, 1, 100) ?? 15,
      cageCost: sanitizeConfigInt(cageCost, 0, 1_000_000_000) ?? 15000,
      cageCapacityLvl2Cost: sanitizeConfigInt(cageCapacityLvl2Cost, 0, 1_000_000_000) ?? 40000,
      cageCapacityLvl3Cost: sanitizeConfigInt(cageCapacityLvl3Cost, 0, 1_000_000_000) ?? 80000,
      cageMuscleLvl1Cost: sanitizeConfigInt(cageMuscleLvl1Cost, 0, 1_000_000_000) ?? 15000,
      cageMuscleLvl2Cost: sanitizeConfigInt(cageMuscleLvl2Cost, 0, 1_000_000_000) ?? 35000,
      cageMuscleLvl3Cost: sanitizeConfigInt(cageMuscleLvl3Cost, 0, 1_000_000_000) ?? 70000,
      cageCardioLvl1Cost: sanitizeConfigInt(cageCardioLvl1Cost, 0, 1_000_000_000) ?? 10000,
      cageCardioLvl2Cost: sanitizeConfigInt(cageCardioLvl2Cost, 0, 1_000_000_000) ?? 25000,
      cageCardioLvl3Cost: sanitizeConfigInt(cageCardioLvl3Cost, 0, 1_000_000_000) ?? 50000,
      cagePhysioLvl1Cost: sanitizeConfigInt(cagePhysioLvl1Cost, 0, 1_000_000_000) ?? 20000,
      cagePhysioLvl2Cost: sanitizeConfigInt(cagePhysioLvl2Cost, 0, 1_000_000_000) ?? 45000,
      chickenMinBirthWinRate: sanitizeConfigFloat(chickenMinBirthWinRate, 0, 100) ?? 30.0,
      chickenMaxBirthWinRate: sanitizeConfigFloat(chickenMaxBirthWinRate, 0, 100) ?? 55.0,
      chickenInjuryMins: sanitizeConfigInt(chickenInjuryMins, 1, 1440) ?? 5,
      chickenInjuryChance: sanitizeConfigInt(chickenInjuryChance, 0, 100) ?? 25,
      chickenNames: typeof chickenNames === 'string' ? chickenNames : undefined,
      incomeIntervalHours: sanitizeConfigInt(incomeIntervalHours, 1, 720) ?? 3,
      casinoChannels,
      workMessages,
      crimeMessages,
      crimeFailMessages,
      slutMessages,
      slutFailMessages,
      casinoLogChannelId,
      slotMachineDifficulty: slotMachineDifficulty || 'NORMAL',
      startingBalance: sanitizeConfigInt(startingBalance, 0, 1_000_000_000) ?? 1000,
      clansCategoryId: clansCategoryId || null,
      clanLeaderRoleId: clanLeaderRoleId || null,
      monthlyClanHoursGoal: sanitizeConfigInt(monthlyClanHoursGoal, 1, 10000) ?? 50,
      clanGoalMode: clanGoalMode === 'PER_MEMBER' ? 'PER_MEMBER' : 'FIXED',
      clanHoursPerMember: sanitizeConfigInt(clanHoursPerMember, 1, 1000) ?? 10,
      clanCoinsPerHour: typeof clanCoinsPerHour === 'number' && clanCoinsPerHour >= 0 ? clanCoinsPerHour : 0.5,
      clanCurrencyName: typeof clanCurrencyName === 'string' && clanCurrencyName.trim() ? clanCurrencyName.trim() : 'GloriCoins',
      clansLogChannelId: clansLogChannelId || null,
      birthdayRoleId: birthdayRoleId || null,
      birthdayChannelId: birthdayChannelId || null,
      birthdayMessage: typeof birthdayMessage === 'string' ? birthdayMessage : "🎉 ¡Feliz cumpleaños {user}! Que pases un gran día.",
      birthdayEnabled: typeof birthdayEnabled === 'boolean' ? birthdayEnabled : true,
    },
  });

  res.json({ success: true, config });
}

// Level Roles endpoints
app.post('/api/guilds/:guildId/level-roles', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const { level, roleId, type } = req.body;

  const roleType = type === 'VOICE' ? 'VOICE' : 'TEXT';

  if (!level || !roleId) {
    return res.status(400).json({ error: 'Nivel y RoleId son requeridos' });
  }

  const levelRole = await prisma.levelRole.upsert({
    where: {
      guildId_type_level: {
        guildId,
        type: roleType,
        level: parseInt(level, 10),
      },
    },
    update: { roleId },
    create: {
      guildId,
      type: roleType,
      level: parseInt(level, 10),
      roleId,
    },
  });

  res.json({ success: true, levelRole });
});

app.delete(['/api/guilds/:guildId/level-roles', '/api/guilds/:guildId/level-roles/:type/:level'], requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const targetType = req.params.type || req.body?.type;
  const targetLevel = req.params.level || req.body?.level;
  const targetRoleId = req.body?.roleId;

  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const roleType = targetType === 'VOICE' ? 'VOICE' : 'TEXT';

  await prisma.levelRole.deleteMany({
    where: {
      guildId,
      type: roleType,
      ...(targetLevel !== undefined && { level: parseInt(targetLevel, 10) }),
      ...(targetRoleId && { roleId: targetRoleId }),
    },
  });

  res.json({ success: true });
});

// Prestige Roles endpoints
app.post('/api/guilds/:guildId/prestige-roles', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const { prestigeLevel, roleId } = req.body;

  if (!prestigeLevel || !roleId) {
    return res.status(400).json({ error: 'Nivel de Prestigio y RoleId son requeridos' });
  }

  const prestigeRole = await prisma.prestigeRole.upsert({
    where: {
      guildId_prestigeLevel: {
        guildId,
        prestigeLevel: parseInt(prestigeLevel, 10),
      },
    },
    update: { roleId },
    create: {
      guildId,
      prestigeLevel: parseInt(prestigeLevel, 10),
      roleId,
    },
  });

  res.json({ success: true, prestigeRole });
});

app.delete('/api/guilds/:guildId/prestige-roles/:id', requireGuildAdmin, async (req, res) => {
  const { guildId, id } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  await prisma.prestigeRole.deleteMany({
    where: { guildId, id },
  });

  res.json({ success: true });
});

// Role Income Endpoints
app.post(['/api/guilds/:guildId/role-incomes', '/api/guilds/:guildId/economy/role-incomes'], requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const { roleId, incomeAmount, intervalHours, isSeasonal } = req.body;

  if (!roleId || incomeAmount === undefined) {
    return res.status(400).json({ error: 'RoleId e IncomeAmount son requeridos' });
  }

  const hours = intervalHours ? parseInt(intervalHours, 10) : 3;
  const seasonal = isSeasonal !== undefined ? Boolean(isSeasonal) : true;

  const roleIncome = await prisma.roleIncome.upsert({
    where: {
      guildId_roleId: {
        guildId,
        roleId,
      },
    },
    update: {
      incomeAmount: parseInt(incomeAmount, 10),
      intervalHours: hours,
      isSeasonal: seasonal,
    },
    create: {
      guildId,
      roleId,
      incomeAmount: parseInt(incomeAmount, 10),
      intervalHours: hours,
      isSeasonal: seasonal,
    },
  });

  res.json({ success: true, roleIncome });
});

app.delete(['/api/guilds/:guildId/role-incomes/:id', '/api/guilds/:guildId/economy/role-incomes/:id'], requireGuildAdmin, async (req, res) => {
  const { guildId, id } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  await prisma.roleIncome.deleteMany({
    where: { guildId, id },
  });

  res.json({ success: true });
});

// Shop Roles Endpoints
app.post(['/api/guilds/:guildId/shop-roles', '/api/guilds/:guildId/economy/shop-roles'], requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const { roleId, price, description, icon } = req.body;

  if (!roleId || price === undefined) {
    return res.status(400).json({ error: 'RoleId y Price son requeridos' });
  }

  const shopRole = await prisma.shopRole.upsert({
    where: {
      guildId_roleId: {
        guildId,
        roleId,
      },
    },
    update: {
      price: parseInt(price, 10),
      description: description || '',
      icon: icon || '🛒',
    },
    create: {
      guildId,
      roleId,
      price: parseInt(price, 10),
      description: description || '',
      icon: icon || '🛒',
    },
  });

  res.json({ success: true, shopRole });
});

app.delete(['/api/guilds/:guildId/shop-roles/:id', '/api/guilds/:guildId/economy/shop-roles/:id'], requireGuildAdmin, async (req, res) => {
  const { guildId, id } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  await prisma.shopRole.deleteMany({
    where: { guildId, id },
  });

  res.json({ success: true });
});

// Shop Collectible Items Endpoints
app.post(['/api/guilds/:guildId/shop-items', '/api/guilds/:guildId/economy/shop-items'], requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const { name, price, description, icon, rarity, isSeasonal } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Nombre y Precio son requeridos' });
  }

  const shopItem = await prisma.shopItem.create({
    data: {
      guildId,
      name: name.trim(),
      price: parseInt(price, 10),
      description: description || '',
      icon: icon || '🎒',
      rarity: rarity || 'Común',
      isSeasonal: isSeasonal !== undefined ? Boolean(isSeasonal) : true,
    },
  });

  res.json({ success: true, shopItem });
});

app.delete(['/api/guilds/:guildId/shop-items/:id', '/api/guilds/:guildId/economy/shop-items/:id'], requireGuildAdmin, async (req, res) => {
  const { guildId, id } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const purge = req.query.purge === 'true';

  if (purge) {
    await prisma.shopItem.deleteMany({
      where: { guildId, id },
    });
    await prisma.userInventory.deleteMany({
      where: { guildId, shopItemId: id },
    });
  } else {
    // Retire from shop (Limited Edition): keeps item intact in user inventories!
    await prisma.shopItem.updateMany({
      where: { guildId, id },
      data: { isAvailable: false },
    });
  }

  res.json({ success: true });
});

// Advanced Season Reset Endpoint
app.post(['/api/guilds/:guildId/season-reset', '/api/guilds/:guildId/economy/season-reset', '/api/guilds/:guildId/economy/reset-season'], requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const { roleUpdates, roleEdits } = req.body || {};

  try {
    const guild = client.guilds.cache.get(guildId);

    // Normalize updates list from either roleUpdates (Array) or roleEdits (Record)
    const updatesList: Array<{
      roleId: string;
      name?: string;
      color?: string;
      icon?: string;
      price?: number;
      description?: string;
      incomeAmount?: number;
    }> = [];

    if (Array.isArray(roleUpdates)) {
      updatesList.push(...roleUpdates);
    } else if (roleEdits && typeof roleEdits === 'object') {
      for (const [rId, val] of Object.entries(roleEdits)) {
        if (val && typeof val === 'object') {
          updatesList.push({ roleId: rId, ...(val as any) });
        }
      }
    }

    // 1. Rename & Recolor seasonal roles in Discord & Update DB properties (Icon, Price, Description, Income)
    for (const update of updatesList) {
      if (!update.roleId) continue;

      if (guild) {
        const role = guild.roles.cache.get(update.roleId);
        if (role) {
          const editData: { name?: string; color?: any } = {};
          if (update.name && update.name.trim() !== '') editData.name = update.name.trim();
          if (update.color && update.color.trim() !== '') editData.color = update.color.trim();
          if (Object.keys(editData).length > 0) {
            await role.edit(editData).catch(() => null);
          }
        }
      }

      // Update ShopRole properties if specified
      if (update.icon !== undefined || update.price !== undefined || update.description !== undefined) {
        await prisma.shopRole.updateMany({
          where: { guildId, roleId: update.roleId },
          data: {
            ...(update.icon && { icon: update.icon.trim() }),
            ...(typeof update.price === 'number' && update.price >= 0 && { price: update.price }),
            ...(update.description !== undefined && { description: update.description.trim() }),
          },
        });
      }

      // Update RoleIncome properties if specified
      if (update.incomeAmount !== undefined) {
        await prisma.roleIncome.updateMany({
          where: { guildId, roleId: update.roleId },
          data: {
            ...(typeof update.incomeAmount === 'number' && update.incomeAmount >= 0 && { incomeAmount: update.incomeAmount }),
          },
        });
      }
    }

    // 2. Fetch SEASONAL RoleIncomes AND ALL ShopRoles (all shop roles are seasonal)
    const seasonalRoleIncomes = await prisma.roleIncome.findMany({
      where: { guildId, isSeasonal: true },
    });
    const shopRoles = await prisma.shopRole.findMany({
      where: { guildId },
    });

    // Deduplicate role IDs from both seasonal incomes and shop roles
    const seasonalRoleIds = Array.from(new Set([
      ...seasonalRoleIncomes.map(r => r.roleId),
      ...shopRoles.map(r => r.roleId),
    ]));

    // 3. Strip ALL seasonal & shop roles from members (PERMANENT roles are 100% untouched)
    if (guild && seasonalRoleIds.length > 0) {
      await guild.members.fetch().catch(() => null);
      for (const [, member] of guild.members.cache) {
        for (const rId of seasonalRoleIds) {
          if (member.roles.cache.has(rId)) {
            await member.roles.remove(rId).catch(() => null);
          }
        }
      }
    }

    // 4. Award Season Winner Role if configured (before resetting balances!)
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    let winnerAnnouncement = '';

    if (config?.seasonWinnerRoleId) {
      const topUser = await prisma.userEconomy.findFirst({
        where: { guildId },
        orderBy: [
          { cash: 'desc' },
        ],
      });

      if (guild && topUser) {
        const role = guild.roles.cache.get(config.seasonWinnerRoleId);
        if (role) {
          await guild.members.fetch().catch(() => null);
          for (const [, member] of role.members) {
            if (member.id !== topUser.userId) {
              await member.roles.remove(role).catch(() => null);
            }
          }
          const winnerMember = guild.members.cache.get(topUser.userId);
          if (winnerMember) {
            await winnerMember.roles.add(role).catch(() => null);
            winnerAnnouncement = ` 🏆† **Rol de Ganador de Temporada** asignado a **${winnerMember.displayName}** con ${topUser.cash.toLocaleString()} ${config.currencySymbol || '💵'}.`;
          }
        }
      }
    }

    // 5. Reset cash & bank of all users in guild based on config.startingBalance
    const startCash = config?.startingBalance ?? 1000;

    await prisma.userEconomy.updateMany({
      where: { guildId },
      data: {
        cash: startCash,
        bank: 0,
        hasChicken: false,
      },
    });

    // 5. Clear per-role cooldowns for fresh season start
    await prisma.userRoleIncomeCooldown.deleteMany({
      where: { guildId },
    });

    // 6. Reset all GalloRPG progress for fresh season start (chickens & gym upgrades)
    await prisma.chicken.deleteMany({
      where: { guildId },
    });

    await prisma.userCage.deleteMany({
      where: { guildId },
    });

    res.json({ success: true, message: `¡La nueva temporada ha sido iniciada con éxito! Se han reseteado los saldos, los roles de temporada, el gimnasio y los gallos de todos los usuarios.${winnerAnnouncement}` });
  } catch (err: any) {
    console.error('Error during season reset:', err);
    res.status(500).json({ error: 'Error al procesar el reinicio de temporada: ' + err.message });
  }
});

// CVE-4: auth required
app.get('/api/guilds/:guildId/leaderboard', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const leaderboard = await prisma.userXP.findMany({
    where: { guildId },
    orderBy: [
      { textLevel: 'desc' },
      { textXp: 'desc' },
    ],
    take: 50,
  });

  // Hydrate user info from Discord client cache if available
  const guild = client.guilds.cache.get(guildId);
  const hydrated = await Promise.all(
    leaderboard.map(async (entry) => {
      let displayName = 'Usuario';
      let avatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
      try {
        if (guild) {
          const member = await guild.members.fetch(entry.userId);
          displayName = member.displayName;
          avatar = member.user.displayAvatarURL() || avatar;
        }
      } catch { }
      return {
        ...entry,
        displayName,
        avatar,
      };
    })
  );

  res.json(hydrated);
});

// CVE-4: auth required
app.get('/api/guilds/:guildId/stats', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  const guild = client.guilds.cache.get(guildId);

  const activeTempVcs = await prisma.tempChannel.count({
    where: { guildId },
  });

  const levelUsersCount = await prisma.userXP.count({
    where: { guildId },
  });

  res.json({
    memberCount: guild?.memberCount || 0,
    activeTempChannels: activeTempVcs,
    registeredUsersCount: levelUsersCount,
    name: guild?.name || 'Servidor de Discord',
  });
});

// ─────────────────────────────────────────────────────────────────────────CLANS API ENDPOINTS 
// CVE-4: auth required
app.get('/api/guilds/:guildId/clans', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  try {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    const fixedGoalHours = config?.monthlyClanHoursGoal ?? 50;
    const goalMode = config?.clanGoalMode || 'FIXED';
    const hoursPerMember = config?.clanHoursPerMember ?? 10;

    const clans = await prisma.clan.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });

    const yearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const guild = client.guilds.cache.get(guildId);

    const formattedClans = await Promise.all(
      clans.map(async (c) => {
        const members = await prisma.clanMember.findMany({ where: { clanId: c.id } });
        const monthlyStats = await prisma.clanMemberMonthlyStats.findMany({
          where: { clanId: c.id, yearMonth },
        });

        // All-time historical stats for clan
        const allTimeStats = await prisma.clanMemberMonthlyStats.findMany({
          where: { clanId: c.id },
        });

        // Group all-time stats by yearMonth for month-by-month historical inspection
        const monthlyHistoryMap = new Map<string, { yearMonth: string; totalSeconds: number; totalHours: number; userStats: Record<string, number>; dailyActivity: Record<string, number> }>();

        // Ensure current month is always present
        monthlyHistoryMap.set(yearMonth, { yearMonth, totalSeconds: 0, totalHours: 0, userStats: {}, dailyActivity: {} });

        for (const s of allTimeStats) {
          if (!monthlyHistoryMap.has(s.yearMonth)) {
            monthlyHistoryMap.set(s.yearMonth, { yearMonth: s.yearMonth, totalSeconds: 0, totalHours: 0, userStats: {}, dailyActivity: {} });
          }
          const entry = monthlyHistoryMap.get(s.yearMonth)!;
          entry.totalSeconds += s.secondsSpent;
          entry.totalHours = parseFloat((entry.totalSeconds / 3600).toFixed(1));
          entry.userStats[s.userId] = (entry.userStats[s.userId] || 0) + s.secondsSpent;

          // Merge daily stats JSON
          if (s.dailyStatsJson) {
            try {
              const dMap = JSON.parse(s.dailyStatsJson);
              for (const [dayKey, sec] of Object.entries(dMap)) {
                entry.dailyActivity[dayKey] = (entry.dailyActivity[dayKey] || 0) + (sec as number);
              }
            } catch { }
          }
        }

        const monthlyHistory = Array.from(monthlyHistoryMap.values()).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));

        const monthlyStatsMap = new Map(monthlyStats.map(s => [s.userId, s.secondsSpent]));

        // Map user all-time seconds
        const allTimeUserStatsMap = new Map<string, number>();
        for (const s of allTimeStats) {
          const current = allTimeUserStatsMap.get(s.userId) || 0;
          allTimeUserStatsMap.set(s.userId, current + s.secondsSpent);
        }

        const totalSeconds = monthlyStats.reduce((acc, s) => acc + s.secondsSpent, 0);
        const totalAllTimeSeconds = allTimeStats.reduce((acc, s) => acc + s.secondsSpent, 0);

        // Hydrate Leader & Member names
        let leaderName = 'Desconocido';
        if (guild) {
          try {
            const leaderMember = await guild.members.fetch(c.leaderId);
            leaderName = leaderMember.displayName;
          } catch { }
        }

        const hydratedMembers = await Promise.all(
          members.map(async (m) => {
            let displayName = `Usuario (${m.userId})`;
            let avatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
            if (guild) {
              try {
                const gMem = await guild.members.fetch(m.userId);
                displayName = gMem.displayName;
                avatar = gMem.user.displayAvatarURL() || avatar;
              } catch { }
            }

            const seconds = monthlyStatsMap.get(m.userId) || 0;
            const allTimeSecs = allTimeUserStatsMap.get(m.userId) || 0;

            return {
              userId: m.userId,
              displayName,
              avatar,
              joinedAt: m.joinedAt,
              secondsSpent: seconds,
              hoursSpent: parseFloat((seconds / 3600).toFixed(1)),
              allTimeSecondsSpent: allTimeSecs,
              allTimeHoursSpent: parseFloat((allTimeSecs / 3600).toFixed(1)),
            };
          })
        );

        const clanGoalHours = goalMode === 'PER_MEMBER'
          ? (members.length * hoursPerMember)
          : fixedGoalHours;

        return {
          ...c,
          leaderName,
          coins: parseFloat((c.coins || 0).toFixed(1)),
          immunityShields: c.immunityShields || 0,
          hasMediaPerms: Boolean(c.hasMediaPerms),
          hasSoundboardPerms: Boolean(c.hasSoundboardPerms),
          isHiddenClan: Boolean(c.isHiddenClan),
          totalSeconds,
          totalHours: parseFloat((totalSeconds / 3600).toFixed(1)),
          totalAllTimeSeconds,
          totalAllTimeHours: parseFloat((totalAllTimeSeconds / 3600).toFixed(1)),
          goalHours: clanGoalHours,
          goalMode,
          hoursPerMember,
          membersCount: members.length,
          monthlyHistory,
          members: hydratedMembers,
        };
      })
    );

    res.json(formattedClans);
  } catch (err: any) {
    console.error('Error al obtener los clanes:', err);
    res.status(500).json({ error: 'Error al obtener la lista de clanes.' });
  }
});

// ── CUSTOM TRIGGERS API ENDPOINTS ──
app.get('/api/guilds/:guildId/triggers', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  try {
    const triggers = await prisma.customTrigger.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(triggers);
  } catch (error) {
    console.error('Error al obtener disparadores:', error);
    res.status(500).json({ error: 'Error al obtener los disparadores.' });
  }
});

app.post('/api/guilds/:guildId/triggers', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  const { trigger, response, responseType, requiredRoleId, ignoredRoleId, targetChannelId, cooldown } = req.body;

  if (!trigger || !response) {
    return res.status(400).json({ error: 'Trigger y response son requeridos.' });
  }

  try {
    const newTrigger = await prisma.customTrigger.create({
      data: {
        guildId,
        trigger: trigger.trim(),
        response: response,
        responseType: responseType === 'EMBED' ? 'EMBED' : 'TEXT',
        requiredRoleId: requiredRoleId || null,
        ignoredRoleId: ignoredRoleId || null,
        targetChannelId: targetChannelId || null,
        cooldown: typeof cooldown === 'number' ? Math.max(0, cooldown) : 0,
      },
    });
    res.json({ success: true, trigger: newTrigger });
  } catch (error) {
    console.error('Error al crear disparador:', error);
    res.status(500).json({ error: 'Error al crear el disparador.' });
  }
});

app.put('/api/guilds/:guildId/triggers/:triggerId', requireGuildAdmin, async (req, res) => {
  const { guildId, triggerId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  const { trigger, response, responseType, requiredRoleId, ignoredRoleId, targetChannelId, cooldown } = req.body;

  try {
    const updatedTrigger = await prisma.customTrigger.update({
      where: { id: triggerId },
      data: {
        ...(trigger && { trigger: trigger.trim() }),
        ...(response !== undefined && { response }),
        ...(responseType && { responseType: responseType === 'EMBED' ? 'EMBED' : 'TEXT' }),
        requiredRoleId: requiredRoleId === undefined ? undefined : (requiredRoleId || null),
        ignoredRoleId: ignoredRoleId === undefined ? undefined : (ignoredRoleId || null),
        targetChannelId: targetChannelId === undefined ? undefined : (targetChannelId || null),
        ...(typeof cooldown === 'number' && { cooldown: Math.max(0, cooldown) }),
      },
    });
    res.json({ success: true, trigger: updatedTrigger });
  } catch (error) {
    console.error('Error al actualizar disparador:', error);
    res.status(500).json({ error: 'Error al actualizar el disparador.' });
  }
});

app.delete('/api/guilds/:guildId/triggers/:triggerId', requireGuildAdmin, async (req, res) => {
  const { guildId, triggerId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  try {
    await prisma.customTrigger.delete({
      where: { id: triggerId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar disparador:', error);
    res.status(500).json({ error: 'Error al eliminar el disparador.' });
  }
});


// Fast member search endpoint for large servers (+50k members)
// CVE-4: auth required
app.get('/api/guilds/:guildId/members/search', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  const query = String(req.query.q || '').trim().toLowerCase();
  if (!query) return res.json([]);

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return res.json([]);

  try {
    // 1. Direct ID match check
    if (/^\d{17,20}$/.test(query)) {
      const member = await guild.members.fetch(query).catch(() => null);
      if (member && !member.user.bot) {
        return res.json([{
          id: member.id,
          username: member.user.username,
          displayName: member.displayName,
          avatar: member.user.displayAvatarURL() || 'https://cdn.discordapp.com/embed/avatars/0.png',
        }]);
      }
    }

    // 2. Fast search in guild cache / API fetch query (limited to top 10 matches)
    const fetchedMembers = await guild.members.fetch({ query, limit: 10 }).catch(() => new Map());
    const results = Array.from(fetchedMembers.values())
      .filter(m => !m.user.bot)
      .map(m => ({
        id: m.id,
        username: m.user.username,
        displayName: m.displayName,
        avatar: m.user.displayAvatarURL() || 'https://cdn.discordapp.com/embed/avatars/0.png',
      }));

    res.json(results);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/guilds/:guildId/clans', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  const { name, leaderId, roleName, colorHex } = req.body;

  if (!name || !leaderId || !roleName) {
    return res.status(400).json({ error: 'Nombre del clan, Líder y Nombre del Rol son requeridos.' });
  }

  try {
    const clan = await createClanInDiscordAndDB(
      client,
      guildId,
      name,
      leaderId,
      roleName,
      colorHex || '#5865F2'
    );
    res.json({ success: true, clan });
  } catch (err: any) {
    console.error('Error al crear clan:', err);
    res.status(400).json({ error: 'No se pudo crear el clan. Verifica los datos.' });
  }
});

// Endpoint to fetch voice channels in Clan Category (CVE-4: auth required)
app.get('/api/guilds/:guildId/clans/unlinked-channels', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  try {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (!config?.clansCategoryId) {
      return res.json([]);
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.json([]);

    const existingClans = await prisma.clan.findMany({ where: { guildId } });
    const linkedChannelIds = new Set(existingClans.map(c => c.voiceChannelId));

    const channels = await guild.channels.fetch();
    const unlinkedChannels = channels
      .filter(c => c && c.parentId === config.clansCategoryId && c.isVoiceBased() && !linkedChannelIds.has(c.id))
      .map(c => ({ id: c!.id, name: c!.name }));

    res.json(unlinkedChannels);
  } catch (err) {
    res.json([]);
  }
});

// Endpoint to import an existing clan
app.post('/api/guilds/:guildId/clans/import', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  const { name, leaderId, roleId, voiceChannelId, colorHex } = req.body;

  if (!name || !leaderId || !roleId || !voiceChannelId) {
    return res.status(400).json({ error: 'Nombre del clan, Líder, Rol existente y Canal de Voz son requeridos.' });
  }

  try {
    const clan = await importClanToDB(
      client,
      guildId,
      name,
      leaderId,
      roleId,
      voiceChannelId,
      colorHex
    );
    res.json({ success: true, clan });
  } catch (err: any) {
    console.error('Error al importar clan:', err);
    res.status(400).json({ error: 'No se pudo importar el clan. Verifica los datos.' });
  }
});

// GET Clan Shop Items (CVE-4: auth required)
app.get('/api/guilds/:guildId/clans/shop', requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  try {
    const items = await getOrCreateDefaultClanShopItems(guildId);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: 'Error interno del servidor. Contacta al administrador.' });
  }
});

// POST Buy Clan Shop Item from Dashboard (CVE-6: auth required)
app.post('/api/guilds/:guildId/clans/:clanId/buy', requireGuildAdmin, async (req, res) => {
  const { guildId, clanId } = req.params;
  const { itemId, buyerId } = req.body;

  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  if (!itemId) return res.status(400).json({ error: 'itemId requerido.' });

  try {
    const clan = await prisma.clan.findUnique({ where: { id: clanId } });
    if (!clan) return res.status(404).json({ error: 'Clan no encontrado.' });

    const buyer = buyerId || clan.leaderId;
    const updatedClan = await buyClanShopItem(client, guildId, clanId, itemId, buyer);
    res.json({ success: true, clan: updatedClan });
  } catch (error: any) {
    res.status(400).json({ error: 'Solicitud inválida. Verifica los datos enviados.' });
  }
});

// POST Adjust Clan Coins (Staff Gift/Modify Coins)
app.post('/api/guilds/:guildId/clans/:clanId/coins', requireGuildAdmin, async (req, res) => {
  const { guildId, clanId } = req.params;
  const { amount } = req.body;

  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  if (typeof amount !== 'number') return res.status(400).json({ error: 'Monto numérico requerido.' });

  try {
    const clan = await prisma.clan.findUnique({ where: { id: clanId } });
    if (!clan) return res.status(404).json({ error: 'Clan no encontrado.' });

    const updated = await prisma.clan.update({
      where: { id: clanId },
      data: {
        coins: Math.max(0, clan.coins + amount),
      },
    });

    res.json({ success: true, coins: updated.coins });
  } catch (error: any) {
    res.status(500).json({ error: 'Error interno del servidor. Contacta al administrador.' });
  }
});

// PUT Update Clan Shop Item Price/Details
app.put(['/api/guilds/:guildId/clans/shop/items/:itemId', '/api/guilds/:guildId/clans/shop/:itemId/price'], requireGuildAdmin, async (req, res) => {
  const { guildId, itemId, id } = req.params;
  const targetId = itemId || id;
  const { name, price, description, icon } = req.body;

  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  try {
    const updated = await prisma.clanShopItem.update({
      where: { id: targetId },
      data: {
        ...(name && { name: name.trim() }),
        ...(typeof price === 'number' && price >= 0 && { price }),
        ...(description !== undefined && { description: description.trim() }),
        ...(icon && { icon: icon.trim() }),
      },
    });
    res.json({ success: true, item: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Error interno del servidor. Contacta al administrador.' });
  }
});

// POST Create New Clan Shop Item
app.post(['/api/guilds/:guildId/clans/shop/items', '/api/guilds/:guildId/clans/shop'], requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { name, price, description, icon } = req.body;

  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });
  if (!name || typeof price !== 'number') return res.status(400).json({ error: 'Nombre y precio son requeridos.' });

  try {
    const newItem = await prisma.clanShopItem.create({
      data: {
        guildId,
        name: name.trim(),
        price,
        description: (description || '').trim(),
        icon: icon?.trim() || '🛒',
        category: 'CUSTOM',
        actionKey: 'CUSTOM',
      },
    });
    res.json({ success: true, item: newItem });
  } catch (error: any) {
    res.status(500).json({ error: 'Error interno del servidor. Contacta al administrador.' });
  }
});

// DELETE Clan Shop Item
app.delete('/api/guilds/:guildId/clans/shop/items/:itemId', requireGuildAdmin, async (req, res) => {
  const { guildId, itemId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  try {
    await prisma.clanShopItem.delete({ where: { id: itemId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error interno del servidor. Contacta al administrador.' });
  }
});

// GET Economy Leaderboard (Top Rich Users: cash + bank)
// CVE-4: auth required
app.get(['/api/guilds/:guildId/leaderboard/economy', '/api/guilds/:guildId/economy/leaderboard'], requireGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  try {
    const users = await prisma.userEconomy.findMany({
      where: { guildId },
      take: 50,
    });

    const guild = client.guilds.cache.get(guildId);

    const sorted = users
      .map(u => ({
        userId: u.userId,
        cash: u.cash,
        bank: u.bank,
        total: u.cash + u.bank,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const formatted = await Promise.all(sorted.map(async u => {
      let displayName = `Usuario (${u.userId.slice(-4)})`;
      let avatar = 'https://cdn.discordapp.com/embed/avatars/0.png';

      // Fetch from Discord Guild Member cache or API
      if (guild) {
        const member = guild.members.cache.get(u.userId) || await guild.members.fetch(u.userId).catch(() => null);
        if (member) {
          displayName = member.displayName || member.user.username;
          avatar = member.user.displayAvatarURL({ extension: 'png', size: 64 });
        }
      }

      return {
        ...u,
        displayName,
        avatar,
      };
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: 'Error interno del servidor. Contacta al administrador.' });
  }
});

// DELETE Clan (CVE-5: requireGuildAdmin added)
app.delete('/api/guilds/:guildId/clans/:clanId', requireGuildAdmin, async (req, res) => {
  const { guildId, clanId } = req.params;
  if (!isValidSnowflake(guildId)) return res.status(400).json({ error: 'guildId inválido.' });

  try {
    await deleteClanFromDiscordAndDB(client, guildId, clanId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error al eliminar clan:', err);
    res.status(500).json({ error: 'No se pudo eliminar el clan. Inténtalo de nuevo.' });
  }
});

const PORT = process.env.PORT || 48931;
app.listen(PORT, () => {
  console.log(`🌐 Servidor API del Panel funcionando en http://localhost:${PORT}`);
});

// Graceful Shutdown Handlers
const handleShutdown = async (signal: string) => {
  console.log(`\n🛑 Recibida señal ${signal}. Cerrando bot de forma segura...`);
  await flushVoiceXPBeforeShutdown().catch(() => null);
  await flushClanVoiceStatsBeforeShutdown().catch(() => null);
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Login Bot (graceful fallback if token is invalid or missing)
const token = process.env.DISCORD_TOKEN;
if (!token || token === 'YOUR_DISCORD_BOT_TOKEN') {
  console.warn('⚠️ ï ADVERTENCIA: DISCORD_TOKEN no configurado en .env. El bot de Discord no se iniciará, pero la API del Panel y el Dashboard funcionarán con datos simulados.');
} else {
  client.login(token).catch(err => {
    console.error('Œ Error al iniciar el bot de Discord (Token incorrecto):', err);
  });
}

