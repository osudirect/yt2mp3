# yt2mp3
High quality audio downloader using youtube-dl (Now with frontend!)

## Features

- Extract youtube audios in the highest quality possible
- a cool webui using [our frontend](https://www.github.com/osudirect/yt2mp3-web)
- That's it lol

## Roadmap

- No clue. Maybe support video download aswell
If you wish for something, please open an issue!

## How to use

- Copy the YouTube video url
- Visit https://audio.catboy.best
- Paste link into the search bar to extract and download the audio from the video.
![Screenshot](https://github.com/osudirect/yt2mp3/assets/45440100/d7405579-0116-46b8-aab5-f674ecd0e492)

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
  node setup.js
  node index.js
```

edit your nginx config to your liking using a proxy_pass pointing at your set port and restart nginx.

profit.


## Authors

- [@Calemy](https://www.github.com/calemy)

Feel free to join as contributor!
