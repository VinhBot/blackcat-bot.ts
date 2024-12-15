import { Events, PermissionFlagsBits, ChannelType } from "discord.js";
import type { TextChannel, GuildMember } from "discord.js";
import { EventBuilder } from "blackcat.js"; 
import { MessageEmbed } from "../../structures";
import databases from "../../Schema/databases";

export default new EventBuilder({
    eventCustomName: Events.GuildCreate,
    eventName: Events.GuildCreate,
    eventOnce: false,
    executeEvents: async(client, guild) => {
        if (!guild) return;
        // Khởi tạo data mặc định cho guild
        await databases.create({
            GuildName: guild.name,
            GuildId: guild.id,
            Prefix: client.config.botPrefix,
        });
        // tìm một phiên bản kênh, bên trong guild, nơi bot có Quyền, để gửi tin nhắn.
        const channels = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && channel.permissionsFor(guild.members.me as GuildMember).has(PermissionFlagsBits.SendMessages)) as TextChannel;
        // Nếu không tìm thấy kênh nào trả về
        if (!channels) return;
        if (channels.permissionsFor(guild.members.me as GuildMember).has(PermissionFlagsBits.EmbedLinks)) {
            const embeds = new MessageEmbed();
            embeds.setTitle("Cảm ơn bạn đã mời tôi!");
            embeds.setColor("Random");
            channels.send({ embeds: [embeds] });
        } else return;
    },
});