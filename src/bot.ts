import { Bot, Context } from 'grammy';

import { helpers, Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

import input from 'input';

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
     * Requests limit
     * @private
     * @property
     */
     private _limit: number;

    /**
     * Bot instance
     * @private
     * @property
     */
    private _channels: Array<string>;


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

        this._bot.command('start', this._start);
        this._bot.command('help', this._help);
        this._bot.command('anek', this._anek.bind(this));

        const session: StringSession = new StringSession(stringSession || '');
        this._client = new TelegramClient(session, apiId, apiHash, {
            connectionRetries: 5
        });

        this._anekList = new Set<string>();
        this._channels = channels;

        this._limit = 0;
        this._resetLimit();

        this._init(session);
    }

    /**
     * Reset {@link _limit}
     * @private
     * @function
     */
    private _resetLimit() {
        this._limit = 0;
        setInterval(() => this._resetLimit(), 1000);
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
     * @param {Context} context
     */
    private async _anek(ctx: Context): Promise<void> {
        await ctx.reply(setToArray(this._anekList)[Math.floor(Math.random() * this._anekList.size)]);
    }

    /**
     * Anek caching loop
     * @private
     * @function
     * @param {string} channel
     */
    private async _anekLoop(channel: string): Promise<void> {
        if (this._limit >= 15) {
            setTimeout(() => this._anekLoop(channel), 1000);
            return;
        }

        const random = (min: number, max: number) => Math.floor(Math.random() * (max - min) ) + min;

        // eslint-disable-next-line
        const checkMessage = (message: any): boolean => {
            if (!message) {
                return false;
            }

            if (message.className != 'Message') {
                return false;
            }

            if (message.message.includes('@')) {
                return false;
            }

            return true;
        };

        const peer = await this._client.getEntity(channel);
        this._limit++;

        // eslint-disable-next-line
        const fullChannel: any = await this._client.invoke(new Api.channels.GetFullChannel({
            channel: channel
        }));
        this._limit++;

        if (fullChannel.fullChat["pts"] == undefined) {
            throw Error('Channel is chat.');
        }

        const randomId: number = random(0, fullChannel.fullChat.pts);

        const messages: helpers.TotalList<Api.Message> = await this._client.getMessages(peer, {
            ids: [randomId]
        });
        this._limit++;

        const message = messages[0];

        let add: boolean = checkMessage(message);
        if (add) {
            if (this._anekList.size > 100000)
                this._popAneks((this._anekList.size - 100000) + 1);

            this._anekList.add(message.message);
        }
        setTimeout(() => this._anekLoop(channel), 1000);
    }

    /**
     * Start anek loop
     * @private
     * @function
     */
    private async _startAnekLoop(): Promise<void> {
        async function delay(ms: number) {
            await new Promise( resolve => setTimeout(resolve, ms) );
        }

        this._channels.forEach(async x => {
            await this._anekLoop(x);
            await delay(1000);
        });
    }
}

export default AnekBot;
