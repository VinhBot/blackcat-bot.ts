import type {
    Client,
    ChatInputCommandInteraction,
    Message,
    PermissionsString,
    OmitPartialGroupDMChannel,
    APIApplicationCommandOptionChoice, 
    ApplicationCommandOptionType
} from "discord.js";
import { ApplicationCommandType } from "discord.js";

interface CommandOptionsBase {
    /**
     * Tên của lệnh.
     */
    name: string;
    /**
     * Mô tả của lệnh.
     */
    description: string;
    /**
     * Quyền hạn của người dùng.
     */
    permissions?: PermissionsString[];
    /**
     * Lệnh dành cho chủ bot.
     */
    owner?: boolean;
    /**
     * Thời gian tái sử dụng lệnh.
     */
    cooldown?: number;
}

interface PrefixCommandOptions extends CommandOptionsBase {
    /**
     * Tên lệnh phụ.
     */
    aliases?: string[];
    /**
     * Hàm thực thi lệnh.
     */
    executeCommand: (client: Client, message: OmitPartialGroupDMChannel<Message>, args: string[]) => void;
}

interface SlashCommandOption {
    /**
     * Tên của tùy chọn.
     */
    name: string;
    /**
     * Kiểu dữ liệu của tùy chọn.
     */
    type: "Subcommand" | "SubcommandGroup" | "String" | "Integer" | "Boolean" | "User" | "Channel" | "Role" | "Mentionable" | "Number" | "Attachment" | ApplicationCommandOptionType;
    /**
     * Mô tả của tùy chọn.
     */
    description: string;
    /**
     * Tùy chọn này có bắt buộc không.
     */
    required: boolean;
    /**
     * Các tùy chọn con bên trong.
     */
    options?: SlashCommandOption[];
    /**
     * Các lựa chọn (choices) có sẵn cho tùy chọn này.
     */
    choices?: APIApplicationCommandOptionChoice<string>[];
}

interface SlashCommandOptions extends CommandOptionsBase {
    /**
     * Kiểu dữ liệu của lệnh, chỉ bắt buộc nếu không có options.
     */
    type?: string | number | ApplicationCommandType;
    /**
     * Các tùy chọn con của lệnh.
     */
    options?: SlashCommandOption[];
    /**
     * Hàm thực thi lệnh.
     */
    executeCommand: (client: Client, interaction: ChatInputCommandInteraction<"cached">) => void;
}

interface CommandBuilderOptions {
    /**
     * Lệnh tiền tố.
     */
    prefixCommand?: PrefixCommandOptions;
    /**
     * Lệnh gạch chéo.
     */
    slashCommand?: SlashCommandOptions;
}

class CommandBuilder {
    private prefixCommands: Partial<PrefixCommandOptions>;
    private slashCommands: Partial<SlashCommandOptions>;
    constructor(options: Partial<CommandBuilderOptions> = {}) {
        this.prefixCommands = this.#PrefixCommand(options.prefixCommand);
        this.slashCommands = this.#SlashCommand(options.slashCommand);
    }
    #PrefixCommand(command?: PrefixCommandOptions): Partial<PrefixCommandOptions> {
        if (!command) return {};
        if (!command.name || typeof command.name !== "string") {
            throw new Error("Vui lòng thêm tên cho lệnh.");
        }
        return {
            name: command.name,
            description: command.description,
            permissions: command.permissions || ["SendMessages"],
            cooldown: command.cooldown || 3,
            aliases: command.aliases,
            owner: command.owner || false,
            executeCommand: command.executeCommand,
        };
    }
    #SlashCommand(command?: SlashCommandOptions): Partial<SlashCommandOptions> {
        if (!command) return {};
        if (!command.name || typeof command.name !== "string") {
            throw new Error("Vui lòng thêm tên cho lệnh.");
        }
        if (!command.description || typeof command.description !== "string") {
            throw new Error("Vui lòng thêm mô tả cho lệnh.");
        }
        if (!command.type && !command.options) {
            throw new Error("Type hoặc Options phải được xác định.");
        }
        function validateType(type: string | number): ApplicationCommandType {
            switch (type.toString().toLowerCase()) {
                case "chatinput":
                case ApplicationCommandType.ChatInput.toString():
                    return ApplicationCommandType.ChatInput;
                case "user":
                case ApplicationCommandType.User.toString():
                    return ApplicationCommandType.User;
                case "message":
                case ApplicationCommandType.Message.toString():
                    return ApplicationCommandType.Message;
                default:
                    throw new Error("Thể loại lệnh không hợp lệ.");
            }
        }
        return {
            name: command.name,
            description: command.description,
            permissions: command.permissions || ["SendMessages"],
            cooldown: command.cooldown,
            type: command.type ? validateType(command.type as string) : undefined,
            options: command.options,
            executeCommand: command.executeCommand,
        };
    }

    public toJSON() {
        return {
            prefixCommand: this.prefixCommands,
            slashCommand: this.slashCommands,
        };
    }
}

export { CommandBuilder };