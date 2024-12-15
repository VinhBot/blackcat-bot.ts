import { CommandBuilder } from "../../structures";
import path from "node:path";

export default new CommandBuilder({
    prefixCommand: {
        name: path.basename(import.meta.url, ".ts"),
        aliases: ["g"],
        description: "",
        permissions: ["SendMessages"],
        cooldown: 3, // Thời gian cooldown, 
        executeCommand: async (client, message, args) => {
            
        }
    },
    slashCommand: {
        name: path.basename(import.meta.url, ".ts"),
        description: "",
        executeCommand: async(client, interaction) => {

        }
    }
});