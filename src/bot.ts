import { Bot, Context, NextFunction } from 'grammy';

import { helpers, Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent } from 'telegram/events';

import input from 'input';
import delay from 'delay';

/**
 * Converts {@link Set} to {@link Array}
 * @param {Set<T>} set - Input set
 * @returns {Array<T>} - Output array
 */
function setToArray<T>(set: Set<T>): Array<T> {
    const outArr: Array<T> = new Array<T>();

    for (const element of set) {
        outArr.push(element);
    }

    return outArr
}

/**
 * Generate random numbers
 * @param {number} min - Minimal number
 * @param {number} max - Maximum number
 */
function random(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) ) + min;
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
    private _bot: Bot;

    /**
     * TelegramClient instance
     * @private
     * @property
     */
    private _client: TelegramClient;

    /**
     * Jokes list
     * @private
     * @property
     */
    private _anekList: Set<string>;

    /**
     * Bot instance
     * @private
     * @property
     */
    private _channels: Array<string>;

    /**
     * Message count for each channel
     * @private
     * @property
     */
    private _messageCount: Record<string, number>;

    /**
     * Channel peers
     * @private
     * @property
     */
    private _peers: Record<string, Api.Channel>;

    /**
     * Dictionary with last interact with users
     * @private
     * @property
     */
    private _users: Record<number, Date>;


    /**
     * Class constructor
     * @constructor
     * @param {string} botToken - Bot token
     * @param {number} apiId - MTProto API Id
     * @param {string} apiHash - MTProto API Hash
     * @param {(string|undefined)} [stringSession] - String session
     * @channels {Array<string>} channels - Channels list
     */
    constructor(botToken: string,
                apiId: number,
                apiHash: string,
                stringSession: string | undefined,
                channels: Array<string>) {
        this._bot = new Bot(botToken);

        this._peers = {};
        this._messageCount = {};

        this._users = {};
        this._bot.use(this._antiSpamMiddleware.bind(this));

        this._bot.command('start', this._start);
        this._bot.command('help', this._help);
        this._bot.command('anek', this._anek.bind(this));
        this._bot.on('inline_query', this._anekInline.bind(this));

        const session: StringSession = new StringSession(stringSession || '');
        this._client = new TelegramClient(session, apiId, apiHash, {
            connectionRetries: 5
        });

        this._anekList = new Set<string>();

        this._channels = channels;

        this._init(session);
    }

    /**
     * Pop N jokes from {@link _aneksList}
     * @private
     * @function
     * @param {number} count - Count of jokes to pop
     */
    private _popAneks(count: number): void {
        let i = 0;

        for (const element of setToArray(this._anekList)) {
            if (i > count) return;
            this._anekList.delete(element);
            i++;
        }
    }

    /**
     * Init client session
     * @private
     * @function
     * @param {StringSession} session - String session
     */
    private async _init(session: StringSession) {
        await this._client.start({
            phoneNumber: async (): Promise<string> => await input.text('Phone number: '),
            password: async (): Promise<string> => await input.text('Password: '    ),
            phoneCode: async (): Promise<string> => await input.text('Phone code: '  ),
            onError: (): void => { throw new Error('Client error!'); },
        });
        console.log('You should now be connected (probably).');
        console.log('Session string sent to your chat, use it to avoid login next time.');

        await this._client.sendMessage('me', { message: session.save() });

        // eslint-disable-next-line
        let fullChannel: any;
        let peer;
        for (const channel of this._channels) {
            fullChannel = await this._client.invoke(new Api.channels.GetFullChannel({
                channel: channel
            }));

            if (fullChannel.fullChat["pts"] == undefined) {
                throw Error('Channel is chat.');
            }

            this._messageCount[channel] = fullChannel.fullChat.pts;
            peer = await this._client.getEntity(channel);

            if (!peer) {
                throw Error('Channel is not present (wtf)');
            }

            if (peer.className != 'Channel') {
                throw Error('Channel is chat.');
            }

            this._peers[channel] = peer;

            await delay(1000);
        }
        console.log('channels reloaded, starting bot and loops');

        this._client.addEventHandler(this._onNewMessage.bind(this), new NewMessage());

        this._startAnekLoop();
        this._bot.start({
            drop_pending_updates: true
        });
    }

    /**
     * Start command
     * @private
     * @function
     * @param {Context} ctx
     */
    private async _start(ctx: Context): Promise<void> {
        await ctx.reply('*Привет!* Этот бот собирает анекдоты с различных групп и отправляет их *в вашу любимую беседу!* \
Чтобы получить рандомный анекдот напишите команду /anek, *права администратора боту не нужны :)*.',
            { parse_mode: 'Markdown' }
        );
    }

    /**
     * Help command
     * @private
     * @function
     * @param {Context} ctx
     */
    private async _help(ctx: Context): Promise<void> {
        await ctx.reply('Команда у бота всего одна: */anek*, права администратора для отправки анеков *не требуются* :).',
            { parse_mode: 'Markdown' }
        );
    }

    /**
     * Anek command
     * @private
     * @function
     * @param {Context} ctx
     */
    private async _anek(ctx: Context): Promise<void> {
        await ctx.reply(setToArray(this._anekList)[random(0, this._anekList.size)]);
    }

    /**
     * Inline anek command
     * @private
     * @function
     * @param {Context} ctx
     */
    private async _anekInline(ctx: Context): Promise<void> {
        const inlineAnswer = [];

        const ids: Array<number> = [];
        for (let i = 0; i < 10; i++) {
            const id = random(0, this._anekList.size);
            const anek = setToArray(this._anekList)[id];

            if (ids.includes(id)) {
                i--; continue;
            }

            ids.push(id);
            inlineAnswer.push(this._generateAnekInline(id, anek));
        }

        await ctx.answerInlineQuery(inlineAnswer);
    }

    private async _onNewMessage(event: NewMessageEvent): Promise<void> {
        if (!event.isChannel) return;

        const channel = await event.message.getChat();
        if(!channel) return;

        if (channel.className != 'Channel') return;
        if (!channel.username) return;

        if (channel.username in this._channels) {
            this._messageCount[channel.username]++;
        }

    }

    /**
     * Generate inline answer
     * @param {number} id - Id of the answer
     * @param {string} anek - Joke to send
     */
    // eslint-disable-next-line
    private _generateAnekInline(id: number, anek: string): any {
        return {
            type: 'article',
            id: id,
            title: anek,
            input_message_content: {
                message_text: anek
            }
        };
    }

    /**
     * Anek caching loop
     * @private
     * @function
     * @param {string} channel
     */
    private async _anekLoop(channel: string): Promise<void> {
        const message = this._messageCount[channel];
        const peer = this._peers[channel];

        const randomIds: Array<number> = Array.from({ length: 100 }, () => random(0, message));

        const messages: helpers.TotalList<Api.Message> = await this._client.getMessages(peer, {
            ids: randomIds
        });

        const aneks = messages.filter(element => {
            if (!element) {
                return false;
            }

            if (element.className != 'Message') {
                return false;
            }

            if (element.message.includes('@')) {
                return false;
            }

            if (element.message.trim() == '') {
                return false;
            }

            return true;
        });

        if (this._anekList.size > 100000)
            this._popAneks((this._anekList.size - 100000) + aneks.length);

        aneks.forEach(x => this._anekList.add(x.message));
    }

    /**
     * Start anek loop
     * @private
     * @function
     */
    private async _startAnekLoop(): Promise<void> {
        for (const channel of this._channels) {
            await this._anekLoop(channel);
            await delay(30000);
        }

        setTimeout(this._startAnekLoop.bind(this), 1000);
    }

    /**
     * Anti spam middleware
     * @private
     * @function
     * @param {Context} ctx
     * @param {NextFunction} next
     */
    private async _antiSpamMiddleware(ctx: Context, next: NextFunction): Promise<void> {
        if (!ctx) return;
        if (!(ctx.message?.from || ctx.inlineQuery?.from)) return;

        let id;
        if (ctx.message?.from) {
            id = ctx.message.from.id;
        }

        if (ctx.inlineQuery?.from) {
            id = ctx.inlineQuery.from.id;
        }

        if (!id) return;
        if (!(id in this._users)) this._users[id] = new Date("January 01, 1970, 00:00:00");
        if (Date.now() - this._users[id].getTime() < 1000) return;

        this._users[id] = new Date();
        await next();
    }
}

export default AnekBot;
