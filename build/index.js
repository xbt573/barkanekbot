import Bot from './bot.js';
import config from 'config';
const botToken = config.get('bot.token');
const apiId = config.get('bot.apiId');
const apiHash = config.get('bot.apiHash');
const stringSession = config.get('bot.stringSession') || '';
const bot = new Bot(botToken, apiId, apiHash, stringSession, ['anekdotcollection']);
