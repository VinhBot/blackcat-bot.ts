import type { ColorResolvable, EmbedField, EmbedAuthorOptions, EmbedFooterOptions } from "discord.js";
import { EmbedBuilder } from "discord.js";
/**
 * Khởi tạo một đối tượng MessageEmbed mới với các tùy chọn.
 */
export class MessageEmbed extends EmbedBuilder {
    /**
     * Tạo một embed mới từ dữ liệu API.
     *
     * @param data - Dữ liệu API để tạo embed này, bạn có thể tùy chọn bất kì giá trị nào dưới ví dụ sau.
     * @example
     * const embeds = new MessageEmbed({
     *    title: {
     *        text: "Tiêu đề của embed",
     *        url: "https://discord.js.org"
     *    },
     *    description: "mô tả ",
     *    timestamp: Date.now(),
     *    color: "Màu tùy chọn",
     *    author: {
     *        name: "Tên của tác giả",
     *        iconURL: "https://i.imgur.com/AfFp7pu.png",
     *        url: "https://discord.js.org",
     *    },
     *    thumbnail: "https://i.imgur.com/AfFp7pu.png",
     *    fields: [
     *        {
     *            name: "name 1",
     *            value: "value 1",
     *            inline: false
     *        },
     *        {
     *            name: "name 2",
     *            value: "value 2",
     *            inline: false
     *        }
     *    ],
     *    footer: {
     *        text: "văn bản của footer.",
     *        iconURL: "https://i.imgur.com/AfFp7pu.png"
     *    },
     *    images: "https://i.imgur.com/AfFp7pu.png"
     * });
     */
    constructor(options: Partial<{
        /**
         * Mô tả của embed
         *
         * Giới hạn độ dài: 4096 ký tự.
         */
        description: string;
        /**
         * Thông tin thumbnail.
         */
        thumbnail: string;
        /**
         * Dấu thời gian của nội dung embed.
         */
        timestamp: Date | number | undefined;
        /**
         * Tiêu đề cho embed.
         */
        title: Partial<{
            /**
             * Văn bản cho tiêu đề.
             * 
             * Giới hạn độ dài: 256 ký tự.
             */
            text: string;
            /**
             * URL cho embed.
             */
            url: string;
        }>;
        /**
         * Thông tin các field
         *
         * Giới hạn độ dài: 25 đối tượng field
         *
         * Xem https://discord.com/developers/docs/resources/channel#embed-object-embed-field-structure
         */
        fields: EmbedField[];
        /**
         * Thông tin tác giả.
         */
        author: Partial<{
            /**
             * Tên của tác giả
             *
             * Giới hạn độ dài: 256 ký tự
             */
            name: string;
            /**
             * URL của biểu tượng.
             */
            iconURL: string;
            /**
             * URL proxy của biểu tượng.
             */
            proxyIconURL: string;
            /**
             * Link liên kết của tác giả.
             */
            url: string;
        }>;
        /**
         * Thông tin footer
         */
        footer: Partial<{
            /**
             * Văn bản footer
             *
             * Giới hạn độ dài: 2048 ký tự
             */
            text: string,
            /**
             * URL của biểu tượng.
             */
            iconURL: string;
            /**
             * URL proxy của biểu tượng.
             */
            proxyIconURL: string;
        }>;
        /**
         * Hình ảnh embed.
         */
        images: string;
        /**
         * Mã màu của embed.
         */
        colors: ColorResolvable | any;
    }> = {}) {
        super();
        if (options.description) super.setDescription(options.description);
        if (options.thumbnail) super.setThumbnail(options.thumbnail);
        if (options.timestamp) super.setTimestamp(options.timestamp);
        if (options.title?.text) super.setTitle(options.title.text);
        if (options.title?.url) super.setURL(options.title.url);
        if (options.fields) super.addFields(options.fields);
        if (options.author) super.setAuthor(options.author as EmbedAuthorOptions);
        if (options.footer) super.setFooter(options.footer as EmbedFooterOptions);
        if (options.images) super.setImage(options.images);
        if (options.colors) super.setColor(options.colors);
    };
};