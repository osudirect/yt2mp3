import "dotenv/config"
import fs from "fs"
import { fastify as f } from "fastify"
import ytdl from "ytdl-core"
import { spawn } from "child_process"
import { MeiliSearch } from "meilisearch"
import cors from "@fastify/cors"

let videoID = 0;
let database;

const fastify = f({ trustProxy: true })
fastify.register(cors);

if (process.env.enableDatabase === "true") {
    database = new MeiliSearch({
        host: process.env.databaseHost,
        apiKey: process.env.databaseKey,
    })
}

fastify.get("/api/:id", async ({ params }, reply) => {
    let info;
    let cached = true;
    let convertStart;
    const start = Date.now()

    if (database) {
        info = await database.index("songs").getDocument(params.id).catch(() => { })
    }

    if (!info) {
        cached = false;
        info = await ytdl.getInfo(params.id).catch(() => { })
    }

    const { videoDetails, formats } = info

    if (!videoDetails) {
        return reply.code(404).send({ error: "Invalid id" })
    }

    if (videoDetails.isLiveContent) {
        return reply.code(400).send({ error: "Live videos are not supported" })
    }

    if (videoDetails.isPrivate) {
        return reply.code(400).send({ error: "We can't access private videos" })
    }

    const length = Number(videoDetails.lengthSeconds)

    if (length > (process.env.maxLength || 600)) {
        return reply.code(400).send({ error: `Audio too long (${length}/${process.env.maxLength || 600} seconds)` })
    }

    const format = ytdl.chooseFormat(formats, { filter: "audioonly", quality: "highestaudio" })

    const thumbnail = videoDetails.thumbnails[videoDetails.thumbnails.length - 1];

    if (database && !cached) {
        await database.index("songs").addDocuments([{
            id: params.id,
            videoDetails: {
                title: videoDetails.title,
                lengthSeconds: videoDetails.lengthSeconds,
                viewCount: videoDetails.viewCount,
                ownerChannelName: videoDetails.ownerChannelName,
                keywords: videoDetails.keywords,
                thumbnails: [thumbnail]
            },
            formats: [format],
            added: Date.now()
        }])
    }

    reply.header("Access-Control-Expose-Headers", "Title, Thumbnail");
    reply.header("Title", encodeURI(videoDetails.title));
    reply.header("Thumbnail", thumbnail.url);
    reply.header("Content-Disposition", `attachment; filename="${encodeURI(videoDetails.title)}.mp3"`)
    reply.header("Content-Length", (128000 / 8) * (format.approxDurationMs / 1000).toString())

    if (process.env.localStorage) {
        if (await fs.promises.stat(`./.data/${params.id}`).catch(() => undefined)) {
            console.log(`Serving ${videoDetails.title} by ${videoDetails.ownerChannelName} (${Date.now() - start}ms)`)
            return reply.send(fs.createReadStream(`./.data/${params.id}`))
        }
    }

    const vID = videoID++
    const writeStream = process.env.localStorage ? fs.createWriteStream(`./.data/${params.id}`) : undefined;
    const ffmpeg = spawn('ffmpeg', ['-i', 'pipe:', '-vn', '-b:a', `128k`, '-f', 'mp3', '-'])

    ffmpeg.on("spawn", () => {
        convertStart = Date.now()
        console.log(`Started converting ${videoDetails.title} by ${videoDetails.ownerChannelName} - ${vID}`)
        reply.send(ffmpeg.stdout)

        const download = ytdl(params.id, { format })

        download.pipe(ffmpeg.stdin).on("error", async () => {
            console.log(`Aborted converting ${videoDetails.title} - ${vID}`)
            if (writeStream) {
                writeStream.close()
                await fs.promises.unlink(`./.data/${params.id}`)
            }
        })

        if (writeStream) {
            ffmpeg.stdout.pipe(writeStream)
        }
    })

    ffmpeg.on("exit", async (code) => {
        if (code != 0) {
            return;
        }
        console.log(`Finished converting ${videoDetails.title} by ${videoDetails.ownerChannelName} - ${vID} (${((Date.now() - convertStart) / 1000).toFixed(2)}s)`)
    })


    return reply;
})


fastify.get("/api/search", async ({ query }, reply) => {
    const search = await database.index("songs").search(query.q, {
        limit: query.limit,
        offset: query.offset
    });
    return search.hits;
})

fastify.listen({ host: "0.0.0.0", port: process.env.port || 2461 })
console.log(`Server running on port ${process.env.port || 2461}`)
