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

        this._init(session);
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
        const random = (min: number, max: number) => Math.floor(Math.random() * (max - min) ) + min;

        const peer = await this._client.getEntity(channel);

        // eslint-disable-next-line
        const fullChannel: any = await this._client.invoke(new Api.channels.GetFullChannel({
            channel: channel
        }));

        if (fullChannel.fullChat["pts"] == undefined) {
            throw Error('Channel is chat.');
        }

        const randomIds: Array<number> = Array.from({ length: 20 }, () => random(0, fullChannel.fullChat.pts));

        const messages: helpers.TotalList<Api.Message> = await this._client.getMessages(peer, {
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
