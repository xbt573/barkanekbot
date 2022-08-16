import { Bot } from 'grammy';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import input from 'input';
/**
 * Converts {@link Set} to {@link Array}
 * @param {Set<T>} set - Input set
 * @returns {Array<T>} - Output array
 */
function setToArray(set) {
    const outArr = new Array();
    for (const element of set) {
        outArr.push(element);
    }
    return outArr;
}
/**
 * Main bot class
 * @class
 */
class AnekBot {
    /**
     * Bot instance
     * @private
     * @property
     */
    _bot;
    /**
     * TelegramClient instance
     * @private
     * @property
     */
    _client;
    /**
     * Jokes list
     * @private
     * @property
     */
    _anekList;
    /**
     * Bot instance
     * @private
     * @property
     */
    _channels;
    /**
     * Class constructor
     * @constructor
     * @param {string} botToken - Bot token
     * @param {number} apiId - MTProto API Id
     * @param {string} apiHash - MTProto API Hash
     * @param {(string|undefined)} [stringSession] - String session
     * @channels {Array<string>} channels - Channels list
     */
    constructor(botToken, apiId, apiHash, stringSession, channels) {
        this._bot = new Bot(botToken);
        this._bot.command('start', this._start);
        this._bot.command('help', this._help);
        this._bot.command('anek', this._anek.bind(this));
        const session = new StringSession(stringSession || '');
        this._client = new TelegramClient(session, apiId, apiHash, {
            connectionRetries: 5
        });
        this._anekList = new Set();
        this._channels = channels;
        this._init(session);
    }
    /**
     * Init client session
     * @private
     * @function
     * @param {StringSession} session - String session
     */
    async _init(session) {
        await this._client.start({
            phoneNumber: async () => await input.text('Phone number: '),
            password: async () => await input.text('Password: '),
            phoneCode: async () => await input.text('Phone code: '),
            onError: () => { throw new Error('Client error!'); },
        });
        console.log('You should now be connected (probably).');
        console.log('Session string sent to your chat, use it to avoid login next time.');
        await this._client.sendMessage('me', { message: session.save() });
        this._startAnekLoop();
        this._bot.start();
    }
    /**
     * Start command
     * @private
     * @function
     * @param {Context} ctx
     */
    async _start(ctx) {
        await ctx.reply('*Привет!* Этот бот собирает анекдоты с различных групп и отправляет их *в вашу любимую беседу!* \
Чтобы получить рандомный анекдот напишите команду /anek, *права администратора боту не нужны :)*.', { parse_mode: 'Markdown' });
    }
    /**
     * Help command
     * @private
     * @function
     * @param {Context} ctx
     */
    async _help(ctx) {
        await ctx.reply('Команда у бота всего одна: */anek*, права администратора для отправки анеков *не требуются* :).', { parse_mode: 'Markdown' });
    }
    /**
     * Anek command
     * @private
     * @function
     * @param {Context} context
     */
    async _anek(ctx) {
        await ctx.reply(setToArray(this._anekList)[Math.floor(Math.random() * this._anekList.size)]);
    }
    /**
     * Anek caching loop
     * @private
     * @function
     * @param {string} channel
     */
    async _anekLoop(channel) {
        const random = (min, max) => Math.floor(Math.random() * (max - min)) + min;
        const peer = await this._client.getEntity(channel);
        const fullChannel = await this._client.invoke(new Api.channels.GetFullChannel({
            channel: channel
        }));
        if (fullChannel.fullChat["pts"] == undefined) {
            throw Error('Channel is chat.');
        }
        const randomIds = Array.from({ length: 20 }, () => random(0, fullChannel.fullChat.pts));
        const messages = await this._client.getMessages(peer, {
            ids: randomIds
        });
        messages.filter(element => {
            if (!element) {
                return false;
            }
            if (element.className != 'Message') {
                return false;
            }
            if (element.message.includes('@')) {
                return false;
            }
            return true;
        }).forEach(x => this._anekList.add(x.message));
        setTimeout(() => this._anekLoop(channel), 10000);
    }
    /**
     * Start anek loop
     * @private
     * @function
     */
    async _startAnekLoop() {
        async function delay(ms) {
            await new Promise(resolve => setTimeout(resolve, ms));
        }
        this._channels.forEach(async (x) => {
            await this._anekLoop(x);
            await delay(1000);
        });
    }
}
export default AnekBot;
