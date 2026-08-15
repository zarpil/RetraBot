import { Message, EmbedBuilder, Client } from 'discord.js';
import { prisma } from 'shared';

// In-memory cooldowns map: key is `${userId}-${triggerId}`
const cooldowns = new Map<string, number>();

let discordClient: Client | null = null;

export function setCustomTriggersClient(client: Client) {
  discordClient = client;
}

/**
 * Handle incoming messages to check for custom triggers.
 */
export async function handleCustomTriggers(message: Message) {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const content = message.content.trim();

  // Find all triggers for this guild
  const triggers = await prisma.customTrigger.findMany({
    where: { guildId },
  });

  if (triggers.length === 0) return;

  // Find a matching trigger (case-insensitive prefix match)
  const matchedTrigger = triggers.find(t => {
    const triggerWord = t.trigger.toLowerCase();
    const msgWord = content.toLowerCase();
    
    // Check if the message is exactly the trigger, or starts with it followed by a space
    return msgWord === triggerWord || msgWord.startsWith(triggerWord + ' ');
  });

  if (!matchedTrigger) return;

  // Check allowed and ignored channels/categories
  const channelId = message.channel.id;
  const parentId = 'parentId' in message.channel ? (message.channel as any).parentId : null;

  // Check allowed channels/categories if configured
  if (matchedTrigger.allowedChannels) {
    const allowedList = matchedTrigger.allowedChannels.split(',').map(id => id.trim()).filter(Boolean);
    if (allowedList.length > 0) {
      const isAllowed = allowedList.includes(channelId) || (parentId && allowedList.includes(parentId));
      if (!isAllowed) return;
    }
  }

  // Check ignored channels/categories if configured
  if (matchedTrigger.ignoredChannels) {
    const ignoredList = matchedTrigger.ignoredChannels.split(',').map(id => id.trim()).filter(Boolean);
    if (ignoredList.length > 0) {
      const isIgnored = ignoredList.includes(channelId) || (parentId && ignoredList.includes(parentId));
      if (isIgnored) return;
    }
  }

  // Check roles if configured
  if (matchedTrigger.requiredRoles || matchedTrigger.ignoredRoles) {
    const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
    
    // Check required roles (user needs at least one of them)
    if (matchedTrigger.requiredRoles) {
      const requiredList = matchedTrigger.requiredRoles.split(',').map(id => id.trim()).filter(Boolean);
      if (requiredList.length > 0) {
        const hasRequired = member && requiredList.some(rId => member.roles.cache.has(rId));
        if (!hasRequired) return;
      }
    }
    
    // Check ignored/excluded roles (user cannot have any of them)
    if (matchedTrigger.ignoredRoles) {
      const ignoredList = matchedTrigger.ignoredRoles.split(',').map(id => id.trim()).filter(Boolean);
      if (ignoredList.length > 0) {
        const hasIgnored = member && ignoredList.some(rId => member.roles.cache.has(rId));
        if (hasIgnored) return;
      }
    }
  }

  // Check cooldown if configured
  if (matchedTrigger.cooldown > 0) {
    const cooldownKey = `${message.author.id}-${matchedTrigger.id}`;
    const lastUsed = cooldowns.get(cooldownKey) || 0;
    const now = Date.now();
    const cooldownMs = matchedTrigger.cooldown * 1000;

    if (now - lastUsed < cooldownMs) {
      const timeLeft = Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
      const reply = await message.reply(`⏰ Este comando está en cooldown. Espera **${timeLeft}s**.`);
      setTimeout(() => reply.delete().catch(() => null), 5000);
      return;
    }
    cooldowns.set(cooldownKey, now);
  }

  // Determine target channel
  let targetChannel = message.channel;
  if (matchedTrigger.targetChannelId) {
    const customChan = await message.guild.channels.fetch(matchedTrigger.targetChannelId).catch(() => null);
    if (customChan && customChan.isTextBased()) {
      targetChannel = customChan as any;
    }
  }

  // Helper function to replace placeholder variables
  const formatResponse = (text: string) => {
    return text
      .replace(/{user}/g, `<@${message.author.id}>`)
      .replace(/{username}/g, message.author.username)
      .replace(/{channel}/g, `<#${message.channel.id}>`);
  };

  try {
    if (matchedTrigger.responseType === 'EMBED') {
      let embedData;
      try {
        embedData = JSON.parse(matchedTrigger.response);
      } catch (err) {
        // Fallback to text if JSON is invalid
        await (targetChannel as any).send(formatResponse(matchedTrigger.response));
        return;
      }

      const embed = new EmbedBuilder();
      if (embedData.title) embed.setTitle(formatResponse(embedData.title));
      if (embedData.description) embed.setDescription(formatResponse(embedData.description));
      if (embedData.color) {
        // Support hex color
        embed.setColor(embedData.color);
      }
      if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
      if (embedData.image) embed.setImage(embedData.image);
      if (embedData.footer) {
        embed.setFooter({ text: formatResponse(embedData.footer.text || embedData.footer) });
      }
      if (embedData.fields && Array.isArray(embedData.fields)) {
        embed.addFields(embedData.fields.map((f: any) => ({
          name: formatResponse(f.name || ''),
          value: formatResponse(f.value || ''),
          inline: !!f.inline
        })));
      }

      await (targetChannel as any).send({ embeds: [embed] });
    } else {
      await (targetChannel as any).send(formatResponse(matchedTrigger.response));
    }
  } catch (error) {
    console.error(`Error sending custom trigger response for ${matchedTrigger.trigger}:`, error);
  }
}
