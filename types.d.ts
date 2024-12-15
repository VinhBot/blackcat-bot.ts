import type { Collection, Interaction, Message, PermissionsString, ChatInputCommandInteraction } from "discord.js";
import type { SlashCommandOption } from "blackcat.js";
import type Economy from "discord-economy-super/mongodb";
import type { Client } from "./structures";
import type DisTube from "distube";

export interface Config {
    botToken: string;
    botPrefix: string;
    mongourl: string;
    developer: string;
    // distube.
    spotifyClientId: string;
    spotifyClientSecret: string;
    youtubeCookie: string;
}

export interface CommandHandler {
    pathToCommand: string;
    restVersion?: "10" | "9";
    guildCommands?: string;
}

export interface EventHandler {
    /**
     * Tên thư mục chứa các Events.
     */
    eventFolder: string[];
    /**
     * Đường dẫn đến thư mục sự kiện của bạn.
     * @example
     * pathToEvent: "./pathToEvent",
     */
    pathToEvent: string;
}

export type Command = {
    name: string;
    permissions?: PermissionsString;
    aliases?: string[];
    cooldown?: number;
    owner?: boolean;
    executeCommand: (client: Client, message: Message, args: string[]) => void;
};

export interface CommandHandlers {
    fileName: string;
    command: {
        prefixCommands: Command;
        slashCommands: {
            name: string;
            description: string;
            options: SlashCommandOption[];
            type: string;
            cooldown: number;
            executeCommand: (client: Client, interaction: ChatInputCommandInteraction<"cached">) => void;
        };
    }
}

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            botToken: string;
        }
    }
}

declare module "discord.js" {
    interface Client {
        slashCommands: Collection<string, {
            name: string;
            description: string;
            options: SlashCommandOption[];
            type: string;
            cooldown: number;
            executeCommand: (client: Client, interaction: ChatInputCommandInteraction<"cached">) => void;
        }>; 
        cooldowns: Collection<string, Collection<string, number>>; 
        commands: Collection<string, Command>; 
        aliases: Collection<string, string>;
        economy: Economy<true>;
        distube: DisTube;
        config: Config;
    }
}