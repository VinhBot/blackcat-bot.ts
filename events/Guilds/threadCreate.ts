import { EventBuilder } from "blackcat.js"; 
import { Events } from "discord.js";

export default new EventBuilder({
    eventCustomName: Events.ThreadCreate, // Tên sự kiện tùy chọn
    eventName: Events.ThreadCreate, // tên sự kiện theo Discord.Events
    eventOnce: false, // khởi chạy 1 lần
    executeEvents: async (client, thread, newlyCreated) => {
        if (thread.joinable) {
            try {
                await thread.join();
            } catch (e) {
                console.log(e);
            };
        };
    },
});