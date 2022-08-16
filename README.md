# Bark Anek Bot ![node](https://github.com/xbt573/barkanekbot/actions/workflows/node.js.yml/badge.svg) ![docker](https://github.com/xbt573/barkanekbot/actions/workflows/docker-image.yml/badge.svg)


This Telegram bot sends "aneks" (jokes on russian slang) in your favourite chat!

# Configure and Run
Firstly, clone the repo
```bash
git clone https://github.com/xbt573/barkanekbot
```

Then, create `production.yml` in config folder, it should contain config like this
```json
{
    "bot": {
        "token": "<YOUR_BOT_TOKEN>",
        "apiId": "<YOUR_API_ID>",
        "apiHash": "<YOUR_API_HASH>",
        "stringSession": "<YOUR_STRING_SESSION>",
        "channels": ["list", "of", "channels", "to", "fetch"]
    }
}
```

You can get apiId and apiHash by following this guide: https://core.telegram.org/api/obtaining_api_id
String session is optional, it will sent to your "Saved Messages" after first login.

Then, you need to build bot.
You have two ways to build bot: with Docker and manually

## Docker
To build bot with Docker, run this command in repo root:
```bash
docker build . -t barkanekbot
```

## Manually
To build bot manually, run this commands in repo root:
```bash
yarn install
yarn build
```

The way you run it depends on how you built the bot:

## Docker
```bash
docker-compose up
# or without compose
docker run -it -v $PWD/config:/app/config barkanekbot
```

## Manually
```bash
yarn start
```

Bot will request to login if you don't specified string session.
Congratulations! You built and started this bot.

# Authors
* [xbt573](https://github.com/xbt573) - Main developer
