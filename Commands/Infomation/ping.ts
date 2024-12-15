import { MessageEmbed, CommandBuilder } from "../../structures";

const pingImageArr: string[] = [
    "https://cdn.discordapp.com/attachments/892794857905602560/892794900863660062/63e1657a8a6249a2fc9c062b17f27ce0.gif",
    "https://cdn.discordapp.com/attachments/892794857905602560/892795017104613376/dc87c9ea90b4b7d02a0cbe5de256d385.gif",
    "https://cdn.discordapp.com/attachments/892794857905602560/892795143093108806/a665463e60ef772c82286e4ee6a15353.gif",
    "https://cdn.discordapp.com/attachments/892794857905602560/892795222986207293/4a3a4f44524556704c29879feeba0c23.gif",
    "https://cdn.discordapp.com/attachments/892794857905602560/892795292573913098/534d38d35eb761ad11e43fe378c3de29.gif",
    "https://cdn.discordapp.com/attachments/892794857905602560/892795346172928080/c17166b2af1a743b149e1eb0f3203db4.gif",
    "https://cdn.discordapp.com/attachments/892794857905602560/892795432797872188/6619fe492c713eb3051ab7568181dbdd.gif"
];

export default new CommandBuilder({
    prefixCommand: {
        name: "ping",
        aliases: ["pong", "pings", "pingbot", "botping"],
        description: "Hiển thị độ trễ phản hồi của bot.",
        permissions: ["SendMessages"],
        cooldown: 3, // Thời gian cooldown, 
        executeCommand: async (client, message, args) => {
            const Ping: number = client.ws.ping;
            const loadingEmbed = new MessageEmbed({
                title: { text: '🏓 Pong' },
                description: "***Đang tải dữ liệu...*** 💬",
                thumbnail: pingImageArr[Math.floor(Math.random() * pingImageArr.length)],
                colors: "Random"
            });
            const pingEmbed = new MessageEmbed({
                title: { text: '🏓 Pong' },
                colors: (Ping <= 300) ? "#00ff00" : (Ping > 300 && Ping < 600) ? "#ffff00" : (Ping >= 600 && Ping < 900) ? "#ffa500" : (Ping >= 900) ? "#ff0000" : "#ff0033",
                fields: [
                    { name: "Nhịp websocket", value: `\`\`\`yaml\n${Ping} Ms\`\`\``, inline: true },
                    { name: "Độ trễ khứ hồi", value: `\`\`\`yaml\n${Math.abs(message.createdTimestamp - Date.now())} Ms\`\`\``, inline: true },
                    { name: "Độ trễ API", value: `\`\`\`yaml\n${Math.round(client.ws.ping)} Ms\`\`\``, inline: true },
                    { name: "Sử dụng bộ nhớ", value: `\`\`\`yaml\n${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\`\`\``, inline: true },
                ]
            });
            const msg = await message.channel.send({ embeds: [loadingEmbed] });
            setTimeout(() => {
                msg.edit({ embeds: [pingEmbed] });
            }, 3001);
        },
    },
    slashCommand: {
        name: "ping",
        description: "Hiển thị độ trễ phản hồi của bot.",
        permissions: ["SendMessages"],
        type: "ChatInput",
        executeCommand: async(client, interaction) => {
            const Ping: number = client.ws.ping;
            const loadingEmbed = new MessageEmbed({
                title: { text: '🏓 Pong' },
                description: "***Đang tải dữ liệu...*** 💬",
                thumbnail: pingImageArr[Math.floor(Math.random() * pingImageArr.length)],
                colors: "Random"
            });
            const pingEmbed = new MessageEmbed({
                title: { text: '🏓 Pong' },
                colors: (Ping <= 300) ? "#00ff00" : (Ping > 300 && Ping < 600) ? "#ffff00" : (Ping >= 600 && Ping < 900) ? "#ffa500" : (Ping >= 900) ? "#ff0000" : "#ff0033",
                fields: [
                    { name: "Nhịp websocket", value: `\`\`\`yaml\n${Ping} Ms\`\`\``, inline: true },
                    { name: "Độ trễ khứ hồi", value: `\`\`\`yaml\n${Math.abs(interaction.createdTimestamp - Date.now())} Ms\`\`\``, inline: true },
                    { name: "Độ trễ API", value: `\`\`\`yaml\n${Math.round(client.ws.ping)} Ms\`\`\``, inline: true },
                    { name: "Sử dụng bộ nhớ", value: `\`\`\`yaml\n${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\`\`\``, inline: true },
                ]
            });
            await interaction.reply({ embeds: [loadingEmbed] });
            setTimeout(async() => {
                await interaction.editReply({ embeds: [pingEmbed] });
            }, 3001);
        },
    },
});