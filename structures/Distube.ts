import DisTube, { Song, Queue, Events as DistubeEvents, formatDuration } from "distube";
import { ChannelType, Events as DiscordEvents } from "discord.js";
import type { ButtonBuilder, Guild, GuildMember, GuildTextBasedChannel, Message, TextChannel, VoiceBasedChannel } from "discord.js";
import { ComponentBuilder, ms, toButtonStyle } from "blackcat.js";
import { SpotifyPlugin } from "@distube/spotify";
import { YouTubePlugin } from "@distube/youtube";
import ffmpegStatic from "ffmpeg-static";
import colors from "colors";

import type { Client } from "./BotClient";
import { MessageEmbed } from "./MessageEmbed.ts";
import autoresume from "../Schema/autoresume.ts";
import databases from "../Schema/databases.ts";

export class DistubeHandler extends DisTube {
    public maps: Map<any, any>;
    constructor(client: Client) {
        super(client, {
            emitAddListWhenCreatingQueue: false, // Có hay không phát sự kiện addList khi tạo Queue mới.
            emitAddSongWhenCreatingQueue: false, // Có hoặc không phát sự kiện addSong khi tạo Hàng đợi mới.
            emitNewSongOnly: true, // Có hay không phát ra DisTube#event:playSong khi lặp một bài hát hoặc bài hát tiếp theo giống như bài hát trước đó.
            joinNewVoiceChannel: false, // Có tham gia kênh voice mới hay không khi sử dụng phương thức DisTube#play.
            savePreviousSongs: true, // Có hoặc không lưu các bài hát trước đó của hàng đợi và bật phương thức DisTube#previous.
            nsfw: true, // Có hay không phát nội dung giới hạn độ tuổi và tắt tính năng tìm kiếm an toàn trong kênh không thuộc NSFW.
            plugins: [
                new SpotifyPlugin({
                    api: {
                        clientId: client.config.spotifyClientId, // Client ID của ứng dụng Spotify của bạn (Tùy chọn - Được sử dụng khi plugin không thể tự động lấy thông tin đăng nhập)
                        clientSecret: client.config.spotifyClientSecret, // Client Secret của ứng dụng Spotify của bạn (Tùy chọn - Được sử dụng khi plugin không thể tự động lấy thông tin đăng nhập)
                        topTracksCountry: "VN", // Mã quốc gia của các bản nhạc của nghệ sĩ hàng đầu (mã quốc gia ISO 3166-1 alpha-2). Mặc định là US.
                    },
                }),
                new YouTubePlugin({
                    cookies: [
                        {
                            domain: ".youtube.com",
                            expirationDate: 1234567890,
                            hostOnly: false,
                            httpOnly: true,
                            name: "LOGIN_INFO",
                            path: "/",
                            sameSite: "no_restriction",
                            secure: true,
                            value: client.config.youtubeCookie,
                        },
                    ],
                }),
            ], // DisTube plugins.
            ffmpeg: {
                path: ffmpegStatic as string,
            },
        });
        /** Map để lưu trữ các khoảng thời gian và dữ liệu liên quan đến người chơi. */
        const playerintervals = new Map<string, NodeJS.Timeout>();
        const PlayerMap = new Map<string, any>();
        let songEditInterval: NodeJS.Timeout | null = null; // Khoảng thời gian để chỉnh sửa thông tin bài hát.
        let lastEdited: boolean = false; // Cờ để theo dõi trạng thái chỉnh sửa cuối cùng
        this.maps = new Map();
        /**
         * Sử dụng các events của distube.
         */
        // Được phát ra khi DisTube khởi tạo hàng đợi để thay đổi thuộc tính mặc định của hàng đợi.
        this.on(DistubeEvents.INIT_QUEUE, async (queue) => {
            const newQueue = this.getQueue(queue.id);
            // tìm kiếm trong cơ sở dữ liệu xem có mục này hay không
            const data = await databases.findOne({ GuildId: queue.id });
            if (!data) return; // nếu data trống thì return;
            if (PlayerMap.has(`deleted-${queue.id}`)) PlayerMap.delete(`deleted-${queue.id}`);
            queue.autoplay = data.MusicData?.Autoplay || false;
            queue.setVolume(Number(data.MusicData?.Volume || 50)); // mặc định âm lượng là 50%.
            queue.voice.setSelfDeaf(true); // xét chế độ điếc cho bot.
            /**
            * Music System Edit Embeds
            */
            playerintervals.set(`musicsystemeditinterval-${queue.id}`, setInterval(async () => {
                if (data.MusicData?.ChannelId && data.MusicData.ChannelId.length > 5) {
                    const guild = this.client.guilds.cache.get(queue.id);
                    if (!guild) return console.log(colors.magenta("Music System Edit Embeds") + ` - Music System - Không tìm thấy Guild!`);
                    let channel = guild.channels.cache.get(data.MusicData.ChannelId) as TextChannel;
                    if (!channel) channel = (await guild.channels.fetch(data.MusicData.ChannelId).catch(() => null)) as TextChannel;
                    if (!channel) return console.log(colors.magenta("Music System Edit Embeds") + ` - Music System - Không tìm thấy kênh!`);
                    let message = channel.messages.cache.get(data.MusicData.MessageId as string) as Message | null;
                    if (!message) message = await channel.messages.fetch(data.MusicData.MessageId as string).catch(() => null);
                    if (!message) return console.log(colors.magenta("Music System Edit Embeds") + ` - Music System - Không tìm thấy tin nhắn!`);
                    if (!message.editedTimestamp) return console.log(colors.magenta("Music System Edit Embeds") + ` - Chưa từng chỉnh sửa trước đây!`);
                    if (Date.now() - message.editedTimestamp > 7000 - 100) {
                        message.edit(this.generateQueueEmbed(queue.id)).catch((e) => console.log(e)).then(() => {
                            console.log(colors.magenta("Music System Edit Embeds") + ` - Đã chỉnh sửa embed hệ thống âm nhạc!`);
                        });
                    }
                }
            }, 7000)
            );
            /**
            * Kiểm tra các thông báo có liên quan bên trong Kênh yêu cầu hệ thống âm nhạc.
            */
            playerintervals.set(`checkrelevantinterval-${queue.id}`, setInterval(async () => {
                if (data.MusicData?.ChannelId && data.MusicData.ChannelId.length > 5) {
                    console.log(colors.cyan(`Music System - Relevant Checker`) + ` - Kiểm tra các tin nhắn không liên quan`);
                    const guild = this.client.guilds.cache.get(queue.id);
                    if (!guild) return console.log(colors.cyan(`Music System - Relevant Checker`) + ` - Không tìm thấy Guild!`);
                    let channel = guild.channels.cache.get(data.MusicData.ChannelId) as TextChannel;
                    if (!channel) channel = (await guild.channels.fetch(data.MusicData.ChannelId).catch(() => null)) as TextChannel;
                    if (!channel) return console.log(colors.cyan(`Music System - Relevant Checker`) + ` - Không tìm thấy kênh!`);
                    const messages = await channel.messages.fetch();
                    const filteredMessages = messages.filter((m) => m.id != data.MusicData?.MessageId);
                    if (filteredMessages.size > 0) {
                        channel.bulkDelete(filteredMessages).then((msgs) => {
                            console.log(colors.cyan(`Music System - Relevant Checker`) + ` - Đã xóa hàng loạt ${msgs?.size || 0} tin nhắn`);
                        }).catch((e) => console.log(e));
                    } else {
                        console.log(colors.cyan(`Music System - Relevant Checker`) + ` - Không có tin nhắn liên quan`);
                    };
                }
            }, 60000));
            /**
            * AUTO-RESUME-DATABASING.
            */
            playerintervals.set(`autoresumeinterval-${queue.id}`, setInterval(async () => {
                /**
                 * Xử lý và định dạng dữ liệu nhạc thành các đối tượng dữ liệu bài hát.
                 * @param {newQueue} musicData - Dữ liệu nhạc thô chứa thông tin các bài hát.
                 * @returns {Array} - Một mảng các đối tượng dữ liệu bài hát đã được định dạng.
                 */
                const makeTrackData = (musicData: Queue): any[] => musicData.songs.slice(0).map((track) => ({
                    formattedDuration: track.formattedDuration, // Thời lượng của bài hát đã được định dạng (ví dụ: "3:45").
                    memberId: track.member?.id || undefined, // ID của thành viên đã tải lên bài hát, nếu có.
                    thumbnail: track.thumbnail, // URL hình ảnh thu nhỏ của bài hát.
                    uploader: track.uploader, // Người đã tải lên bài hát.
                    duration: track.duration, // Thời lượng của bài hát tính bằng giây.
                    source: track.source, // Nguồn của bài hát (ví dụ: nền tảng hoặc dịch vụ).
                    isLive: track.isLive, // Boolean cho biết bài hát đang phát trực tiếp hay đã được ghi lại trước đó.
                    views: track.views, // Số lượt xem của bài hát.
                    name: track.name, // Tên hoặc tiêu đề của bài hát.
                    url: track.url, // Đường dẫn URL đến bài hát.
                    type: "video", // Loại phương tiện, mặc định là "video".
                    id: track.id, // Mã định danh duy nhất cho bài hát.
                }));
                if (newQueue && newQueue.id && Boolean(data.MusicData?.Autoresume)) {
                    const autoresumeData = await autoresume.findOne({ guildId: newQueue.id });
                    if (!autoresumeData) {
                        autoresume.create({
                            guildId: newQueue.id, // Id hàng đợi (Id guild).
                            voiceChannel: newQueue.voiceChannel ? newQueue.voiceChannel.id : null, // Kênh voice đang phát.
                            textChannel: newQueue.textChannel ? newQueue.textChannel.id : null, // Kênh văn bản của Hàng đợi. (Mặc định: nơi lệnh đầu tiên được gọi).
                            currentTime: newQueue.currentTime, // Bài hát đang phát ở thời gian nào (tính bằng giây).
                            filters: newQueue.filters.names, // Trình quản lý bộ lọc của hàng đợi.
                            repeatMode: newQueue.repeatMode, // Loại chế độ lặp lại (0 bị tắt, 1 đang lặp lại một bài hát, 2 đang lặp lại tất cả hàng đợi). Giá trị mặc định: 0 (bị tắt).
                            autoplay: newQueue.autoplay, // Chế độ tự động phát có được bật hay không.
                            playing: newQueue.playing, // Luồng hiện có đang phát hay không.
                            volume: newQueue.volume, // Nhận hoặc đặt âm lượng luồng.
                            songs: newQueue.songs && newQueue.songs.length > 0 ? makeTrackData(newQueue) : null, // Danh sách bài hát trong hàng đợi (Đầu tiên là bài hát đang phát).
                        });
                    } else {
                        if (autoresumeData.voiceChannel !== newQueue.voiceChannel ? newQueue.voiceChannel?.id : null) autoresumeData.voiceChannel = newQueue.voiceChannel ? newQueue.voiceChannel.id : null; // Cập nhật id kênh voice đang phát.
                        if (autoresumeData.textChannel !== newQueue.textChannel ? newQueue.textChannel?.id : null) autoresumeData.textChannel = newQueue.textChannel ? newQueue.textChannel.id : null; // Cập nhật kênh văn bản của Hàng đợi. (Mặc định: nơi lệnh đầu tiên được gọi).
                        if (autoresumeData.currentTime !== newQueue.currentTime) autoresumeData.currentTime = newQueue.currentTime; // cập nhật bài hát đang phát ở thời gian nào (tính bằng giây).
                        if (autoresumeData.repeatMode !== newQueue.repeatMode) autoresumeData.repeatMode = newQueue.repeatMode; // cập nhật loại chế độ lặp lại (0 bị tắt, 1 đang lặp lại một bài hát, 2 đang lặp lại tất cả hàng đợi). Giá trị mặc định: 0 (bị tắt).
                        if (autoresumeData.autoplay !== newQueue.autoplay) autoresumeData.autoplay = newQueue.autoplay; // cập nhật chế độ tự động phát có được bật hay không.
                        if (autoresumeData.playing !== newQueue.playing) autoresumeData.playing = newQueue.playing; // cập nhật xem hiện có đang phát hay không.
                        if (autoresumeData.volume !== newQueue.volume) autoresumeData.volume = newQueue.volume; // kiểm tra âm lượng phát nhạc nếu âm lượng cũ và mới khác nhau đặt mức âm lượng trong database vào
                        if (autoresumeData.guildId !== newQueue.id) autoresumeData.guildId = newQueue.id; // kiểm tra guildiId nếu không thấy guildid thêm vào
                        if (!arraysEqual([...autoresumeData.filters].filter(Boolean), [...newQueue.filters.names].filter(Boolean) as any)) (autoresumeData as any).filters = [...newQueue.filters.names].filter(Boolean); // Cập nhật trình quản lý bộ lọc của hàng đợi.
                        if (!arraysEqual(autoresumeData.songs, [...newQueue.songs]) && newQueue.songs) autoresumeData.songs = makeTrackData(newQueue); // Cập nhật danh sách bài hát trong hàng đợi (Đầu tiên là bài hát đang phát).
                        /** Hàm để so sánh hai mảng và trả về true nếu chúng giống nhau, ngược lại trả về false
                         * @param {Array} a - Mảng thứ nhất cần so sánh
                         * @param {Array} b - Mảng thứ hai cần so sánh
                         * @returns {boolean} - True nếu hai mảng giống nhau, ngược lại trả về false
                         */
                        function arraysEqual<T>(a: T[], b: T[]): boolean {
                            if (a === b) return true;
                            if (!a || !b || a.length !== b.length) return false;
                            for (let i = 0; i < a.length; ++i) {
                                if (a[i] !== b[i]) return false;
                            }
                            return true;
                        }
                        autoresumeData.save().catch(() => undefined);
                    };
                };
            }, ms("5s")));
        });

        this.on(DistubeEvents.PLAY_SONG, async (queue, song) => {
            const data = await databases.findOne({ GuildId: queue.id });
            if (!data) return; // tìm kiếm data trong database, nếu không thấy data. return;
            const newQueue = this.getQueue(queue.id) as Queue;
            this.updateMusicSystem(newQueue);
            const nowplay = await queue.textChannel?.send(this.receiveQueueData(newQueue)).then(async (message) => {
                PlayerMap.set("idTextchannel", message.id);
                return message;
            }).catch((e) => console.log(e)) as Message<true>;
            if (queue.textChannel?.id === data.MusicData?.ChannelId) return;
            // Xóa interval hiện tại nếu có
            try {
                clearInterval(songEditInterval as NodeJS.Timeout);
            } catch (e) {
                console.log(e);
            };
            // Tạo interval để cập nhật thông điệp hàng đợi
            songEditInterval = setInterval(async () => {
                if (!lastEdited) {
                    try {
                        return await nowplay?.edit(this.receiveQueueData(newQueue));
                    } catch (e) {
                        clearInterval(songEditInterval as NodeJS.Timeout);
                    };
                };
            }, ms("4s"));
            const collector = nowplay?.createMessageComponentCollector({
                filter: (interaction) => interaction.isButton() && interaction.user && interaction.message.author.id == this.client.user?.id,
                time: song.duration > 0 ? song.duration * 1000 : 600000,
            });
            collector?.on("collect", async (i) => {
                lastEdited = true;
                setTimeout(() => lastEdited = false, ms("7s"));
                const botChannel = i.guild.channels.cache.filter((channels) => (channels.type === ChannelType.GuildVoice)).find((voiceChannel) => voiceChannel.members.has(this.client.user?.id as string));
                const voiceChannelId = i.member.voice.channel.id;
                if (!voiceChannelId) {
                    return i.reply({ content: "❌ **Bạn phải tham gia kênh voice mới có thể sử dụng lệnh**", ephemeral: true });
                };
                if (botChannel && voiceChannelId !== botChannel.id) {
                    return i.reply({ embeds: [new MessageEmbed().setDescription(`❌ Tôi đã chơi trong <#${botChannel?.id}>`)], ephemeral: true });
                };
                if (!newQueue || !newQueue.songs || newQueue.songs.length === 0) {
                    return await i.reply({ content: "Danh sách nhạc trống", ephemeral: true });
                };
                if (i.member.voice.channel?.id !== newQueue.voiceChannel?.id) {
                    return i.reply({ content: `**Tham gia kênh voice của tôi**` });
                };
                const embeds = new MessageEmbed({
                    footer: { text: `yêu cầu bởi ${i.member.user.tag}`, iconURL: `${i.member.user.displayAvatarURL()}` },
                    timestamp: Date.now(),
                    colors: "Random",
                });
                if (i.customId === "skip") {
                    const getQueue = this.getQueue(i.guild.id) as Queue;
                    getQueue.skip().then(async () => {
                        await i.reply({ embeds: [embeds.setTitle("⏭ **Bỏ qua bài hát!**")] }).then(() => setTimeout(() => i.deleteReply(), 3000));
                        nowplay?.edit({ components: [] });
                    }).catch(() => {
                        i.reply({ content: "Hiện tại chỉ có một bài hát trong playlist, bạn cần thêm tối thiểu ít nhất một bài hát nữa ..." }).then(() => setTimeout(() => i.deleteReply(), 3000));
                    });
                } else if (i.customId === "stop") {
                    nowplay?.edit({ components: [] });
                    this.voices.leave(i.guild.id);
                    await i.reply({ embeds: [embeds.setTitle("👌 Đã dừng phát nhạc và rời khỏi kênh voice channel theo yêu cầu")] }).then(() => {
                        setTimeout(() => i.deleteReply(), ms("3s"));
                    });
                } else if (i.customId === "pause") {
                    if (newQueue.playing) {
                        this.pause(i.guild.id);
                    } else {
                        this.resume(i.guild.id);
                    };
                    await i.reply({ embeds: [embeds.setTitle(`${newQueue.playing ? "⏸ **Tạm dừng**" : "▶️ **tiếp tục**"}`)] }).then(() => {
                        setTimeout(() => i.deleteReply(), ms("3s"));
                    });
                    nowplay?.edit(this.receiveQueueData(newQueue));
                } else if (i.customId === "autoplay") {
                    newQueue.toggleAutoplay();
                    nowplay?.edit(this.receiveQueueData(newQueue));
                    await i.reply({ embeds: [embeds.setTitle(`${newQueue.autoplay ? `✔️ **Đã bật chế độ tự động phát**` : `❌ **Đã tắt chế độ tự động phát**`}`)] }).then(() => {
                        setTimeout(() => i.deleteReply(), ms("3s"));
                    });
                } else if (i.customId === "shuffle") {
                    this.maps.set(`beforeshuffle-${newQueue.id}`, newQueue.songs.map(track => track).slice(1));
                    await newQueue.shuffle();
                    await i.reply({ embeds: [embeds.setTitle(`🔀 **Xáo trộn ${newQueue.songs.length} bài hát!**`)] }).then(() => {
                        setTimeout(() => i.deleteReply(), ms("3s"));
                    });
                } else if (i.customId === "song") {
                    newQueue.setRepeatMode(newQueue.repeatMode === 1 ? 0 : 1);
                    await i.reply({ embeds: [embeds.setTitle(`${newQueue.repeatMode == 1 ? `✔️ **Lặp bài hát đã bật**` : `❌ **Lặp bài hát đã tắt**`}`)] }).then(() => {
                        setTimeout(() => i.deleteReply(), ms("3s"));
                    });
                    nowplay?.edit(this.receiveQueueData(newQueue));
                } else if (i.customId === "queue") {
                    newQueue.setRepeatMode(newQueue.repeatMode === 2 ? 0 : 2);
                    await i.reply({
                        embeds: [embeds.setTitle(`${newQueue.repeatMode == 2 ? `**Lặp hàng đợi đã bật**` : `**Lặp hàng đợi đã tắt**`}`)]
                    }).then(() => setTimeout(() => i.deleteReply(), ms("3s")));
                    nowplay?.edit(this.receiveQueueData(newQueue));
                } else if (i.customId === "seek") {
                    let seektime = newQueue.currentTime + 10;
                    newQueue.seek(seektime >= newQueue.songs[0].duration ? newQueue.songs[0].duration - 1 : seektime);
                    collector.resetTimer({ time: (newQueue.songs[0].duration - newQueue.currentTime) * 1000 })
                    await i.reply({ embeds: [embeds.setTitle(`⏩ **+10 Giây!**`)] }).then(() => setTimeout(() => i.deleteReply(), ms("3s")));
                    nowplay?.edit(this.receiveQueueData(newQueue));
                } else if (i.customId === "seek2") {
                    let seektime = newQueue.currentTime - 10;
                    newQueue.seek(seektime < 0 ? 0 : (seektime >= newQueue.songs[0].duration - newQueue.currentTime ? 0 : seektime));
                    collector.resetTimer({ time: (newQueue.songs[0].duration - newQueue.currentTime) * 1000 });
                    await i.reply({ embeds: [embeds.setTitle("⏪ **-10 Giây!**")] }).then(() => setTimeout(() => i.deleteReply(), ms("3s")));
                    nowplay?.edit(this.receiveQueueData(newQueue));
                } else if (i.customId === "lyrics") {
                    await i.deferReply();
                    try {
                        // const thumbnail = newQueue.songs.map((song) => song.thumbnail).slice(0, 1).join("\n");
                        // const name = newQueue.songs.map((song) => song.name).slice(0, 1).join("\n");
                        // const url = newQueue.songs.map((song) => song.url).slice(0, 1).join("\n");
                        // const searches = await genius.songs.search(name);
                        // const lyrics = searches[0] ? await searches[0].lyrics() : undefined;
                        // i.editReply({
                        //     embeds: [new MessageEmbed({
                        //         author: { name: name, iconURL: thumbnail, url: url },
                        //         description: lyrics ? lyrics : "Không thể tìm thấy lời bài hát",
                        //         thumbnail: thumbnail,
                        //         colors: "Random"
                        //     })], ephemeral: true
                        // });
                    } catch (e) {
                        console.log(e)
                        i.editReply({ content: "Đã sảy ra lỗi vui lòng thử lại sau" });
                    };
                } else if (i.customId == "volumeUp") {
                    try {
                        newQueue.setVolume(Number(newQueue.volume) + 10);
                        await i.reply({ embeds: [embeds.setTitle(`:white_check_mark: | Âm lượng tăng lên ${newQueue.volume}%`)] }).then(() => {
                            setTimeout(() => i.deleteReply(), ms("3s"));
                        });
                        nowplay?.edit(this.receiveQueueData(newQueue));
                    } catch (error) {
                        console.log(error);
                    };
                } else if (i.customId == "volumeDown") {
                    try {
                        newQueue.setVolume(Number(newQueue.volume) - 10);
                        await i.reply({ embeds: [embeds.setTitle(`:white_check_mark: | Âm lượng giảm xuống ${newQueue.volume}%`)] }).then(() => {
                            setTimeout(() => i.deleteReply(), ms("3s"));
                        });
                        nowplay?.edit(this.receiveQueueData(newQueue));
                    } catch (error) {
                        console.log(error);
                    };
                };
            });
            // Xử lý sự kiện khi collector kết thúc
            collector?.on("end", async (collected, reason) => {
                // Nếu là do hết thời gian, xóa các thành phần tin nhắn
                if (reason === "time") {
                    nowplay?.edit({ components: [] });
                };
            });
        });
        // // Được phát ra khi Hàng đợi bị xóa vì bất kỳ lý do gì.
        this.on(DistubeEvents.DELETE_QUEUE, async (queue) => {
            if (!PlayerMap.has(`deleted-${queue.id}`)) {
                PlayerMap.set(`deleted-${queue.id}`, true);
                if (this.maps.has(`beforeshuffle-${queue.id}`)) {
                    this.maps.delete(`beforeshuffle-${queue.id}`);
                };
                try {
                    //Xóa khoảng thời gian để kiểm tra hệ thống thông báo liên quan
                    clearInterval(playerintervals.get(`checkrelevantinterval-${queue.id}`));
                    playerintervals.delete(`checkrelevantinterval-${queue.id}`);
                    // Xóa khoảng thời gian cho Hệ thống Embed Chỉnh sửa Nhạc
                    clearInterval(playerintervals.get(`musicsystemeditinterval-${queue.id}`));
                    playerintervals.delete(`musicsystemeditinterval-${queue.id}`);
                    // Xóa Khoảng thời gian cho trình tiết kiệm hồ sơ tự động
                    clearInterval(playerintervals.get(`autoresumeinterval-${queue.id}`));
                    if (await autoresume.findOne({ guildId: queue.id })) {
                        console.log(colors.random("[deleteQueue - Autoresume]: Đã xóa dữ liệu bài hát cho: ") + queue.id);
                        await autoresume.deleteOne({ guildId: queue.id }); // Xóa db nếu nó vẫn ở đó
                    };
                    playerintervals.delete(`autoresumeinterval-${queue.id}`);
                } catch (e) {
                    console.log(e);
                };
                this.updateMusicSystem(queue, true);
                const embeds = new MessageEmbed({
                    description: `:headphones: **Hàng đợi đã bị xóa**`,
                    title: { text: "Kết thúc bài hát" },
                    timestamp: Date.now(),
                    colors: "Random",
                });
                return queue.textChannel?.send({ embeds: [embeds] });
            };
        });
        // // Được phát ra sau khi DisTube thêm danh sách phát mới vào Hàng đợi đang phát
        this.on(DistubeEvents.ADD_LIST, async (queue, playlist) => queue.textChannel?.send({
            embeds: [new MessageEmbed({
                description: `👍 Danh sách: [\`${playlist.name}\`](${playlist.url ? playlist.url : "https:youtube.com/"})  -  \`${playlist.songs.length} Bài hát\``,
                thumbnail: `${playlist.thumbnail ? playlist.thumbnail : `https://img.youtube.com/vi/${playlist.songs[0].id}/mqdefault.jpg`}`,
                footer: { text: `💯 ${playlist.user?.tag}`, iconURL: `${playlist.user?.displayAvatarURL()}` },
                title: { text: "Đã thêm vài hát vào hàng đợi" },
                timestamp: Date.now(),
                colors: "Random",
                fields: [
                    { name: `**Thời gian dự tính**`, value: `\`${queue.songs.length - - playlist.songs.length} Bài hát\` - \`${(Math.floor((queue.duration - playlist.duration) / 60 * 100) / 100).toString().replace(`.`, `:`)}\``, inline: true },
                    { name: `**Thời lượng hàng đợi**`, value: `\`${queue.formattedDuration}\``, inline: true },
                ]
            })],
        }));
        // Được phát ra sau khi DisTube thêm bài hát mới vào Hàng đợi đang phát.
        this.on(DistubeEvents.ADD_SONG, async (queue, song) => {
            queue.textChannel?.send({
                embeds: [new MessageEmbed({
                    author: { name: `Bài hát đã được thêm!`, iconURL: `${this.client.user?.displayAvatarURL()}`, url: song.url },
                    footer: { text: `💯 ${this.client.user?.tag}`, iconURL: `${this.client.user?.displayAvatarURL()}` },
                    description: `👍 Bài hát: [${song.name}](${song.url})  -  ${song.formattedDuration}`,
                    thumbnail: `https://img.youtube.com/vi/${song.id}/mqdefault.jpg`,
                    timestamp: Date.now(),
                    colors: "Random",
                    fields: [
                        { name: "⌛ **Thời gian dự tính**", value: `\`${queue.songs.length - 1} Bài hát\` - \`${(Math.floor((queue.duration - song.duration) / 60 * 100) / 100).toString().replace(`.`, `:`)}\``, inline: true },
                        { name: "🎥 Lượt xem", value: `${queue.songs[0].views}`, inline: true },
                        { name: "👍 Likes", value: `${queue.songs[0].likes}`, inline: true },
                        { name: "👎 Dislikes", value: `${queue.songs[0].dislikes}`, inline: true },
                        { name: "🌀 **Thời lượng hàng đợi**", value: `\`${queue.formattedDuration}\``, inline: true },
                    ]
                })],
            });
        });
        // // Phát ra khi DisTube kết thúc một bài hát.
        this.on(DistubeEvents.FINISH_SONG, async (queue, song) => {
            queue.textChannel?.messages.fetch(PlayerMap.get("idTextchannel")).then((currentSongPlayMsg) => {
                const embed = new MessageEmbed({
                    author: { name: song.name, iconURL: "https://cdn.discordapp.com/attachments/883978730261860383/883978741892649000/847032838998196234.png", url: song.url },
                    footer: { text: `💯 ${this.client.user.username}\n⛔️ Bài hát đã kết thúc!`, iconURL: this.client.user.displayAvatarURL({ extension: "png" }) },
                    thumbnail: `https://img.youtube.com/vi/${song.id}/mqdefault.jpg`,
                    colors: "Random"
                });
                currentSongPlayMsg.edit({ embeds: [embed], components: [] }).catch((e) => {
                    console.log(e.stack ? String(e.stack) : String(e));
                });
            }).catch((e) => console.log(e.stack ? String(e.stack) : String(e)));
        });
        // Phát ra khi DisTube gặp lỗi khi phát bài hát.
        this.on(DistubeEvents.ERROR, async (error, queue, song) => {
            console.log(error);
            const embeds = new MessageEmbed({
                author: { name: this.client.user?.username, iconURL: this.client.user?.displayAvatarURL({ extension: "png" }) },
                footer: { text: this.client.user?.username, iconURL: this.client.user?.displayAvatarURL({ extension: "png" }) },
                description: `Đã xảy ra lỗi: ${error}`,
                title: { text: "có lỗi suất hiện" },
                colors: "Random"
            });
            return queue.textChannel?.send({ embeds: [embeds] });
        });
        // Được phát ra khi không còn bài hát nào trong hàng đợi và Queue#autoplay là false. DisTube sẽ rời khỏi kênh voice nếu DisTubeOptions.leaveOnFinish là true;
        this.on(DistubeEvents.FINISH, async (queue) => queue.textChannel?.send({ embeds: [new MessageEmbed({ colors: "Random", description: "Đã phát hết nhạc trong hàng đợi... rời khỏi kênh voice" })] }));
        // Được phát ra khi bot bị ngắt kết nối với kênh voice.
        this.on(DistubeEvents.DISCONNECT, async (queue) => queue.textChannel?.send({ embeds: [new MessageEmbed({ description: ":x: | Đã ngắt kết nối khỏi kênh voice" })] }));
        // Được phát ra khi Queue#autoplay là true, Queue#songs trống và DisTube không thể tìm thấy các bài hát liên quan để phát.
        this.on(DistubeEvents.NO_RELATED, async (queue, error) => await queue.textChannel?.send({ content: "Không thể tìm thấy video, nhạc liên quan để phát. vui lòng thử lại sau" }));
        // Được phát ra khi không có người dùng trong kênh voice, DisTubeOptions.leaveOnEmpty là true và có hàng đợi phát. Nếu không có hàng đợi phát (đã dừng và DisTubeOptions.leaveOnStop là false), nó sẽ rời khỏi kênh mà không phát ra sự kiện này.
        this.on(DistubeEvents.EMPTY as DistubeEvents.DISCONNECT, async (queue) => queue.textChannel?.send({ content: "Kênh voice chống. rời khỏi kênh :))" }));
        //distube.on(DistubeEvents.FFMPEG_DEBUG, (debug) => {});
        client.on(DiscordEvents.ClientReady, (bot) => setTimeout(async () => {
            const guildIds = (await autoresume.find({})).map((g) => g.guildId as string);
            console.log(colors.cyan("Autoresume: - Tự động tiếp tục các bài hát:"), guildIds);
            if (!guildIds.length) return;
            for (const guildId of guildIds) {
                try {
                    const guild = client.guilds.cache.get(guildId);
                    const data = await autoresume.findOne({ guildId });
                    if (!guild) {
                        await autoresume.deleteMany({ guildId });
                        console.log(colors.red(`Autoresume: - Bot bị kick ra khỏi Guild`));
                        continue;
                    };
                    let voiceChannel = guild.channels.cache.get(data?.voiceChannel as string) as VoiceBasedChannel || await guild.channels.fetch(data?.voiceChannel as string).catch(() => false) as VoiceBasedChannel;
                    if (!voiceChannel || !voiceChannel.members.filter((m) => !m.user.bot && !m.voice.deaf && !m.voice.selfDeaf).size) {
                        await autoresume.deleteMany({ guildId });
                        console.log(colors.cyan("Autoresume: - Kênh voice trống / Không có người nghe / đã bị xoá"));
                        continue;
                    };
                    let textChannel = guild.channels.cache.get(data?.textChannel as string) as TextChannel || await guild.channels.fetch(data?.textChannel as string).catch(() => false) as TextChannel;
                    if (!textChannel || !data?.songs?.length) {
                        await autoresume.deleteMany({ guildId });
                        console.log(colors.cyan("Autoresume: - Kênh văn bản đã bị xóa hoặc không có bản nhạc nào"));
                        continue;
                    };
                    await this.play(voiceChannel, data?.songs[0].url, {
                        member: guild.members.cache.get(data.songs[0].memberId) as GuildMember || guild.members.me,
                        textChannel: textChannel as GuildTextBasedChannel,
                    });
                    const newQueue = this.getQueue(guildId) as Queue;
                    data?.songs.slice(1).forEach((track: Song) => {
                        const toSecond = (duration: string): number => {
                            if (!duration) return 0;
                            return duration.split(":").reverse().map((part, i) => Number(part.replace(/[^\d.]+/g, "")) * Math.pow(60, i)).reduce((total, num) => total + num, 0);
                        };
                        newQueue.songs.push(new Song({
                            thumbnail: track.thumbnail,
                            uploader: track.uploader,
                            duration: toSecond(track.duration as any),
                            isLive: track.isLive ? "Live" : formatDuration(toSecond(String(track.duration))) as any,
                            views: track.views,
                            name: track.name,
                            url: track.url,
                            id: track.id,
                            plugin: null,
                            source: track.source,
                            playFromSource: true,
                        }, {
                            member: guild.members.cache.get(track.member as any) as GuildMember || guild.members.me,
                            metadata: track.source
                        }));
                    });
                    console.log(colors.cyan(`Autoresume: - Thêm ${newQueue.songs.length} bài hát vào hàng đợi và phát ${newQueue.songs[0].name} trong ${guild.name}`));
                    //if (data.filters?.length) newQueue.filters.set(data.filters.map(([value]) => value));
                    if (data.autoplay !== newQueue.autoplay) newQueue.toggleAutoplay();
                    if (data.repeatMode) newQueue.setRepeatMode(data?.repeatMode as number);
                    if (data?.currentTime as number > 5) newQueue.seek(data?.currentTime as number);
                    if (data?.volume as number > newQueue.volume) newQueue.setVolume(data?.volume as number);
                    await autoresume.deleteMany({ guildId });
                    console.log(colors.cyan("Autoresume: - Đã điều chỉnh hàng đợi và xóa mục nhập cơ sở dữ liệu"));
                    await new Promise(resolve => setTimeout(resolve, ms("1s")));
                } catch (error) {
                    console.log(colors.red(error as string));
                };
            };
        }, 2 * bot.ws.ping));
        // dành cho hệ thống âm nhạc yêu cầu bài hát
        client.on("messageCreate", async (message) => {
            const data = await databases.findOne({ GuildId: message.guild?.id }); // Lấy dữ liệu từ MongoDB dựa trên guild.id
            if (!data || !message.guild?.available || !data.MusicData?.ChannelId || data.MusicData.ChannelId.length < 5) return; // Kiểm tra và trả về ngay lập tức nếu có lỗi hoặc không có guild
            const textChannel = message.guild.channels.cache.get(data.MusicData.ChannelId) || await message.guild.channels.fetch(data.MusicData.ChannelId).catch(() => null); // Lấy thông tin textChannel từ guild
            if (!textChannel) return; // Kiểm tra và in log nếu không tìm thấy channel
            if (textChannel.id !== message.channel.id) return; // Kiểm tra nếu message không được gửi trong textChannel đã cài đặt, return
            setTimeout(() => message.author.id === client.user?.id && message.delete(), message.author.id === client.user?.id ? 3000 : 0); // Xoá tin nhắn sau 3 giây nếu là của bot, ngược lại xoá ngay lập tức
            if (message.author.bot) return; // Kiểm tra nếu là tin nhắn của bot, return
            if (!message.member?.voice.channel) return message.channel.send({ content: "Bạn cần phải ở trong một kênh voice" }); // Kiểm tra xem thành viên có ở trong voice hay không, Nếu không ở trong voice, gửi thông báo
            // Yêu cầu phát nhạc
            await this.play(message.member.voice.channel, message.cleanContent, {
                member: message.member,
                textChannel: message.channel as GuildTextBasedChannel,
                message: message,
            });
        });
        // dành cho button tương tác hệ thống âm nhạc và menu
        client.on(DiscordEvents.InteractionCreate, async (interaction) => {
            if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
            let guild: Guild | null = interaction.guild || null; // Chuyển `undefined` thành `null`
            let channel = interaction.channel;
            let member = interaction.member;
            const data = await databases.findOne({ GuildId: guild?.id });
            if (!data) return; // Trả về nếu không tìm thấy data
            if (!guild) guild = client.guilds.cache.get(interaction.guildId as string) || null;
            if (!guild) return; // Trả về nếu không tìm thấy guild
            // Nếu chưa setup, return
            if (!data.MusicData?.ChannelId || data.MusicData.ChannelId.length < 5) return;
            if (!data.MusicData?.MessageId || data.MusicData.MessageId.length < 5) return;
            // Nếu kênh không tồn tại, hãy thử lấy và trả về nếu vẫn không tồn tại
            if (!channel) channel = guild.channels.cache.get(interaction.channelId) as TextChannel | null;
            if (!channel) return;
            // Nếu không đúng kênh, quay lại
            if (data.MusicData.ChannelId !== interaction.channelId) return;
            // Nếu không đúng tin nhắn, return
            if (data.MusicData.MessageId !== interaction.message?.id) return;
            // Lấy thành viên nếu không có
            if (!member) member = guild.members.cache.get(interaction.user.id) as GuildMember | null;
            if (!member) member = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) return;
            // if (!data || !guild || !data.MusicData?.ChannelId?.length >= 5 || !data.MusicData?.MessageId?.length >= 5) return;
            // const resolvedGuild = guild || client.guilds.cache.get(interaction.guildId);
            // const resolvedChannel = channel || resolvedGuild?.channels.cache.get(interaction.channelId);
            // if (!resolvedGuild || !resolvedChannel || data.MusicData.ChannelId !== resolvedChannel.id || data.MusicData.MessageId !== interaction.message.id) return;
            // let resolvedMember = member || (await resolvedGuild.members.fetch(interaction.user.id).catch(() => { }));
            // if (!resolvedMember) return;

            // nếu thành viên không được kết nối với voice, return
            // if (!member.voice.channel) return interaction.reply({ content: `**Vui lòng kết nối với kênh voice trước!**` });
            let newQueue = this.getQueue(guild.id) as Queue;
            if (interaction.isButton()) {
                if (!newQueue || !newQueue.songs || !newQueue.songs[0]) return interaction.reply({ content: "Hiện tại không phát bài hát nào :))" });
                if (interaction.customId === "Stop") {
                    if (newQueue) await newQueue.stop();
                    return interaction.reply({ content: "⏹ **Dừng phát và rời khỏi Kênh**" });
                } else if (interaction.customId === "Skip") {
                    try {
                        newQueue.songs.length === 0 ? await newQueue.stop() : await newQueue.skip();
                        return interaction.reply({ content: `${newQueue.songs.length === 0 ? "Ngừng phát và rời khỏi Kênh" : "⏭ **Đã chuyển sang Bài hát tiếp theo!**"}` });
                    } catch (e) {
                        return interaction.reply({ content: "Bạn chỉ có 1 bài hát trong danh sách phát" });
                    };
                } else if (interaction.customId === "Pause") {
                    newQueue.paused ? newQueue.resume() : newQueue.pause();
                    return interaction.reply({ content: `${newQueue.paused ? "Tiếp tục phát nhạc" : "Tạm dừng phát nhạc"}` });
                } else if (interaction.customId === "Autoplay") {
                    newQueue.toggleAutoplay();
                    return interaction.reply({ content: `Tự động phát đã được ${newQueue.autoplay ? "bật" : "tắt"}` });
                } else if (interaction.customId === "Shuffle") {
                    this.maps.set(`beforeshuffle-${newQueue.id}`, newQueue.songs.map(track => track).slice(1));
                    await newQueue.shuffle();
                    return interaction.reply({ content: `Đã xáo trộn ${newQueue.songs.length} bài hát` });
                } else if (interaction.customId === "Song") {
                    newQueue.setRepeatMode(newQueue.repeatMode === 1 ? 0 : 1);
                    return interaction.reply({ content: `${newQueue.repeatMode == 1 ? "Đã bật vòng lặp bài hát" : "Đã tắt vòng lặp bài hát"}` });
                } else if (interaction.customId === "Queue") {
                    newQueue.setRepeatMode(newQueue.repeatMode === 2 ? 0 : 2);
                    return interaction.reply({ content: `${newQueue.repeatMode === 2 ? "Đã bật vòng lặp hàng đợi" : "Đã tắt vòng lặp bài hát"}` });
                } else if (interaction.customId === "Forward") {
                    let seektime = newQueue.currentTime + 10;
                    newQueue.seek(seektime >= newQueue.songs[0].duration ? newQueue.songs[0].duration - 1 : seektime);
                    return interaction.reply({ content: "Đã tua bài hát về trước 10 giây" });
                } else if (interaction.customId === "VolumeUp") {
                    try {
                        const volumeUp = Number(newQueue.volume) + 10;
                        if (volumeUp < 0 || volumeUp > 100) return interaction.reply({
                            embeds: [new MessageEmbed().setColor("Random").setDescription("Bạn chỉ có thể đặt âm lượng từ 0 đến 100.").setTimestamp()], ephemeral: true
                        });
                        newQueue.setVolume(volumeUp);
                        await interaction.reply({ content: `:white_check_mark: | Âm lượng tăng lên ${volumeUp}%` });
                    } catch (error) {
                        console.log(error);
                    };
                } else if (interaction.customId === "VolumeDown") {
                    try {
                        newQueue.setVolume(Number(newQueue.volume) - 10);
                        interaction.reply({ content: `:white_check_mark: | Âm lượng giảm xuống ${newQueue.volume}%` });
                    } catch (error) {
                        console.log(error);
                    };
                } else if (interaction.customId === "Rewind") {
                    let seektime = newQueue.currentTime - 10;
                    newQueue.seek(seektime < 0 ? 0 : (seektime >= newQueue.songs[0].duration - newQueue.currentTime ? 0 : seektime));
                    return interaction.reply({ content: "Đã tua bài hát về sau 10 giây" });
                } else if (interaction.customId === "Lyrics") {
                    await interaction.reply({ content: "Đang tìm kiếm lời bài hát", embeds: [], ephemeral: true });
                    let thumbnail = newQueue.songs.map((song) => song.thumbnail).slice(0, 1).join("\n");
                    let name = newQueue.songs.map((song) => song.name).slice(0, 1).join("\n");
                    return interaction.editReply({
                        embeds: [new MessageEmbed({
                            author: { name: name, iconURL: thumbnail, url: newQueue.songs.map((song) => song.url).slice(0, 1).join("\n") },
                            description: "Không tìm thấy lời bài hát!",
                            thumbnail: thumbnail,
                            colors: "Random"
                        })],
                        //ephemeral: true
                    });
                };
                this.updateMusicSystem(newQueue);
            } else if (interaction.isStringSelectMenu()) {
                // Lựa chọn danh sách bài hát đã được xác định trước.
                let link: any;
                if (interaction.values[0]) {
                    if (interaction.values[0].toLowerCase().startsWith(`g`)) {
                        link = `https://open.spotify.com/playlist/4a54P2VHy30WTi7gix0KW6`; // gaming.
                    };
                    if (interaction.values[0].toLowerCase().startsWith(`n`)) {
                        link = `https://open.spotify.com/playlist/7sZbq8QGyMnhKPcLJvCUFD`; // ncs.
                    };
                };
                await interaction.reply({ content: `Đang tải **${interaction.values[0]}**`, ephemeral: true });
                // this.play(member.voice.channel, link, {
                //     member: member as GuildMember,
                // }).then(() => {
                //     return interaction.editReply({ content: `${newQueue.songs?.length > 0 ? "👍 Thêm vào" : "🎶 Đang phát"}: **'${interaction.values[0]}'**` });
                // }).catch((e) => console.log(e));
            };
        });
        client.on("interactionCreate", (interaction) => {
            if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
            let newQueue = this.getQueue(interaction.guild?.id as string) as Queue;
            if (interaction.isStringSelectMenu()) {
                // thêm bộ lọc cho bài hát.
                if (interaction.customId === "filters-options") {
                    if (newQueue.filters.has(interaction.values[0])) {
                        newQueue.filters.remove(interaction.values[0]);
                    } else {
                        newQueue.filters.add(interaction.values[0]);
                    };
                    const embeds = new MessageEmbed({
                        title: { text: "Filters" },
                        description: `${newQueue.filters.names.join(", ") || "Tắt"}`,
                        footer: { text: interaction.user.globalName || interaction.user.username || interaction.user.displayName, iconURL: interaction.user.displayAvatarURL({ size: 1024 }) }
                    });
                    interaction.reply({ embeds: [embeds] }).then(() => {
                        setTimeout(() => interaction.deleteReply(), ms("5s"));
                    });
                };
            }
        });
    }
    /**
     * Hàm để cập nhật thông tin hệ thống âm nhạc trong kênh của Discord guild.
     * @param {Queue} queue - Hàng đợi âm nhạc.
     * @param {boolean} [leave=false] - Cờ chỉ định xem hàng đợi có rời khỏi không.
     * @returns {Promise<void>} - Một promise giải quyết sau khi cập nhật hệ thống âm nhạc.
     */
    private async updateMusicSystem(queue: Queue, leave: boolean = false): Promise<void> {
        const data = await databases.findOne({ GuildId: queue?.id }); // Lấy dữ liệu từ MongoDB dựa trên queue.id
        if (!data || !queue) return; // Kiểm tra nếu không có dữ liệu hoặc không có queue, return
        if (data.MusicData?.ChannelId && data.MusicData.ChannelId.length > 5) { // Kiểm tra nếu có ChannelId và có độ dài lớn hơn 5
            const guild = this.client.guilds.cache.get(queue.id); // Lấy thông tin guild từ client
            if (!guild) return console.log(colors.cyan(`Update-Music-System`) + ` - Music System - Không tìm thấy Guild!`); // Kiểm tra nếu không tìm thấy guild, in log và return
            let channel = guild.channels.cache.get(data.MusicData.ChannelId) as TextChannel || await guild.channels.fetch(data.MusicData.ChannelId).catch(() => { }) as TextChannel; // Lấy thông tin channel từ guild
            if (!channel) return console.log(colors.cyan(`Update-Music-System`) + ` - Music System - Không tìm thấy kênh!`); // Kiểm tra nếu không tìm thấy channel, in log và return
            let message = channel.messages.cache.get(data.MusicData.MessageId as string) || await channel.messages.fetch(data.MusicData.MessageId as string).catch(() => { }); // Lấy thông tin message từ channel
            if (!message) return console.log(colors.cyan(`Update-Music-System`) + ` - Music System - Không tìm thấy tin nhắn!`); // Kiểm tra nếu không tìm thấy message, in log và return
            message.edit(this.generateQueueEmbed(queue.id, leave)).catch((e) => console.log(e)).then(() => {
                console.log(colors.magenta(`- Đã chỉnh sửa tin nhắn do Tương tác của người dùng`));
            }); // Chỉnh sửa tin nhắn với thông tin mới từ hàm generateQueueEmbed
        };
    };
    /**
     * Nhận dữ liệu hàng đợi và bài hát mới và trả về một Embed thông báo.
     */
    private receiveQueueData(newQueue: Queue): any {
        // Kiểm tra nếu không tìm thấy bài hát hoặc track, Trả về một Embed thông báo lỗi
        if (!newQueue) return new MessageEmbed({
            colors: "Random",
            title: { text: "Không thể tìm kiếm bài hát" }
        });
        // Xây dựng Embed chứa thông tin bài hát và queue
        const embeds = new MessageEmbed({
            author: { name: `${newQueue.songs[0].name}`, iconURL: "https://i.pinimg.com/originals/ab/4d/e0/ab4de08ece783245be1fb1f7fde94c6f.gif", url: newQueue.songs[0].url },
            images: `https://img.youtube.com/vi/${newQueue.songs[0].id}/mqdefault.jpg`,
            timestamp: Date.now(),
            colors: "Random",
            fields: [
                { name: `Thời lượng:`, value: `>>> \`${newQueue.formattedCurrentTime} / ${newQueue.songs[0].formattedDuration}\``, inline: true },
                { name: `Hàng chờ:`, value: `>>> \`${newQueue.songs.length} bài hát\`\n\`${newQueue.formattedDuration}\``, inline: true },
                { name: `Âm lượng:`, value: `>>> \`${newQueue.volume} %\``, inline: true },
                { name: `vòng lặp:`, value: `>>> ${newQueue.repeatMode ? newQueue.repeatMode === 2 ? `✔️ hàng chờ` : `✔️ Bài hát` : `❌`}`, inline: true },
                { name: `Tự động phát:`, value: `>>> ${newQueue.autoplay ? `✔️` : `❌`}`, inline: true },
                { name: `Filters:`, value: `\`${newQueue.filters.names.join(", ") || "Tắt"}\``, inline: true },
                { name: `Xem trên youtube:`, value: `>>> [Click vào đây](${newQueue.songs[0].url})`, inline: true },
                { name: `Lượt xem:`, value: `${Intl.NumberFormat().format(newQueue.songs[0].views as number)}`, inline: true },
            ],
        });
        if (newQueue.songs[0].likes) {
            embeds.addFields({ name: `Likes`, value: `👍 ${Intl.NumberFormat().format(newQueue.songs[0].likes)}`, inline: true });
        };
        if (newQueue.songs[0].dislikes) {
            embeds.addFields({ name: `Dislikes`, value: `👎 ${Intl.NumberFormat().format(newQueue.songs[0].dislikes)}`, inline: true });
        };
        // Thêm bộ lọc âm nhạc
        const filterOptions = Object.keys(newQueue.distube.filters).map((filter) => ({
            label: filter.charAt(0).toUpperCase() + filter.slice(1),
            value: filter
        }));
        // Xây dựng components cho Embed.
        const components: any = new ComponentBuilder([
            {
                type: "SelectMenuBuilder",
                options: {
                    placeholder: "Vui lòng lựa chọn filter theo yêu cầu",
                    customId: "filters-options",
                    disabled: false,
                    options: filterOptions,
                }
            },
            {
                type: "ButtonBuilder",
                options: [
                    { customId: "skip", style: toButtonStyle("Primary"), emoji: "⏭", label: "Bỏ qua", disabled: false },
                    { customId: "stop", style: toButtonStyle("Danger"), emoji: "🛑", label: "Dừng phát", disabled: false },
                    { customId: "pause", style: toButtonStyle("Success"), emoji: "⏸", label: "Tạm dừng", disabled: false },
                    { customId: "autoplay", style: toButtonStyle("Success"), emoji: "❌", label: "Tự động phát", disabled: false },
                    { customId: "shuffle", style: toButtonStyle("Primary"), emoji: "🔀", label: "Xáo trộn", disabled: false },
                ]
            },
            {
                type: "ButtonBuilder",
                options: [
                    { customId: "song", style: toButtonStyle("Success"), emoji: "🔁", label: "Bài hát", disabled: false },
                    { customId: "queue", style: toButtonStyle("Success"), emoji: "🔂", label: "Hàng chờ", disabled: false },
                    { customId: "seek", style: toButtonStyle("Primary"), emoji: "⏩", label: "+10 Giây", disabled: false },
                    { customId: "seek2", style: toButtonStyle("Primary"), emoji: "⏪", label: "-10 Giây", disabled: false },
                    { customId: "lyrics", style: toButtonStyle("Primary"), emoji: "📝", label: "Lời nhạc", disabled: false },
                ]
            },
            {
                type: "ButtonBuilder",
                options: [
                    { customId: "volumeUp", style: toButtonStyle("Primary"), emoji: "🔊", label: "+10", disabled: false },
                    { customId: "volumeDown", style: toButtonStyle("Primary"), emoji: "🔉", label: "-10", disabled: false },
                ]
            }
        ]);
        // Tối ưu hóa các điều kiện
        if (!newQueue.playing) {
            components[1].components[2].setStyle(toButtonStyle("Success")).setEmoji("▶️").setLabel("Tiếp tục");
        } else if (newQueue.autoplay) {
            components[1].components[3].setStyle(toButtonStyle("Secondary")).setEmoji("👍");
        };
        // Tối ưu hóa các điều kiện repeatMode
        const repeatModeStyles = { 0: ["Success", "Success"], 1: ["Secondary", "Success"], 2: ["Success", "Secondary"] };
        const [firstStyle, secondStyle] = repeatModeStyles[newQueue.repeatMode];
        components[2].components[0].setStyle(toButtonStyle(firstStyle as any));
        components[2].components[1].setStyle(toButtonStyle(secondStyle as any));
        // Tối ưu hóa điều kiện cho seek buttons
        components[2].components[2].setDisabled(Math.floor((newQueue.songs[0].duration - newQueue.currentTime)) <= 10 ? true : false);
        components[2].components[3].setDisabled(Math.floor(newQueue.currentTime) < 10 ? true : false);
        // tối ưu hoá cho volume button
        components[3].components[0].setDisabled(newQueue.volume >= 120 ? true : false);
        components[3].components[1].setDisabled(newQueue.volume <= 10 ? true : false);
        // Trả về object chứa embeds và components
        return { embeds: [embeds], components: components };
    };
    /**
     * Tạo một embed và các thành phần cho hàng đợi nhạc.
     * @param {string} guildId - ID của guild.
     * @param {boolean} leave - Dấu hiệu bot có rời khỏi kênh âm thanh hay không.
     * @returns {Object} - Một đối tượng chứa embeds và components đã được cập nhật.
     */
    private generateQueueEmbed(guildId: string, leave?: boolean): any {
        // tìm kiếm guilds
        let guild = this.client.guilds.cache.get(guildId);
        if (!guild) return; // nếu không thấy guilds, return
        let newQueue = this.getQueue(guild.id); // tìm kiếm hàng đợi
        // gif chờ chạy nhạc
        const genshinGif = [
            "https://upload-os-bbs.hoyolab.com/upload/2021/08/12/64359086/ad5f51c6a4f16adb0137cbe1e86e165d_8637324071058858884.gif?x-oss-process=image/resize,s_1000/quality,q_80/auto-orient,0/interlace,1/format,gif",
            "https://upload-os-bbs.hoyolab.com/upload/2021/08/12/64359086/2fc26b1deefa6d2ff633dda1718d6e5b_6343886487912626448.gif?x-oss-process=image/resize,s_1000/quality,q_80/auto-orient,0/interlace,1/format,gif",
        ];
        // khởi tạo embeds
        let embeds = [
            new MessageEmbed({
                description: "**Hiện tại có 0 Bài hát trong Hàng đợi**",
                title: { text: `📃 hàng đợi của __${guild.name}__` },
                thumbnail: guild.iconURL() as string,
                colors: "Random",
                fields: [
                    { name: "Bắt đầu nghe nhạc, bằng cách kết nối với Kênh voice và gửi __liên kết bài hát__ hoặc __tên bài hát__ trong Kênh này!", value: "\u200B", inline: false },
                    { name: "Tôi hỗ trợ __youtube-url__, __Spotify__, __SoundCloud__ và các __mp3__ trực tiếp ...", value: "\u200B", inline: false },
                ]
            }),
            new MessageEmbed({ footer: { text: guild.name, iconURL: guild.iconURL() as string }, images: genshinGif[Math.floor(Math.random() * genshinGif.length)], colors: "Random" })
        ];
        const components: any = new ComponentBuilder([
            {
                type: "SelectMenuBuilder",
                options: {
                    placeholder: "Vui lòng lựa chọn mục theo yêu cầu",
                    customId: "StringSelectMenuBuilder",
                    disabled: true,
                    maxValues: 1,
                    minValues: 1,
                    options: [["Gaming", "NCS | No Copyright Music"].map((t, index) => {
                        return {
                            label: t.substring(0, 25), // trích xuất từ 0 đến 25 từ
                            value: t.substring(0, 25), // trích xuất từ 0 đến 25 từ
                            description: `Tải Danh sách phát nhạc: '${t}'`.substring(0, 50),  // trích xuất từ 0 đến 50 từ
                            emoji: ["0️⃣", "1️⃣"][index], // thêm emoji cho từng cụm từ
                            default: false // lựa chọn mặc định
                        };
                    })]
                },
            },
            {
                type: "ButtonBuilder",
                options: [
                    { customId: "Stop", style: toButtonStyle("Danger"), emoji: "🛑", label: "Dừng phát", disabled: true },
                    { customId: "Skip", style: toButtonStyle("Primary"), emoji: "⏭", label: "Bỏ qua", disabled: true },
                    { customId: "Shuffle", style: toButtonStyle("Primary"), emoji: "🔀", label: "Xáo trộn", disabled: true },
                    { customId: "Pause", style: toButtonStyle("Secondary"), emoji: "⏸", label: "Tạm dừng", disabled: true },
                    { customId: "Autoplay", style: toButtonStyle("Success"), emoji: "🛞", label: "Tự động phát", disabled: true },
                ],
            },
            {
                type: "ButtonBuilder",
                options: [
                    { customId: "Song", style: toButtonStyle("Success"), emoji: "🔁", label: "Bài hát", disabled: true },
                    { customId: "Queue", style: toButtonStyle("Success"), emoji: "🔂", label: "Hàng đợi", disabled: true },
                    { customId: "Forward", style: toButtonStyle("Primary"), emoji: "⏩", label: "+10 Giây", disabled: true },
                    { customId: "Rewind", style: toButtonStyle("Primary"), emoji: "⏪", label: "-10 Giây", disabled: true },
                    { customId: "VolumeUp", style: toButtonStyle("Primary"), emoji: "🔊", label: "+10", disabled: true },
                ],
            },
            {
                type: "ButtonBuilder",
                options: [
                    { customId: "VolumeDown", style: toButtonStyle("Primary"), emoji: "🔉", label: "-10", disabled: true },
                    { customId: "Lyrics", style: toButtonStyle("Primary"), emoji: "📝", label: "Lời nhạc", disabled: true },
                ],
            }
        ]);
        if (!leave && newQueue && newQueue.songs[0]) {
            // hiển thị và khởi chạy bài hát đầu tiên
            embeds[1] = new MessageEmbed({
                images: `https://img.youtube.com/vi/${newQueue.songs[0].id}/mqdefault.jpg`,
                author: { name: `${newQueue.songs[0].name}`, iconURL: `https://images-ext-1.discordapp.net/external/DkPCBVBHBDJC8xHHCF2G7-rJXnTwj_qs78udThL8Cy0/%3Fv%3D1/https/cdn.discordapp.com/emojis/859459305152708630.gif`, url: newQueue.songs[0].url },
                footer: { text: `${newQueue.songs[0].member ? newQueue.songs[0].member?.displayName : "BlackCat-Club"}`, iconURL: newQueue.songs[0].user?.displayAvatarURL() },
                colors: "Random",
                fields: [
                    { name: `🔊 Âm lượng:`, value: `>>> \`${newQueue.volume} %\``, inline: true },
                    { name: `${newQueue.playing ? `♾ Vòng lặp:` : `⏸️ Đã tạm dừng:`}`, value: newQueue.playing ? `>>> ${newQueue.repeatMode ? newQueue.repeatMode === 2 ? `✔️ Hàng đợi` : `✔️ \`Bài hát\`` : `❌`}` : `>>> ✔️`, inline: true },
                    { name: `Autoplay:`, value: `>>> \`Đang ${newQueue.autoplay ? "bật" : "tắt"}\``, inline: true },
                    { name: `❔ Filters:`, value: `>>> ${newQueue.filters.names.join(", ") || "❌"}`, inline: true },
                    { name: `🚨 Yêu cầu bởi:`, value: `>>> ${newQueue.songs[0].member?.displayName}`, inline: true },
                    { name: `⏱ Thời gian:`, value: `\`${newQueue.formattedCurrentTime}\` ${createBar(newQueue.songs[0].duration, newQueue.currentTime, 13)} \`${newQueue.songs[0].formattedDuration}\``, inline: false },
                ],
            });
            var maxTracks = 10; // bài hát / Trang hàng đợi
            embeds[0] = new MessageEmbed({
                title: { text: `📃 hàng đợi của __${guild.name}__ - [${newQueue.songs.length} bài hát]` },
                colors: "Random",
                description: `${String(newQueue.songs.slice(0, maxTracks).map((track, index) => `**\` ${++index}. \` ${track.url ? `[${track.name?.substring(0, 60).replace(/\[/igu, `\[`).replace(/\]/igu, `\]`)}](${track.url})` : track.name}** - \`${track.stream ? "Trực Tiếp" : track.formattedDuration}\`\n> *Được yêu cầu bởi: __${track.user ? track.user.globalName : this.client.user?.username}__*`).join(`\n`)).substring(0, 2048)}`,
            });
            // hiển thị số lượng bài hát đang chờ
            newQueue.songs.length > 10 && embeds[0].addFields({
                name: `**\` =>. \` và *${newQueue.songs.length > maxTracks ? newQueue.songs.length - maxTracks : newQueue.songs.length}*** bài hát khác ...`,
                value: `\u200b`
            });
            // hiển thị bài hát đang được phát
            embeds[0].addFields({
                name: `**\` =>. \` __HIỆN TẠI ĐANG PHÁT__**`,
                value: `**${newQueue.songs[0].url ? `[${newQueue.songs[0].name?.substring(0, 60).replace(/\[/igu, `\[`).replace(/\]/igu, `\]`)}](${newQueue.songs[0].url})` : newQueue.songs[0].name}** - \`${newQueue.songs[0].stream ? "Trực Tiếp" : newQueue.formattedCurrentTime}\`\n> *Được yêu cầu bởi: __${newQueue.songs[0].user ? newQueue.songs[0].user.globalName : this.client.user?.username}__*`
            });
            // loại bỏ disabled
            components.forEach((c: any) => c.components.forEach((btn: ButtonBuilder) => btn.setDisabled(false)));
            // Cập nhật style và label cho các nút điều khiển dựa trên trạng thái của queue
            if (newQueue.autoplay) {
                components[1].components[4].setStyle(toButtonStyle("Secondary"));
            } else if (newQueue.paused) {
                components[1].components[3].setStyle(toButtonStyle("Success")).setEmoji("▶️").setLabel("Tiếp tục");
            };
            // Cập nhật style cho các nút điều khiển lặp lại
            if (newQueue.repeatMode === 1) {
                components[2].components[0].setStyle(toButtonStyle("Secondary"));
                components[2].components[1].setStyle(toButtonStyle("Success"));
            } else if (newQueue.repeatMode === 2) {
                components[2].components[0].setStyle(toButtonStyle("Success"));
                components[2].components[1].setStyle(toButtonStyle("Secondary"));
            } else {
                components[2].components[0].setStyle(toButtonStyle("Success"));
                components[2].components[1].setStyle(toButtonStyle("Success"));
            };
        };
        // mốc tính thời gian
        function createBar(total: number, current: number, size: number = 25, line: string = "▬", slider: string = "🎶") {
            // Kiểm tra nếu không có tổng thời gian, hoặc thời gian hiện tại, trả về thanh mặc định
            if (!total || !current) return `**[${slider}${line.repeat(size - 1)}]**`;
            // Tính toán giá trị thanh và phần trăm
            const [barLine] = current > total ? [line.repeat(size), 100] /* Nếu thời gian hiện tại lớn hơn tổng thời gian, hiển thị thanh đầy và phần trăm 100% */ : [line.repeat(Math.round(size * (current / total))).replace(/.$/, slider) + line.repeat(size - Math.round(size * (current / total)) + 1), (current / total) * 100];
            // Nếu thanh không chứa slider, trả về thanh mặc định
            return !String(barLine).includes(slider) ? `**[${slider}${line.repeat(size - 1)}]**` : `**[${barLine}]**`;  // Ngược lại, trả về thanh đã tính toán và hiển thị phần trăm
        };
        // Trả về embeds và components đã được cập nhật
        return { embeds, components: components };
    };
    /**
     * 
     * @param client 
     * @param guilds 
     * @returns 
     */
    musicEmbedDefault(client: Client, guilds: string) {
        const guild = client.guilds.cache.get(guilds) as Guild;
        const genshinGif = [
            "https://upload-os-bbs.hoyolab.com/upload/2021/08/12/64359086/ad5f51c6a4f16adb0137cbe1e86e165d_8637324071058858884.gif?x-oss-process=image/resize,s_1000/quality,q_80/auto-orient,0/interlace,1/format,gif",
        ];
        const randomGenshin = genshinGif[Math.floor(Math.random() * genshinGif.length)];
        var Emojis = ["0️⃣", "1️⃣"];
        const embed1 = new MessageEmbed({
            description: `**Hiện tại có __0 Bài hát__ trong Hàng đợi**`,
            title: { text: `📃 hàng đợi của __${guild.name}__` },
            thumbnail: guild.iconURL() as string,
            colors: "Random",
        });
        const embed2 = new MessageEmbed({
            title: { text: `Bắt đầu nghe nhạc, bằng cách kết nối với Kênh voice và gửi **LIÊN KẾT BÀI HÁT** hoặc **TÊN BÀI HÁT** trong Kênh này!` },
            description: `> *Tôi hỗ trợ Youtube, Spotify, Soundcloud và các liên kết MP3 trực tiếp!*`,
            footer: { text: guild.name, iconURL: guild.iconURL() as string },
            images: randomGenshin,
            colors: "Random"
        });
        const components = new ComponentBuilder([
            {
                type: "SelectMenuBuilder",
                options: {
                    placeholder: "Vui lòng lựa chọn mục theo yêu cầu",
                    customId: "StringSelectMenuBuilder",
                    disabled: false,
                    maxValues: 1,
                    minValues: 1,
                    options: [["Gaming", "NCS | No Copyright Music"].map((t, i) => {
                        return {
                            label: t.substring(0, 25), // trích xuất từ 0 đến 25 từ 
                            value: t.substring(0, 25), // trích xuất từ 0 đến 25 từ
                            description: `Tải Danh sách phát nhạc: '${t}'`.substring(0, 50),  // trích xuất từ 0 đến 50 từ
                            emoji: Emojis[i], // thêm emoji cho từng cụm từ 
                            default: false // lựa chọn mặc định
                        };
                    })]
                },
            },
            {
                type: "ButtonBuilder",
                options: [
                    { style: "Primary", customId: "1", emoji: "⏭", label: "Skip", disabled: true },
                    { style: "Danger", customId: "2", emoji: "🏠", label: "Stop", disabled: true },
                    { style: "Secondary", customId: "3", emoji: "⏸", label: "Pause", disabled: true },
                    { style: "Success", customId: "4", emoji: "🔁", label: "Autoplay", disabled: true },
                    { style: "Primary", customId: "5", emoji: "🔀", label: "Shuffle", disabled: true },
                ]
            },
            {
                type: "ButtonBuilder",
                options: [
                    { style: "Success", customId: "6", emoji: "🔁", label: "Song", disabled: true },
                    { style: "Success", customId: "7", emoji: "🔂", label: "Queue", disabled: true },
                    { style: "Primary", customId: "8", emoji: "⏩", label: "+10 Sec", disabled: true },
                    { style: "Primary", customId: "9", emoji: "⏪", label: "-10 Sec", disabled: true },
                    { style: "Primary", customId: "10", emoji: "📝", label: "Lyrics", disabled: true },
                ]
            },
        ]);
        return { embeds: [embed1, embed2], components: components };
    };
}