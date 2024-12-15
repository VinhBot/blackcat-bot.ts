import { Events, ActivityType } from "discord.js";
import { EventBuilder, setMongoURL } from "blackcat.js";

export default new EventBuilder({
    eventCustomName: "ready.ts",
    eventName: Events.ClientReady,
    eventOnce: false,
    executeEvents: (client, bot) => {
        const setActivities = [
            `${client.guilds.cache.size} Guilds, ${client.guilds.cache.map((c) => c.memberCount).filter((v) => typeof v === "number").reduce((a, b) => a + b, 0)} member`,
            `${client.config.botPrefix}help`,
            `BlackCat-Club`,
        ];
        setMongoURL(client.config.mongourl, {
            dbName: "BlackCat-Discord",
        }).then(() => console.log("Đã kết nối thành công.")).catch((e: Error) => console.log(e));
        setInterval(() => bot.user.setPresence({
            activities: [
                {
                    name: setActivities[Math.floor(Math.random() * setActivities.length)],
                    type: ActivityType.Playing
                },
            ],
            status: "dnd",
        }), 5000);
    },
});