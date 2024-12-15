import type { GuildTextBasedChannel } from "discord.js";
import { CommandBuilder } from "../../structures";

export default new CommandBuilder({
    prefixCommand: {
        name: "play",
        permissions: ["SendMessages"], // Quyền cần thiết để sử dụng lệnh
        aliases: ["p"], // Tên lệnh phụ.
        owner: false, // Lệnh chỉ dùng cho chủ bot.
        description: "Phát nhạc theo yêu cầu", // Mô tả chức năng của lệnh.
        cooldown: 3, // Thời gian hồi lệnh, 
        executeCommand: async (client, message, args) => {
            const queue = client.distube.getQueue(message.guildId as string);
            const VoiceChannel = message.member?.voice.channel;
            if (!VoiceChannel) return message.reply({ content: "Bạn chưa tham gia kênh voice" });
            const Text = args.join(" ");
            await message.react('🔍');
            if (!Text) return message.reply({ content: "Vui lòng nhập url bài hát hoặc truy vấn để tìm kiếm." });
            let newmsg = await message.reply({ content: ` Đang tìm kiếm bài hát:  \`\`\`${Text}\`\`\`` });
            client.distube.play(VoiceChannel, Text, {
                textChannel: message.channel as GuildTextBasedChannel,
                member: message.member,
                message: message,
            });
            newmsg.edit({ content: `${queue?.songs.length as number > 0 ? "👍 Thêm" : "🎶 Đang phát"}: \`\`\`css\n${Text}\n\`\`\`` });
        },
    },
});