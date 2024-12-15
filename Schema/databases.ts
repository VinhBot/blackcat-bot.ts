import mongoose, { Document, Model } from "mongoose";

interface BlackCatData extends Document {
    /**
     * Id của Guilds mà bot tham gia
     */
    GuildId: string;
    /**
     * Danh sách tên tất cả các guild mà bot tham gia
     */
    GuildName: string; 
    /**
     * Prefix của guilds
     */
    Prefix: string; 
    MusicData: {
        /**
         * Bật tắt chế độ tự động phát cho bot trong guild
         */
        Autoresume: boolean; 
        /**
         * Bật hoặc tắt chế độ tự động phát bài hát tiếp theo 
         */
        Autoplay: boolean; 
        /**
         * Mặc định volume cho bot khi phát nhạc 
         */
        Volume: number; 
        /**
         * Bộ lọc mặc định khi phát nhạc dành cho guild
         */
        Filters: string[]; 
        /**
         * Id tin nhắn của kênh tự động phát (có thể không tồn tại)
         */ 
        MessageId: string;
        /**
         * Id kênh tự động phát nhạc (có thể không tồn tại)
         */ 
        ChannelId: string;
    };
    WelcomeGoodbyeChannel: {
        /**
         * Id kênh chào mừng
         */
        WelcomeChannel: string; 
        /**
         * Id kênh tạm biệt
         */
        GoodbyeChannel: string; 
    };
    Ranking: {
        ChannelID: string; // Id kênh ranking khi người dùng lên level
    };
}

const BlackCatModel: Model<BlackCatData> = mongoose.model<BlackCatData>("blackcat-data", new mongoose.Schema<BlackCatData>({
    GuildId: { type: mongoose.Schema.Types.String },
    GuildName: { type: mongoose.Schema.Types.String },
    Prefix: { type: mongoose.Schema.Types.String, default: process.env.botPrefix },
    MusicData: {
        Autoresume: { type: mongoose.Schema.Types.Boolean, default: false },
        Autoplay: { type: mongoose.Schema.Types.Boolean, default: false },
        Volume: { type: mongoose.Schema.Types.Number, default: 50 },
        Filters: { type: mongoose.Schema.Types.Array, default: ["bassboost"] },
        MessageId: { type: mongoose.Schema.Types.String },
        ChannelId: { type: mongoose.Schema.Types.String }
    },
    WelcomeGoodbyeChannel: {
        WelcomeChannel: { type: mongoose.Schema.Types.String },
        GoodbyeChannel: { type: mongoose.Schema.Types.String },
    },
    Ranking: {
        ChannelID: { type: mongoose.Schema.Types.String },
    },
}));

export default BlackCatModel;