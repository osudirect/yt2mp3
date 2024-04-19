import "dotenv/config"
import fs from "fs"
import { fastify as f } from "fastify"
import ytdl from "ytdl-core"
import { spawn } from "child_process"
import { MeiliSearch } from "meilisearch"

let videoID = 0;
let database;

const fastify = f({ trustProxy: true })
if(!await fs.promises.stat(".data").catch(() => {})) await fs.promises.mkdir(".data")

if(process.env.enableDatabase){
    database = new MeiliSearch({
        host: process.env.databaseHost,
        apiKey: process.env.databaseKey,
    })
    await database.createIndex("songs").catch(() => {})
}
fastify.get("/:id", async ({ params }, reply) => {
    let info;
    let cached = true;
    let convertStart;
    const start = Date.now()

    if(database){
        info = await database.index("songs").getDocument(params.id).catch(() => {}) 
    }

    if(!info){
        cached = false;
        info = await ytdl.getInfo(params.id).catch(() => {})
    }

    const { videoDetails, formats } = info

    if(!videoDetails){
        return reply.code(404).send({ error: "Invalid id" })
    }

    if(videoDetails.isLiveContent){
        return reply.code(400).send({ error: "Live videos are not supported" })
    }

    if(videoDetails.isPrivate){
        return reply.code(400).send({ error: "We can't access private videos" })
    }

    const length = Number(videoDetails.lengthSeconds)

    if(length > (process.env.maxLength || 600)){
        return reply.code(400).send({ error: `Audio too long (${length}/${process.env.maxLength || 600} seconds)`})
    }

    const format = ytdl.chooseFormat(formats, { filter: "audioonly", quality: "highestaudio" })

    if(database && !cached){
        await database.index("songs").addDocuments([{
            id: params.id,
            videoDetails: {
                title: videoDetails.title,
                lengthSeconds: videoDetails.lengthSeconds,
                viewCount: videoDetails.viewCount,
                ownerChannelName: videoDetails.ownerChannelName,
                keywords: videoDetails.keywords
            },
            formats: [format]
        }])
    }

    reply.header("Content-Disposition", `attachment; filename="${encodeURI(videoDetails.title)}.mp3"`)
    reply.header("Content-Length", (128000 / 8) * (format.approxDurationMs / 1000).toString())

    if(process.env.localStorage){
        if(await fs.promises.stat(`./.data/${params.id}`).catch(() => undefined)){
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
            if(writeStream){
                writeStream.close()
                await fs.promises.unlink(`./.data/${params.id}`)
            }
        })

        if(writeStream){
            ffmpeg.stdout.pipe(writeStream)
        }
    })

    ffmpeg.on("exit", async (code) => {
        if(code != 0){
            return;
        }
        console.log(`Finished converting ${videoDetails.title} by ${videoDetails.ownerChannelName} - ${vID} (${((Date.now() - convertStart) / 1000).toFixed(2)}s)`)
    })


    return reply;
})

fastify.listen({ host: "0.0.0.0", port: process.env.port || 2461 })
console.log(`Server running on port ${process.env.port || 2461}`)