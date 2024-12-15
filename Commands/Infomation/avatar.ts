import { CommandBuilder, Discord } from "../../structures";
import path from "node:path";

export default new CommandBuilder({
    prefixCommand: {
        name: path.basename(import.meta.url, ".ts"),
        aliases: ["avt"],
        description: "Xem hình ảnh đại diện của người dùng",
        permissions: ["SendMessages"],
        cooldown: 3, // Thời gian cooldown, 
        executeCommand: async (client, message, args) => {
            try {
                const users = message.mentions.users.first() || message.author;
                if (!users) return;
                return message.reply({
                    content: users.displayAvatarURL({ extension: "png", forceStatic: true, size: 4096 }),
                });
            } catch (error: any) {
                console.log(String(error.stack));
            };
        }
    },
    slashCommand: {
        name: path.basename(import.meta.url, ".ts"),
        description: "Xem hình ảnh đại diện của người dùng",
        type: "ChatInput",
        options: [
            {
                name: "user",
                type: Discord.ApplicationCommandOptionType.User,
                description: "Bạn muốn xem hình ảnh đại diện của ai?",
                required: true,
            }
        ],
        executeCommand: async (client, interaction) => {
            try {
                const users = interaction.options.getUser("user");
                return interaction.reply({
                    content: users.displayAvatarURL({ extension: "png", forceStatic: true, size: 4096 }),
                });
            } catch (error: any) {
                console.log(String(error.stack));
            };
        }
    }
});