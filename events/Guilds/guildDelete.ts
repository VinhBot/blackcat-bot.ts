import { Events } from "discord.js";
import { EventBuilder } from "blackcat.js"; 
import databases from "../../Schema/databases";

export default new EventBuilder({
    eventCustomName: Events.GuildDelete,
    eventName: Events.GuildDelete,
    eventOnce: false,
    executeEvents: async(client, guild) => {
        if (!guild) return;
        await databases.deleteMany({ GuildId: guild.id });
    },
});