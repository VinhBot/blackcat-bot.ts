import { Client as DiscordClient, GatewayIntentBits, Partials, Collection, Routes, REST, InteractionType, EmbedBuilder, PermissionsBitField } from "discord.js";
import type { ChatInputCommandInteraction, Interaction, Message } from "discord.js";
import type { SlashCommandOptions } from "blackcat.js";
// import Economy from "discord-economy-super/mongodb";
import { AsciiTable3 } from "ascii-table3";
import { pathToFileURL } from "node:url";
import colors from "colors";
import fs from "node:fs";

import { Command, CommandHandler, CommandHandlers, Config, EventHandler } from "../types";
import { MessageEmbed } from "./MessageEmbed.ts";
import { DistubeHandler } from "./Distube.ts";
import { config } from "../config.ts";

export class Client extends DiscordClient<true> {
    public slashCommands: Collection<string, {
        name: string;
        description: string;
        options: SlashCommandOptions["options"][];
        type: string;
        cooldown: number;
        executeCommand: (client: DiscordClient<true>, interaction: ChatInputCommandInteraction<"cached">) => void;
    }>;
    public cooldowns: Collection<string, Collection<string, number>>;
    public commands: Collection<string, Command>;
    public aliases: Collection<string, string>;
    // public economy: Economy<true>;
    public distube: DistubeHandler;
    public config: Config;
    constructor() {
        super({
            shards: "auto",
            partials: [
                Partials.Channel,
                Partials.Message,
                Partials.GuildMember,
                Partials.ThreadMember,
                Partials.Reaction,
                Partials.User,
                Partials.GuildScheduledEvent,
            ],
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildEmojisAndStickers,
                GatewayIntentBits.GuildIntegrations,
                GatewayIntentBits.GuildWebhooks,
                GatewayIntentBits.GuildInvites,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.DirectMessageReactions,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.AutoModerationExecution,
                GatewayIntentBits.AutoModerationConfiguration
            ],
            failIfNotExists: false,
            allowedMentions: {
                parse: [],
                users: [],
                roles: [],
                repliedUser: false,
            }
        });
        // thiết lập cấu hình collection
        this.slashCommands = new Collection(); // Lưu trữ các slash commands.
        this.cooldowns = new Collection(); // Quản lý cooldown của lệnh.
        this.commands = new Collection(); // Lưu trữ các lệnh thông thường.
        this.aliases = new Collection(); // Lưu trữ các bí danh của lệnh.
        this.config = config; // định nghĩa cấu hình cho bot.
        // this.economy = new Economy<true>({
        //     connection: {
        //         connectionURI: this.config.mongourl,
        //         collectionName: "economy",
        //         dbName: "BlackCat-Discord",
        //     },
        //     dailyCooldown: 60000 * 60 * 24, // Thời gian chờ cho lệnh hàng ngày (tính bằng ms). Mặc định: 24 giờ (60000 * 60 * 24 ms).
        //     workCooldown: 60000 * 60, // * Thời gian chờ cho lệnh làm việc (tính bằng ms). Mặc định: 1 giờ (60000 * 60 ms).
        //     weeklyCooldown: 60000 * 60 * 24 * 7, // Thời gian chờ cho lệnh hàng tuần (tính bằng ms). Mặc định: 7 ngày (60000 * 60 * 24 * 7 ms).
        //     dailyAmount: [50, 200], // Số tiền thưởng hàng ngày. Mặc định: 100.
        //     monthlyAmount: [50, 1000], // Số tiền thưởng hàng tháng. Mặc định: 10000.
        //     monthlyCooldown: 2629746000, // Thời gian chờ cho phần thưởng hàng tháng (tính bằng ms). Mặc định: 1 tháng (2629746000 ms).
        //     hourlyAmount: [50, 1000], // Số tiền thưởng hàng giờ. Mặc định: 10000.
        //     hourlyCooldown: 3600000, // Thời gian chờ cho phần thưởng hàng giờ (tính bằng ms). Mặc định: 1 giờ (3600000 ms).
        //     savePurchasesHistory: true, // module sẽ lưu toàn bộ lịch sử mua hàng.
        //     workAmount: [10, 50], // Số tiền thưởng cho lệnh làm việc. Mặc định: [10, 50].
        //     subtractOnBuy: true, // khi ai đó mua hàng, số dư của họ sẽ bị trừ đi theo giá của sản phẩm.
        //     weeklyAmount: [100, 1000], // Số tiền thưởng hàng tuần. Mặc định: 1000.
        //     sellingItemPercent: 73.15, // Phần trăm giá của sản phẩm sẽ được bán ra.
        //     deprecationWarnings: false, // các cảnh báo không khuyến nghị sẽ được hiển thị trong console.
        //     updater: {
        //         checkUpdates: false, // Gửi thông báo trạng thái cập nhật trong console khi bắt đầu.
        //         upToDateMessage: true, // Gửi thông báo trong console khi bắt đầu nếu module đã cập nhật.
        //     },
        //     errorHandler: {
        //         handleErrors: true, // Xử lý tất cả các lỗi khi khởi động.
        //         attempts: 1, // Số lần thử tải module. Sử dụng 0 cho số lần thử vô hạn. Mặc định: 5.
        //         time: 3600000,
        //     },
        //     optionsChecker: {
        //         ignoreInvalidTypes: false, // Cho phép phương thức bỏ qua các tùy chọn có kiểu không hợp lệ.
        //         ignoreUnspecifiedOptions: true, // Cho phép phương thức bỏ qua các tùy chọn không được chỉ định.
        //         ignoreInvalidOptions: false, // Cho phép phương thức bỏ qua các tùy chọn không tồn tại.
        //         showProblems: true, // Cho phép phương thức hiển thị tất cả các vấn đề trong console.
        //         sendLog: true, // Cho phép phương thức gửi kết quả trong console.
        //         sendSuccessLog: false, // Cho phép phương thức gửi kết quả nếu không có vấn đề nào được tìm thấy. 
        //     },
        //     debug: false, // Bật hoặc tắt chế độ gỡ lỗi.
        // });
        this.distube = new DistubeHandler(this);
    }
    /**
     * bắt đầu sử dụng lệnh.
     * @param {CommandHandler} options - cấu hình lệnh.
     */
    private async commandHandler(options: CommandHandler) {
        const commandTable = new AsciiTable3("Commands").setHeading("Tên Lệnh", "Trạng thái").setStyle("unicode-round");
        const allSlashCommands: any[] = [];
        for (const dir of fs.readdirSync(options.pathToCommand)) {
            const commandFiles = fs.readdirSync(`${options.pathToCommand}/${dir}`).filter((file) => file.endsWith(".ts") || file.endsWith(".js"));
            // Import các file command song song
            const commands = await Promise.all(commandFiles.map((Cmds) => import(this.globalFilePath(`${options.pathToCommand}/${dir}/${Cmds}`)).then((e) => ({ command: e.default, fileName: Cmds })))) as CommandHandlers[];
            for (const { command, fileName } of commands) {
                // Xử lý lệnh prefix
                if (command?.prefixCommands?.name && typeof command === "object") {
                    this.commands.set(command.prefixCommands.name, command.prefixCommands);
                    command.prefixCommands.aliases.forEach((alias) => this.aliases.set(alias, command.prefixCommands.name));
                }
                // Xử lý lệnh slash
                if (command?.slashCommands?.name && typeof command === "object") {
                    this.slashCommands.set(command.slashCommands.name, command.slashCommands);
                    allSlashCommands.push({
                        name: command.slashCommands.name.toLowerCase(),
                        description: command.slashCommands.description,
                        options: command.slashCommands.options || null,
                        type: command.slashCommands.type,
                    });
                }
                // Thêm vào bảng trạng thái của lệnh
                if (command?.prefixCommands && command?.slashCommands) {
                    commandTable.addRowMatrix([[command.prefixCommands.name || command?.slashCommands.name, "✔️ sẵn sàng"]]);
                } else {
                    commandTable.addRowMatrix([[fileName, "❌ Lỗi"]]);
                }
            }
        }
        console.log(colors.cyan(commandTable.toString()));
        this.on("ready", async (bot) => {
            const rest = new REST({ version: options.restVersion || "10" }).setToken(this.config.botToken);
            if (options.guildCommands) {
                await rest.put(Routes.applicationGuildCommands(bot.user.id, options.guildCommands), {
                    body: allSlashCommands,
                });
            } else {
                // Gửi request PUT để cập nhật slash commands.
                await rest.put(Routes.applicationCommands(bot.user.id), {
                    body: allSlashCommands,
                });
            };
        });
    }
    /**
     * 
     */
    private EventHandler(options: EventHandler) {
        options.eventFolder.forEach(async (eventsDir) => {
            // Tạo bảng ASCII để hiển thị thông tin về các sự kiện.
            let table = new AsciiTable3("Events - Create").setHeading("Tên events", "Trạng thái").setStyle("unicode-round");
            // Duyệt qua từng file sự kiện trong thư mục
            for (const file of fs.readdirSync(`${options.pathToEvent}/${eventsDir}`).filter((file) => file.endsWith(".ts") || file.endsWith(".js"))) {
                // Import sự kiện từ file và lấy default export của nó.
                let events = await import(this.globalFilePath(`./${options.pathToEvent}/${eventsDir}/${file}`)).then((e) => e.default);
                // Gán sự kiện vào client, sử dụng once() hoặc on() tùy thuộc vào eventOnce của sự kiện.
                if (events.eventOnce) {
                    this.once(events.eventName, (...args: string[]) => events.executeEvents(this, ...args));
                } else {
                    this.on(events.eventName, (...args: string[]) => events.executeEvents(this, ...args));
                };
                // Thêm thông tin của sự kiện vào bảng ASCII.
                if (events.eventName) {
                    table.addRowMatrix([[events.eventCustomName, "✔️ sẵn sàng"]]);
                } else {
                    table.addRowMatrix([[events.eventCustomName, "❌"]]);
                };
            };
            // Log bảng ASCII vào console.
            console.log(colors.magenta(table.toString()));
        });
    }
    /**
     * 
     */
    private executeCommand() {
        this.on("interactionCreate", async (interaction) => {
            /**
             * Kiểm tra thời gian cooldown cho một lệnh.
             * @param {Object} commandName - Tên của lệnh.
             * @param {number} cooldownTime - Thời gian cooldown cho lệnh (đơn vị: giây).
             * @returns {number | null} - Thời gian còn lại cho cooldown (nếu có), null nếu đã hết cooldown.
             */
            function checkCooldown(client: Client, commandName: any, cooldownTime: number, interaction: Interaction): string | null {
                if (!client.cooldowns.has(commandName.name)) {
                    client.cooldowns.set(commandName.name, new Collection());
                };
                const now = Date.now();
                const timestamps = client.cooldowns.get(commandName.name);
                const cooldownAmount = cooldownTime * 1000; // chuyển cooldownTime từ giây sang milliseconds
                if (timestamps.has(interaction.user.id)) {
                    const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
                    if (now < expirationTime) {
                        const timeLeft = (expirationTime - now) / 1000;
                        return timeLeft.toFixed(1);
                    };
                };
                timestamps.set(interaction.user.id, now);
                setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
                return null;
            };
            // Kiểm tra nếu interaction là một lệnh ứng dụng
            if (interaction.type === InteractionType.ApplicationCommand) {
                if (!this.slashCommands.has(interaction.commandName) || interaction.user.bot || !interaction.guild) return;
                const SlashCommands = this.slashCommands.get(interaction.commandName);
                if (!SlashCommands) return;
                if (SlashCommands) {
                    // Tạo một embed mới cho mỗi lần reply
                    const embed = new EmbedBuilder().setTitle("Thiếu quyền sử dụng lệnh").setColor("Random");
                    try {
                        // Kiểm tra nếu người gửi là chủ sở hữu và có quyền sử dụng lệnh
                        // if (SlashCommands.owner && client.config.developer.includes(interaction.user.id)) return interaction.reply({
                        //     content: "Tôi, không phải là bot ngu ngốc, chỉ chủ sở hữu mới có thể sử dụng lệnh này"
                        // });
                        // Kiểm tra quyền của người gửi
                        // if (SlashCommands.permissions && interaction.memberPermissions?.has(PermissionsBitField.resolve(SlashCommands.permissions || []))) return interaction.reply({
                        //     embeds: [embed.setDescription(`Xin lỗi, bạn không có quyền ${SlashCommands.permissions} trong <#${interaction.channelId}> để sử dụng lệnh ${SlashCommands.name} này`)]
                        // });
                        // Kiểm tra cooldown
                        const remainingTime = checkCooldown(this, SlashCommands, SlashCommands.cooldown, interaction);
                        if (remainingTime !== null) return await interaction.reply({
                            content: `Bạn sử dụng lệnh ${SlashCommands.name} quá nhanh. vui lòng sử dụng lại sau ${remainingTime} giây.`
                        });
                        SlashCommands.executeCommand(this, interaction as ChatInputCommandInteraction<"cached">);
                    } catch (error) {
                        if (interaction.replied) return await interaction.editReply({
                            embeds: [embed.setDescription("Đã xảy ra lỗi khi thực hiện lệnh, xin lỗi vì sự bất tiện <3")]
                        });
                        console.log(error);
                    };
                };
            };
        });
        /**
         * MessageCreate.
         */
        this.on("messageCreate", (message) => {
            function onCooldown(cooldowns: Collection<string, Collection<string, number>>, botMessage: Message, command: Command): number | false | undefined {
                if (!botMessage || !command) return;
                const timestamps = cooldowns.get(command.name) || cooldowns.set(command.name, new Collection()).get(command.name);
                if (!timestamps) return;
                const cooldownAmount = (command.cooldown ?? 0) * 1000;
                const expirationTime = timestamps.get(botMessage.member!.id) ?? 0 + cooldownAmount;
                if (Date.now() < expirationTime) {
                    return (expirationTime - Date.now()) / 1000;
                };
                timestamps.set(botMessage.member!.id, Date.now());
                setTimeout(() => timestamps.delete(botMessage.member!.id), cooldownAmount);
                return false;
            };
            if (!message.author.bot && message.content.startsWith(this.config.botPrefix)) {
                const args = message.content.slice(this.config.botPrefix.length).trim().split(/ +/g);
                const commandName = args.shift()?.toLowerCase() || '';
                if (commandName.length === 0) return;
                let command = this.commands.get(commandName) as Command;
                if (!command) command = this.commands.get(this.aliases.get(commandName)) as Command;
                if (command) {
                    const embed = new MessageEmbed({
                        title: { text: "Thiếu quyền" },
                        colors: "Random",
                    });
                    if (command.permissions && !message.member!.permissions.has(PermissionsBitField.resolve(command.permissions))) {
                        message.reply({
                            embeds: [embed.setDescription(`Bạn không có quyền ${command.permissions} để sử dụng lệnh này`)],
                        });
                    };
                    const cooldownTime = onCooldown(this.cooldowns, message, command);
                    if (cooldownTime) {
                        message.reply({
                            content: `❌ Bạn đã sử dụng lệnh quá nhanh, vui lòng đợi ${cooldownTime.toFixed()} giây trước khi sử dụng lại ${command.name}`,
                        });
                    };
                    if (command.owner && message.author.id !== this.config.developer) {
                        message.reply({
                            embeds: [embed.setDescription(`Bạn không thể sử dụng lệnh này, chỉ có <@${this.config.developer}> mới có thể sử dụng`)],
                        });
                    };
                    command.executeCommand(this, message, args);
                } else {
                    message.reply({ content: `Sai lệnh. Nhập ${this.config.botPrefix}help để xem lại tất cả các lệnh` }).then((msg: Message) => {
                        setTimeout(() => msg.delete(), 5000);
                    });
                };
            } else {
                if (message.mentions.users.has(this.user!.id)) {
                    message.reply({ content: `Xin chào. prefix của tôi là: ${this.config.botPrefix}` });
                };
            };
        });
    }
    /**
     * Chuyển đổi đường dẫn thành URL file
     * @param path Đường dẫn cần chuyển đổi
     * @returns URL của file hoặc đường dẫn gốc nếu không thể chuyển đổi
     */
    private globalFilePath(path: string): string {
        return pathToFileURL(path)?.href || path;
    }
    /**
     * Khởi tạo và cấu hình bot Discord
     * 
     * Phương thức này thực hiện các bước sau:
     * 1. Đăng ký và xử lý các lệnh từ thư mục Commands
     * 2. Đăng ký các event handler từ thư mục events/Client và events/Guilds  
     * 3. Thiết lập xử lý lệnh
     * 4. Đăng nhập bot với token được cung cấp
     * 
     * @example
     * const client = new Client();
     * client.build();
     */
    public build(): void {
        this.commandHandler({
            pathToCommand: "./Commands",
            restVersion: "10",
        });
        this.EventHandler({
            eventFolder: ["Client", "Guilds"],
            pathToEvent: "./events",
        });
        this.executeCommand();
        this.login(this.config.botToken);
    };
}