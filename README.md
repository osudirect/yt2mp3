# yt2mp3
High quality audio downloader using youtube-dl


## Features

- Extract youtube audios in the highest quality possible
- That's it lol

## Roadmap

- No clue. Maybe support video download aswell

## How to use

- Copy the ID of the youtube video like this:
![Screenshot](https://github.com/osudirect/yt2mp3/assets/45440100/e809bfaf-040a-42eb-bd37-6d032598b306)
- use the copied id like this:
https://audio.catboy.best/eNSRlrYDvFE
to extract and download the audio from the video.
Completely free. No ads, no premium queue, no speed cap.

## Self-hosting

This instance requires only a tiny amount of work to setup yourself.
Following requirements have been tested on Ubuntu 20.04

Node.js - tested on 20.12
ffmpeg - tested on 4.2.7
nginx - tested on 1.18.0

Now to the installation:

git clone the repository and edit the config

```bash
  git clone https://github.com/osudirect/yt2mp3
  cd yt2mp3
  nano .example.env
  mv .example.env .env
```

install all necessary dependencies using npm and start the script.

```bash
  npm install
  node index.js
```

edit your nginx config to your liking using a proxy_pass pointing at your set port and restart nginx.

profit.


## Authors

- [@Calemy](https://www.github.com/calemy)

Feel free to join as contributor!
