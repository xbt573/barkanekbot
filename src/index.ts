import Bot from './bot.js';
import config from 'config';

const botToken: string = config.get('bot.token');
const apiId: number = config.get('bot.apiId');
const apiHash: string = config.get('bot.apiHash');
const stringSession: string = config.get('bot.stringSession') || '';
const channels: Array<string> = config.get('bot.channels') || ['anekdotcollection'];

// eslint-disable-next-line
const bot = new Bot(botToken, apiId, apiHash, stringSession, channels);
