import {
  VoiceState,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  GuildMember,
  MessageFlags,
  Colors,
  VoiceChannel,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  UserSelectMenuBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { prisma } from 'shared';

// ── Constants ───────────────────────────────────────────────────────────────
const PANEL_BUTTON_PREFIX = 'tempvc_';
const MAX_NAME_LENGTH = 30;
const MAX_USER_LIMIT = 99;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Checks if a member has administrator or moderator permissions (Staff).
 */
function isStaff(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.permissions.has(PermissionFlagsBits.MuteMembers);
}

/**
 * Helper to get the target role ID (verifiedRoleId if set, otherwise @everyone).
 */
async function getTargetRoleId(guildId: string, guild: any): Promise<string> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (config?.verifiedRoleId) {
    const roleExists = guild.roles.cache.has(config.verifiedRoleId);
    if (roleExists) return config.verifiedRoleId;
  }
  return guild.roles.everyone.id;
}

/**
 * Builds the Temp VC control panel embed showing current state.
 */
function buildPanelEmbed(owner: GuildMember, voiceChannel: VoiceChannel, verifiedRoleId?: string | null): EmbedBuilder {
  const targetRoleId = (verifiedRoleId && voiceChannel.guild.roles.cache.has(verifiedRoleId))
    ? verifiedRoleId
    : voiceChannel.guild.roles.everyone.id;

  const targetOverwrite = voiceChannel.permissionOverwrites.cache.get(targetRoleId);

  const isLocked = targetOverwrite?.deny.has(PermissionFlagsBits.Connect) ?? false;
  const userLimit = voiceChannel.userLimit;

  return new EmbedBuilder()
    .setTitle('🎙️ Panel de Control de Voz')
    .setDescription(
      `> Propietario: <@${owner.id}>\n` +
      `> Canal: **${voiceChannel.name}**`
    )
    .setColor(isLocked ? Colors.Red : Colors.Blurple)
    .addFields(
      {
        name: '📊 Estado',
        value: [
          `${isLocked ? '🔒 Bloqueado' : '🔓 Desbloqueado'}`,
          `👥 Límite: ${userLimit === 0 ? 'Ilimitado' : `${voiceChannel.members.size}/${userLimit}`}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '📋 Controles disponibles',
        value: [
          '🔒 **Bloquear / Desbloquear** — Permite/Evita entradas',
          '✏️ **Renombrar** — Cambia el nombre del canal',
          '👥 **Límite** — Cambia el máx. de usuarios',
          '👤 **Expulsar** — Echa a un usuario y lo veta',
          '➕ **Admitir** — Deja pasar a un usuario específico',
          '🤝 **Transferir** — Cede la propiedad a otro miembro',
          '👑 **Reclamar** — Toma el control del canal',
        ].join('\n'),
        inline: true,
      }
    )
    .setFooter({ text: 'Solo el propietario puede usar estos controles.' })
    .setTimestamp();
}

/**
 * Builds the control panel action rows (buttons).
 */
function buildPanelComponents(isLocked: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('tempvc_toggle_lock')
      .setLabel(isLocked ? 'Desbloquear' : 'Bloquear')
      .setStyle(isLocked ? ButtonStyle.Success : ButtonStyle.Danger)
      .setEmoji(isLocked ? '🔓' : '🔒'),
    new ButtonBuilder()
      .setCustomId('tempvc_rename')
      .setLabel('Renombrar')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId('tempvc_limit')
      .setLabel('Límite')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👥')
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('tempvc_kick')
      .setLabel('Expulsar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👤'),
    new ButtonBuilder()
      .setCustomId('tempvc_admit')
      .setLabel('Admitir')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('➕'),
    new ButtonBuilder()
      .setCustomId('tempvc_transfer')
      .setLabel('Transferir')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🤝')
  );

  return [row1, row2];
}

/**
 * Sends the control panel message into the channel.
 */
async function sendControlPanel(channel: VoiceChannel, owner: GuildMember): Promise<void> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId: channel.guild.id } });
  const embed = buildPanelEmbed(owner, channel, config?.verifiedRoleId);
  const components = buildPanelComponents(false);
  await channel.send({ embeds: [embed], components });
}

/**
 * Updates (edits) the panel embed on an existing panel message by re-fetching the channel state.
 * This is used after button interactions to reflect the new state visually.
 */
async function updatePanel(channel: VoiceChannel, ownerId: string): Promise<void> {
  try {
    const messages = await channel.messages.fetch({ limit: 20 });
    const panelMessage = messages.find(
      m => m.author.id === channel.client.user.id &&
        m.components.length > 0 &&
        m.embeds.length > 0 &&
        m.embeds[0].title === '🎙️ Panel de Control de Voz'
    );

    if (!panelMessage) return;

    let owner: GuildMember;
    try {
      owner = await channel.guild.members.fetch(ownerId);
    } catch {
      return;
    }

    const config = await prisma.guildConfig.findUnique({ where: { guildId: channel.guild.id } });
    const targetRoleId = config?.verifiedRoleId || channel.guild.roles.everyone.id;
    const targetOverwrite = channel.permissionOverwrites.cache.get(targetRoleId) || channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);

    const isLocked = targetOverwrite?.deny.has(PermissionFlagsBits.Connect) ?? false;

    const embed = buildPanelEmbed(owner, channel, config?.verifiedRoleId);
    const components = buildPanelComponents(isLocked);

    await panelMessage.edit({ embeds: [embed], components });
  } catch (err) {
    // Non-critical: panel update failed, ignore
  }
}

// ── Voice State Handlers ─────────────────────────────────────────────────────

/**
 * Handles a member joining the master VC to trigger temp VC creation.
 */
export async function handleTempVCJoin(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const member = newState.member;
  if (!member || member.user.bot) return;

  const guildId = member.guild.id;

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config?.tempVcEnabled || !config.tempVcChannelId) return;
  if (newState.channelId !== config.tempVcChannelId) return;

  try {
    const categoryId = config.tempVcCategoryId || newState.channel?.parentId || undefined;

    // Fetch parent category permission overwrites to inherit role permissions (Staff, unverified, etc.)
    let parentOverwrites: any[] = [];
    if (categoryId) {
      const category = await member.guild.channels.fetch(categoryId).catch(() => null);
      if (category && 'permissionOverwrites' in category) {
        parentOverwrites = Array.from((category as any).permissionOverwrites.cache.values()).map((o: any) => ({
          id: o.id,
          type: o.type,
          allow: o.allow.bitfield,
          deny: o.deny.bitfield,
        }));
      }
    }

    // Create the temp voice channel with explicit bot permissions and inherited category permissions
    const tempChannel = await member.guild.channels.create({
      name: `🔊 ${member.displayName}`,
      type: ChannelType.GuildVoice,
      parent: categoryId,
      permissionOverwrites: [
        ...parentOverwrites,
        {
          // Owner gets basic connection control, but must use the panel for management
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.Stream,
          ],
        },
        {
          // Bot must ALWAYS have explicit permissions regardless of @everyone state
          id: member.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
            PermissionFlagsBits.MoveMembers,
          ],
        },
      ],
    }) as VoiceChannel;

    // Save to database
    await prisma.tempChannel.create({
      data: { channelId: tempChannel.id, guildId, ownerId: member.id },
    });

    // Move member into the new channel
    await member.voice.setChannel(tempChannel);

    // Send the interactive control panel
    await sendControlPanel(tempChannel, member);
  } catch (err) {
    console.error('[TempVC] Error creating temp voice channel:', err);
  }
}

/**
 * Handles cleanup when a member leaves a temporary VC.
 */
export async function handleTempVCLeave(oldState: VoiceState, newState: VoiceState): Promise<void> {
  if (!oldState.channelId) return;

  const channelId = oldState.channelId;

  const tempChannelDb = await prisma.tempChannel.findUnique({ where: { channelId } });
  if (!tempChannelDb) return;

  const channel = oldState.guild.channels.cache.get(channelId);
  if (!channel || !channel.isVoiceBased()) return;

  // Case 1: Channel is empty -> delete it
  if (channel.members.size === 0) {
    try {
      await channel.delete('[TempVC] Canal vacío — limpieza automática.');
    } catch { }
    await prisma.tempChannel.delete({ where: { channelId } }).catch(() => { });
    return;
  }

  // Case 2: Owner left the channel, but other non-bot members remain -> Transfer ownership randomly
  const leavingUserId = oldState.member?.id;
  if (leavingUserId === tempChannelDb.ownerId) {
    // Filter out bots to pick a real user
    const remainingMembers = Array.from(channel.members.values()).filter(m => !m.user.bot);
    if (remainingMembers.length > 0) {
      // Select a random member
      const newOwner = remainingMembers[Math.floor(Math.random() * remainingMembers.length)];

      try {
        // Update database record
        await prisma.tempChannel.update({
          where: { channelId },
          data: { ownerId: newOwner.id },
        });

        // Grant new owner channel permissions
        await (channel as VoiceChannel).permissionOverwrites.edit(newOwner.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          Stream: true,
        });

        // Send notification & update the control panel
        await updatePanel(channel as VoiceChannel, newOwner.id);
        await (channel as VoiceChannel).send({
          content: `👑 El antiguo propietario se ha desconectado. **<@${newOwner.id}>** es ahora el nuevo propietario del canal.`,
        }).catch(() => null);
      } catch (err) {
        console.error('[TempVC] Error auto-transferring ownership on leave:', err);
      }
    }
  }
}

// ── Interaction Handler ───────────────────────────────────────────────────────

/**
 * Handles all TempVC button and modal interactions.
 * CRITICAL DESIGN: We ALWAYS defer the interaction first (within 3 seconds) to prevent
 * "Interaction Failed" errors during async operations (DB queries, API calls, etc).
 */
export async function handleTempVCInteraction(interaction: Interaction): Promise<void> {
  // ── Button Interactions ───────────────────────────────────────────────────
  if (interaction.isButton()) {
    const { customId } = interaction;
    if (!customId.startsWith(PANEL_BUTTON_PREFIX)) return;

    // STEP 1: Defer IMMEDIATELY — this gives us 15 minutes to reply instead of 3 seconds
    // Use ephemeral so only the user sees the response
    if (customId !== 'tempvc_rename' && customId !== 'tempvc_limit') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const { guild, member } = interaction;
    if (!guild || !member) {
      if (interaction.deferred) await interaction.editReply({ content: '❌ Comando solo disponible en servidores.' });
      return;
    }

    // STEP 2: Get the voice channel the member is CURRENTLY in
    const memberVoiceChannel = (member as GuildMember).voice?.channel as VoiceChannel | null;
    if (!memberVoiceChannel) {
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ Debes estar en un canal de voz para usar estos controles.' });
      } else {
        await interaction.reply({ content: '❌ Debes estar en un canal de voz para usar estos controles.', flags: MessageFlags.Ephemeral });
      }
      return;
    }

    // STEP 3: Check DB — is this a registered temp channel?
    const tempChannelDb = await prisma.tempChannel.findUnique({
      where: { channelId: memberVoiceChannel.id },
    });

    if (!tempChannelDb) {
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ Este no es un canal temporal gestionado por el bot.' });
      } else {
        await interaction.reply({ content: '❌ Este no es un canal temporal gestionado por el bot.', flags: MessageFlags.Ephemeral });
      }
      return;
    }

    const userId = (member as GuildMember).id;
    const isOwner = tempChannelDb.ownerId === userId;

    try {
      // ── Claim (no requiere ser owner) ────────────────────────────────────
      if (customId === 'tempvc_claim') {
        const claimerStaff = isStaff(member as GuildMember);
        const ownerStillPresent = memberVoiceChannel.members.has(tempChannelDb.ownerId);

        // Staff can claim even if the owner is still present
        if (ownerStillPresent && !claimerStaff) {
          await interaction.editReply({ content: '❌ El propietario actual todavía está en el canal.' });
          return;
        }

        await prisma.tempChannel.update({
          where: { channelId: memberVoiceChannel.id },
          data: { ownerId: userId },
        });

        // Give the new owner explicit voice access permissions
        await memberVoiceChannel.permissionOverwrites.edit(userId, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          Stream: true,
        });

        // Revoke explicit permissions from the previous owner (set to default/null)
        await memberVoiceChannel.permissionOverwrites.edit(tempChannelDb.ownerId, {
          ViewChannel: null,
          Connect: null,
          Speak: null,
          Stream: null,
        });

        await interaction.editReply({ content: `👑 ¡Ahora eres el propietario de **${memberVoiceChannel.name}**!` });
        const newOwner = await guild.members.fetch(userId).catch(() => null);
        if (newOwner) await updatePanel(memberVoiceChannel, newOwner.id);
        return;
      }

      // All other actions require ownership or Staff bypass
      const requesterStaff = isStaff(member as GuildMember);
      if (!isOwner && !requesterStaff) {
        await interaction.editReply({ content: '❌ Solo el propietario del canal o el Staff pueden usar estos controles.' });
        return;
      }

      // ── Toggle Lock ──────────────────────────────────────────────────────
      if (customId === 'tempvc_toggle_lock') {
        const targetRoleId = await getTargetRoleId(guild.id, guild);
        const targetOverwrite = memberVoiceChannel.permissionOverwrites.cache.get(targetRoleId);
        const isLocked = targetOverwrite?.deny.has(PermissionFlagsBits.Connect) ?? false;

        await memberVoiceChannel.permissionOverwrites.edit(targetRoleId, {
          Connect: isLocked ? null : false,
        });

        await interaction.editReply({
          content: isLocked
            ? '🔓 Canal desbloqueado. Todos pueden unirse.'
            : '🔒 Canal bloqueado. Solo tú y los miembros con permiso explícito pueden entrar.',
        });
        await updatePanel(memberVoiceChannel, userId);
        return;
      }

      // ── Rename (Modal) ───────────────────────────────────────────────────
      if (customId === 'tempvc_rename') {
        const modal = new ModalBuilder()
          .setCustomId('tempvc_modal_rename')
          .setTitle('✏️ Renombrar Canal de Voz');

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('new_name')
              .setLabel('Nuevo nombre del canal')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(MAX_NAME_LENGTH)
              .setPlaceholder(memberVoiceChannel.name)
              .setValue(memberVoiceChannel.name),
          ),
        );

        await interaction.showModal(modal);
        return;
      }

      // ── User Limit (Modal) ───────────────────────────────────────────────
      if (customId === 'tempvc_limit') {
        const modal = new ModalBuilder()
          .setCustomId('tempvc_modal_limit')
          .setTitle('👥 Límite de Usuarios');

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('user_limit')
              .setLabel('Límite de usuarios (0 = ilimitado, máx. 99)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(2)
              .setPlaceholder('0')
              .setValue(String(memberVoiceChannel.userLimit)),
          ),
        );

        await interaction.showModal(modal);
        return;
      }

      // ── Kick (Select Menu) ───────────────────────────────────────────────
      if (customId === 'tempvc_kick') {
        const otherMembers = memberVoiceChannel.members.filter(
          m => m.id !== userId && m.id !== interaction.client.user.id && !isStaff(m)
        );

        if (otherMembers.size === 0) {
          await interaction.editReply({ content: '❌ No hay otros usuarios en tu canal de voz para expulsar.' });
          return;
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('tempvc_kick_select')
          .setPlaceholder('Elige al miembro que deseas expulsar...');

        // Limit options to 25 to satisfy Discord API limits
        const membersList = otherMembers.first(25);

        membersList.forEach(m => {
          selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(m.displayName)
              .setDescription(`Usuario: @${m.user.username}`)
              .setValue(m.id)
          );
        });

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.editReply({
          content: '👤 Selecciona al miembro que deseas expulsar y bloquear de este canal:',
          components: [row],
        });
        return;
      }

      // ── Transfer (Select Menu) ───────────────────────────────────────────
      if (customId === 'tempvc_transfer') {
        const otherMembers = memberVoiceChannel.members.filter(
          m => m.id !== userId && m.id !== interaction.client.user.id
        );

        if (otherMembers.size === 0) {
          await interaction.editReply({ content: '❌ No hay otros usuarios en tu canal de voz a los que transferir la propiedad.' });
          return;
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('tempvc_transfer_select')
          .setPlaceholder('Elige al nuevo propietario...');

        // Limit options to 25 to satisfy Discord API limits
        const membersList = otherMembers.first(25);

        membersList.forEach(m => {
          selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(m.displayName)
              .setDescription(`Usuario: @${m.user.username}`)
              .setValue(m.id)
          );
        });

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.editReply({
          content: '🤝 Selecciona al miembro al que deseas transferir la propiedad del canal:',
          components: [row],
        });
        return;
      }

      // ── Admit / Permit (User Select Menu) ────────────────────────────────
      if (customId === 'tempvc_admit' || customId === 'tempvc_permit') {
        const selectMenu = new UserSelectMenuBuilder()
          .setCustomId('tempvc_permit_select')
          .setPlaceholder('Busca y selecciona al usuario a admitir...')
          .setMinValues(1)
          .setMaxValues(1);

        const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.editReply({
          content: '➕ Selecciona al miembro que deseas admitir en tu canal de voz:',
          components: [row],
        });
        return;
      }

    } catch (err: any) {
      console.error('[TempVC] Error processing button interaction:', err);
      const errorMsg = err.code === 50013
        ? '❌ El bot no tiene permisos suficientes en este canal. Asegúrate de que el rol del bot esté por encima de los usuarios en la jerarquía.'
        : `❌ Error: ${err.message ?? 'desconocido'}`;

      if (interaction.deferred) {
        await interaction.editReply({ content: errorMsg }).catch(() => { });
      }
    }
  }

  // ── Modal Submit Interactions ─────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const { customId } = interaction;
    if (!customId.startsWith('tempvc_modal_')) return;

    // Defer immediately
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild, member } = interaction;
    if (!guild || !member) {
      await interaction.editReply({ content: '❌ Error: datos del servidor no disponibles.' });
      return;
    }

    // Use member's current voice channel (same approach as buttons)
    const memberVoiceChannel = (member as GuildMember).voice?.channel as VoiceChannel | null;
    if (!memberVoiceChannel) {
      await interaction.editReply({ content: '❌ Debes estar en un canal de voz para usar estos controles.' });
      return;
    }

    const tempChannelDb = await prisma.tempChannel.findUnique({
      where: { channelId: memberVoiceChannel.id },
    });

    const userId = (member as GuildMember).id;

    if (!tempChannelDb || tempChannelDb.ownerId !== userId) {
      await interaction.editReply({ content: '❌ No eres el propietario de este canal temporal.' });
      return;
    }

    try {
      // ── Rename ─────────────────────────────────────────────────────────
      if (customId === 'tempvc_modal_rename') {
        const newName = interaction.fields.getTextInputValue('new_name').trim();
        if (!newName) {
          await interaction.editReply({ content: '❌ El nombre no puede estar vacío.' });
          return;
        }

        await memberVoiceChannel.setName(newName);
        await interaction.editReply({ content: `✏️ Canal renombrado a **${newName}** correctamente.` });

        const owner = await guild.members.fetch(userId).catch(() => null);
        if (owner) await updatePanel(memberVoiceChannel, userId);
        return;
      }

      // ── User Limit ─────────────────────────────────────────────────────
      if (customId === 'tempvc_modal_limit') {
        const limitStr = interaction.fields.getTextInputValue('user_limit');
        const limit = parseInt(limitStr, 10);

        if (isNaN(limit) || limit < 0 || limit > MAX_USER_LIMIT) {
          await interaction.editReply({ content: `❌ Introduce un número válido entre 0 y ${MAX_USER_LIMIT}.` });
          return;
        }

        await memberVoiceChannel.setUserLimit(limit);
        await interaction.editReply({
          content: `👥 Límite actualizado a **${limit === 0 ? 'Ilimitado' : limit + ' usuarios'}**.`,
        });
        await updatePanel(memberVoiceChannel, userId);
        return;
      }

    } catch (err: any) {
      console.error('[TempVC] Error processing modal submit:', err);
      const msg = err.code === 50013
        ? '❌ Sin permisos para modificar el canal.'
        : err.message?.includes('rate limit') || err.code === 20028
          ? '⚠️ Discord te limita a cambiar el nombre del canal máximo 2 veces cada 10 minutos.'
          : `❌ Error: ${err.message ?? 'desconocido'}`;

      await interaction.editReply({ content: msg }).catch(() => { });
    }
  }

  // ── String Select Menu Interactions ───────────────────────────────────────
  if (interaction.isStringSelectMenu()) {
    const { customId } = interaction;
    if (customId !== 'tempvc_kick_select' && customId !== 'tempvc_transfer_select') return;

    // Defer immediately
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild, member } = interaction;
    if (!guild || !member) {
      await interaction.editReply({ content: '❌ Error: datos del servidor no disponibles.' });
      return;
    }

    const memberVoiceChannel = (member as GuildMember).voice?.channel as VoiceChannel | null;
    if (!memberVoiceChannel) {
      await interaction.editReply({ content: '❌ Debes estar en el canal de voz para realizar esta acción.' });
      return;
    }

    const tempChannelDb = await prisma.tempChannel.findUnique({
      where: { channelId: memberVoiceChannel.id },
    });

    const userId = (member as GuildMember).id;
    const requesterStaff = isStaff(member as GuildMember);
    if (!tempChannelDb || (tempChannelDb.ownerId !== userId && !requesterStaff)) {
      await interaction.editReply({ content: '❌ No tienes permisos para administrar este canal temporal.' });
      return;
    }

    const targetUserId = interaction.values[0];

    // ── Kick Action ────────────────────────────────────────────────────────
    if (customId === 'tempvc_kick_select') {
      try {
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
        if (!targetMember) {
          await interaction.editReply({ content: '❌ No se pudo encontrar a ese usuario en el servidor.' });
          return;
        }

        if (isStaff(targetMember)) {
          await interaction.editReply({ content: '❌ No puedes expulsar a un miembro del Staff.' });
          return;
        }

        // STEP 1: Block user from joining (Connect: false)
        // STEP 2: Hide the channel for this user (ViewChannel: false)
        await memberVoiceChannel.permissionOverwrites.edit(targetUserId, {
          Connect: false,
          ViewChannel: false,
        });

        // STEP 3: Disconnect user if still in VC
        if (targetMember.voice.channelId === memberVoiceChannel.id) {
          await targetMember.voice.setChannel(null, 'Expulsado por el dueño del canal temporal.');
        }

        await interaction.editReply({
          content: `✅ <@${targetUserId}> ha sido expulsado y bloqueado del canal de voz.`,
        });
        await updatePanel(memberVoiceChannel, userId);
      } catch (err: any) {
        console.error('[TempVC] Error during kick:', err);
        await interaction.editReply({ content: `❌ Error al expulsar al usuario: ${err.message || 'desconocido'}` });
      }
      return;
    }

    // ── Transfer Action ────────────────────────────────────────────────────
    if (customId === 'tempvc_transfer_select') {
      try {
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
        if (!targetMember) {
          await interaction.editReply({ content: '❌ No se pudo encontrar a ese usuario en el servidor.' });
          return;
        }

        // Update DB owner
        await prisma.tempChannel.update({
          where: { channelId: memberVoiceChannel.id },
          data: { ownerId: targetUserId },
        });

        // Give the new owner explicit permissions
        await memberVoiceChannel.permissionOverwrites.edit(targetUserId, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          Stream: true,
        });

        // Revoke explicit permissions from the previous owner (set to default/null)
        await memberVoiceChannel.permissionOverwrites.edit(userId, {
          ViewChannel: null,
          Connect: null,
          Speak: null,
          Stream: null,
        });

        await interaction.editReply({
          content: `🤝 Propiedad del canal transferida con éxito a <@${targetUserId}>.`,
        });
        await updatePanel(memberVoiceChannel, targetUserId);
      } catch (err: any) {
        console.error('[TempVC] Error during transfer:', err);
        await interaction.editReply({ content: `❌ Error al transferir el canal: ${err.message || 'desconocido'}` });
      }
      return;
    }
  }

  // ── User Select Menu Interactions ─────────────────────────────────────────
  if (interaction.isUserSelectMenu()) {
    const { customId } = interaction;
    if (customId !== 'tempvc_permit_select') return;

    // Defer immediately
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild, member } = interaction;
    if (!guild || !member) {
      await interaction.editReply({ content: '❌ Error: datos del servidor no disponibles.' });
      return;
    }

    const memberVoiceChannel = (member as GuildMember).voice?.channel as VoiceChannel | null;
    if (!memberVoiceChannel) {
      await interaction.editReply({ content: '❌ Debes estar en el canal de voz para realizar esta acción.' });
      return;
    }

    const tempChannelDb = await prisma.tempChannel.findUnique({
      where: { channelId: memberVoiceChannel.id },
    });

    const userId = (member as GuildMember).id;
    const requesterStaff = isStaff(member as GuildMember);
    if (!tempChannelDb || (tempChannelDb.ownerId !== userId && !requesterStaff)) {
      await interaction.editReply({ content: '❌ No tienes permisos para administrar este canal temporal.' });
      return;
    }

    const targetUserId = interaction.values[0];

    try {
      // Allow target user explicit connect and view permissions
      await memberVoiceChannel.permissionOverwrites.edit(targetUserId, {
        Connect: true,
        ViewChannel: true,
      });

      await interaction.editReply({
        content: `✅ <@${targetUserId}> ha sido admitido y ahora puede unirse a tu canal de voz.`,
      });
      await updatePanel(memberVoiceChannel, tempChannelDb.ownerId);
    } catch (err: any) {
      console.error('[TempVC] Error during permit:', err);
      await interaction.editReply({ content: `❌ Error al admitir al usuario: ${err.message || 'desconocido'}` });
    }
  }
}

/**
 * Handle Slash Commands related to the Temporary Voice Channel.
 */
export async function handleVCCommand(interaction: ChatInputCommandInteraction): Promise<any> {
  const { options, member, guild } = interaction;
  if (!guild || !member) return interaction.reply({ content: '❌ Este comando solo se puede usar en servidores.', ephemeral: true });

  const subcommand = options.getSubcommand();
  const userId = interaction.user.id;

  const memberVoiceChannel = (member as GuildMember).voice?.channel as VoiceChannel | null;
  if (!memberVoiceChannel) {
    return interaction.reply({ content: '❌ Debes estar en un canal de voz para usar estos comandos.', ephemeral: true });
  }

  const tempChannelDb = await prisma.tempChannel.findUnique({
    where: { channelId: memberVoiceChannel.id },
  });

  if (!tempChannelDb) {
    return interaction.reply({ content: '❌ Este no es un canal temporal gestionado por el bot.', ephemeral: true });
  }

  const isOwner = tempChannelDb.ownerId === userId;
  const requesterStaff = isStaff(member as GuildMember);

  // ── Claim Action (Solo Staff) ─────────────────────────────────────────────────────────────────────
  if (subcommand === 'claim') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const claimerStaff = isStaff(member as GuildMember);

    if (!claimerStaff) {
      await interaction.editReply({ content: '❌ Solo el **Staff del servidor** puede usar este comando. Los canales huérfanos se reasignan automáticamente.' });
      return;
    }

    await prisma.tempChannel.update({
      where: { channelId: memberVoiceChannel.id },
      data: { ownerId: userId },
    });

    await memberVoiceChannel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      Stream: true,
    });

    await memberVoiceChannel.permissionOverwrites.edit(tempChannelDb.ownerId, {
      ViewChannel: null,
      Connect: null,
      Speak: null,
      Stream: null,
    });

    await interaction.editReply({ content: `👑 ¡Ahora eres el propietario de **${memberVoiceChannel.name}**!` });
    await updatePanel(memberVoiceChannel, userId);
    return;
  }

  // All other actions require ownership or Staff bypass
  if (!isOwner && !requesterStaff) {
    return interaction.reply({ content: '❌ Solo el propietario del canal o el Staff pueden usar estos controles.', ephemeral: true });
  }

  // Defer reply for all other operations
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // ── Lock ─────────────────────────────────────────────────────────────
    if (subcommand === 'lock') {
      await memberVoiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
      await interaction.editReply({ content: '🔒 Canal bloqueado. Solo tú y los miembros con permiso explícito pueden entrar.' });
      await updatePanel(memberVoiceChannel, tempChannelDb.ownerId);
      return;
    }

    // ── Unlock ───────────────────────────────────────────────────────────
    if (subcommand === 'unlock') {
      await memberVoiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: null });
      await interaction.editReply({ content: '🔓 Canal desbloqueado. Todos pueden unirse.' });
      await updatePanel(memberVoiceChannel, tempChannelDb.ownerId);
      return;
    }

    // ── Rename ───────────────────────────────────────────────────────────
    if (subcommand === 'rename') {
      const newName = options.getString('nombre')!.trim();
      if (!newName) {
        await interaction.editReply({ content: '❌ El nombre no puede estar vacío.' });
        return;
      }
      try {
        await memberVoiceChannel.setName(newName);
        await interaction.editReply({ content: `✏️ Canal renombrado a **${newName}** correctamente.` });
        await updatePanel(memberVoiceChannel, tempChannelDb.ownerId);
      } catch (err: any) {
        const msg = err.message?.includes('rate limit') || err.code === 20028
          ? '⚠️ Discord te limita a cambiar el nombre del canal máximo 2 veces cada 10 minutos.'
          : `❌ Error: ${err.message ?? 'desconocido'}`;
        await interaction.editReply({ content: msg });
      }
      return;
    }

    // ── Limit ────────────────────────────────────────────────────────────
    if (subcommand === 'limit') {
      const limit = options.getInteger('limite')!;
      await memberVoiceChannel.setUserLimit(limit);
      await interaction.editReply({ content: `👥 Límite de usuarios actualizado a **${limit === 0 ? 'Ilimitado' : limit + ' usuarios'}**.` });
      await updatePanel(memberVoiceChannel, tempChannelDb.ownerId);
      return;
    }

    // ── Kick ─────────────────────────────────────────────────────────────
    if (subcommand === 'kick') {
      const targetUser = options.getUser('usuario');
      const targetIdStr = options.getString('id');
      const targetId = targetUser?.id || targetIdStr;

      if (!targetId) {
        await interaction.editReply({ content: '❌ Debes especificar un usuario por mención o introducir su ID.' });
        return;
      }

      const targetMember = await guild.members.fetch(targetId).catch(() => null);
      if (!targetMember) {
        await interaction.editReply({ content: '❌ No se pudo encontrar a ese usuario en el servidor.' });
        return;
      }

      if (isStaff(targetMember)) {
        await interaction.editReply({ content: '❌ No puedes expulsar a un miembro del Staff.' });
        return;
      }

      // STEP 1: Block user from joining (Connect: false)
      // STEP 2: Hide the channel for this user (ViewChannel: false)
      await memberVoiceChannel.permissionOverwrites.edit(targetId, {
        Connect: false,
        ViewChannel: false,
      });

      // STEP 3: Disconnect user if still in VC
      if (targetMember.voice.channelId === memberVoiceChannel.id) {
        await targetMember.voice.setChannel(null, 'Expulsado por comando en el canal temporal.');
      }

      await interaction.editReply({ content: `✅ <@${targetId}> ha sido expulsado y bloqueado del canal de voz.` });
      await updatePanel(memberVoiceChannel, tempChannelDb.ownerId);
      return;
    }

    // ── Admit ────────────────────────────────────────────────────────────
    if (subcommand === 'admit') {
      const targetUser = options.getUser('usuario');
      const targetIdStr = options.getString('id');
      const targetId = targetUser?.id || targetIdStr;

      if (!targetId) {
        await interaction.editReply({ content: '❌ Debes especificar un usuario por mención o introducir su ID.' });
        return;
      }

      await memberVoiceChannel.permissionOverwrites.edit(targetId, {
        Connect: true,
        ViewChannel: true,
      });

      await interaction.editReply({ content: `✅ <@${targetId}> ha sido admitido en el canal de voz.` });
      await updatePanel(memberVoiceChannel, tempChannelDb.ownerId);
      return;
    }

    // ── Transfer ─────────────────────────────────────────────────────────
    if (subcommand === 'transfer') {
      const targetUser = options.getUser('usuario', true);

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        await interaction.editReply({ content: '❌ No se pudo encontrar a ese usuario en el servidor.' });
        return;
      }

      // Update DB owner
      await prisma.tempChannel.update({
        where: { channelId: memberVoiceChannel.id },
        data: { ownerId: targetUser.id },
      });

      // Give new owner explicit permissions
      await memberVoiceChannel.permissionOverwrites.edit(targetUser.id, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        Stream: true,
      });

      // Revoke explicit permissions from previous owner
      await memberVoiceChannel.permissionOverwrites.edit(userId, {
        ViewChannel: null,
        Connect: null,
        Speak: null,
        Stream: null,
      });

      await interaction.editReply({ content: `🤝 Propiedad del canal transferida con éxito a <@${targetUser.id}>.` });
      await updatePanel(memberVoiceChannel, targetUser.id);
      return;
    }

  } catch (err: any) {
    console.error('[TempVC] Error processing subcommand:', err);
    await interaction.editReply({ content: `❌ Ocurrió un error al procesar el comando: ${err.message || 'desconocido'}` });
  }
}

/**
 * Clean up empty or non-existent temporary voice channels from the database and Discord on startup.
 */
export async function cleanupTempChannels(client: any): Promise<void> {
  console.log('[TempVC] 🧹 Iniciando limpieza de canales temporales huérfanos...');
  try {
    const tempChannels = await prisma.tempChannel.findMany();
    let deletedCount = 0;

    for (const tempDb of tempChannels) {
      try {
        const channel = await client.channels.fetch(tempDb.channelId).catch(() => null);

        // If the channel was deleted on Discord while the bot was offline, or is empty now, remove it
        if (!channel) {
          await prisma.tempChannel.delete({ where: { channelId: tempDb.channelId } });
          deletedCount++;
        } else if (channel.isVoiceBased() && channel.members.size === 0) {
          await channel.delete('[TempVC] Limpieza de canal vacío al iniciar el bot.').catch(() => { });
          await prisma.tempChannel.delete({ where: { channelId: tempDb.channelId } });
          deletedCount++;
        }
      } catch (err) {
        console.error(`[TempVC] Error al limpiar canal ${tempDb.channelId}:`, err);
      }
    }
    console.log(`[TempVC] ✨ Limpieza de canales completada. Removidos: ${deletedCount}`);
  } catch (err) {
    console.error('[TempVC] Error en la rutina de limpieza al inicio:', err);
  }
}
