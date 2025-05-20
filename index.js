import "dotenv/config"
import { createWriteStream, createReadStream } from "fs"
import { unlink, stat, writeFile, mkdir } from "fs/promises"
import { fastify as f } from "fastify"
import ytdl from "@distube/ytdl-core"
import { spawn } from "child_process"
import cors from "@fastify/cors"
import { MeiliSearch } from "meilisearch"

const database = new MeiliSearch({
    host: process.env.databaseHost,
    apiKey: process.env.databaseKey
})

if(!await stat("./finished").catch(() => undefined)){
    if (!await stat(".data").catch(() => { })){
        await mkdir(".data")
    }

    await database.createIndex("songs").catch()
    await database.index("songs").updateSortableAttributes([
        "added",
        "videoDetails.lengthSeconds"
    ])
    await database.index("songs").updateSearchableAttributes([
        "videoDetails.title",
        "videoDetails.ownerChannelName",
        "id"
    ])
    await database.index("songs").updateFilterableAttributes([
        "videoDetails.lengthSeconds"
    ])
    writeFile("./finished", "1")
}

const fastify = f({ trustProxy: true })
fastify.register(cors);

fastify.get("/api/:id", async ({ params }, reply) => {
    let cached = true;
    let convertStart;
    const start = Date.now()

    let info = await database.index("songs").getDocument(params.id).catch(() => { })
    if(!info){
        info = await ytdl.getInfo(params.id).catch(() => { })
        if(!info) return reply.code(404).send({ error: "Invalid id" })
        cached = false;
    }

    const { videoDetails, formats } = info

    if (videoDetails.isLiveContent) return reply.code(400).send({ error: "Live videos are not supported" })
    if (videoDetails.isPrivate) return reply.code(400).send({ error: "We can't access private videos" })

    const length = Number(videoDetails.lengthSeconds)

    if (length > (process.env.maxLength || 600)) return reply.code(400).send({ error: `Audio too long (${length}/${process.env.maxLength || 600} seconds)` })

    const format = ytdl.chooseFormat(formats, { filter: "audioonly", quality: "highestaudio" })
    const thumbnail = videoDetails.thumbnails[videoDetails.thumbnails.length - 1];

    if (!cached) {
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
    reply.header("Content-Length", String((128000 / 8) * (format.approxDurationMs / 1000)))

    if (await stat(`./.data/${params.id}`).catch(() => undefined)) {
        console.log(`Serving ${videoDetails.title} by ${videoDetails.ownerChannelName} (${Date.now() - start}ms)`)
        return reply.send(createReadStream(`./.data/${params.id}`))
    }

    const writeStream = createWriteStream(`./.data/${params.id}`)
    const ffmpeg = spawn('ffmpeg', ['-i', 'pipe:', '-vn', '-b:a', '128k', '-f', 'mp3', '-'])

    ffmpeg.on("spawn", () => {
        convertStart = Date.now()
        console.log(`Started converting ${videoDetails.title} by ${videoDetails.ownerChannelName}`)
        reply.send(ffmpeg.stdout)

        const download = ytdl(params.id, { format })

        download.pipe(ffmpeg.stdin).on("error", async () => {
            console.log(`Aborted converting ${videoDetails.title}`)
            writeStream.close()
            await unlink(`./.data/${params.id}`)
        })

        ffmpeg.stdout.pipe(writeStream)
    })

    ffmpeg.on("exit", async (code) => {
        if (code != 0) return;
        console.log(`Finished converting ${videoDetails.title} by ${videoDetails.ownerChannelName} - (${((Date.now() - convertStart) / 1000).toFixed(2)}s)`)
    })

    return reply;
})

fastify.get("/api/search", async ({ query }) => {
    //TODO: add filter
    const search = await database.index("songs").search(query.q, {
        limit: Number(query.limit) || 100,
        offset: Number(query.offset) || 0,
        sort: [query.sort || "added:desc"]
    });
    return search.hits;
})

fastify.listen({ host: "0.0.0.0", port: process.env.port || 2461 })
console.log(`Server running on port ${process.env.port || 2461}`)