import { Events, ChannelType } from "discord.js";
import { isVoiceChannelEmpty } from "distube";
import { EventBuilder } from "blackcat.js"; 

export default new EventBuilder({
    eventCustomName: Events.VoiceStateUpdate, // Tên sự kiện tùy chọn
    eventName: Events.VoiceStateUpdate, // tên sự kiện theo Discord.Events
    eventOnce: false, // khởi chạy 1 lần
    executeEvents: async (client, oldState, newState) => {
        const VoiceConsole = false;
        if (VoiceConsole) {
            if (oldState.sessionId != newState.sessionId) return console.log(`${newState.member?.user.tag} sessionID Đang trên: ${newState.sessionId}`);
            if (oldState.serverMute && !newState.serverMute) return console.log(`${newState.member?.user.tag} Đã được mở tiếng (Server)`);
            if (!oldState.serverMute && newState.serverMute) return console.log(`${newState.member?.user.tag} Đã bị tắt tiếng (Server)`);
            if (oldState.streaming && !newState.streaming) return console.log(`${newState.member?.user.tag} Không còn phát trực tiếp`);
            if (oldState.serverDeaf && !newState.serverDeaf) return console.log(`${newState.member?.user.tag} Đã được mở âm (Server)`);
            if (!oldState.serverDeaf && newState.serverDeaf) return console.log(`${newState.member?.user.tag} Đã bị tắt âm (Server)`);
            if (oldState.selfVideo && !newState.selfVideo) return console.log(`${newState.member?.user.tag} Không còn chia sẻ video`);
            if (!oldState.streaming && newState.streaming) return console.log(`${newState.member?.user.tag} Đang phát trực tiếp`);
            if (!oldState.selfVideo && newState.selfVideo) return console.log(`${newState.member?.user.tag} Đang chia sẻ video`);
            if (oldState.selfMute && !newState.selfMute) return console.log(`${newState.member?.user.tag} Đã được mở tiếng`);
            if (!oldState.selfMute && newState.selfMute) return console.log(`${newState.member?.user.tag} Đã bị tắt tiếng`);
            if (oldState.selfDeaf && !newState.selfDeaf) return console.log(`${newState.member?.user.tag} Đã được mở âm`);
            if (!oldState.selfDeaf && newState.selfDeaf) return console.log(`${newState.member?.user.tag} Đã bị tắt âm`);
        };
        if (oldState.channel) {
            const voice = client.distube.voices.get(oldState);
            if (voice && isVoiceChannelEmpty(oldState)) {
                voice.leave();
            };
        };
        if(!oldState.channelId && newState.channelId || oldState.channelId && !newState.channelId || oldState.channelId && newState.channelId) {
            if (newState.channel?.type === ChannelType.GuildStageVoice && newState.guild.members.me?.voice.suppress) {
                try {
                    await newState.guild.members.me.voice.setSuppressed(false); // Bỏ tắt chế độ suppress
                } catch (e) {
                    console.log(String(e));
                };
            };
        };
    },
});