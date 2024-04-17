import "dotenv/config"
import fs from "fs"
import { fastify as f } from "fastify"
import ytdl from "ytdl-core"
import { spawn } from "child_process"
let videoID = 0;

const fastify = f({ trustProxy: true })
if(!fs.existsSync("temp")) fs.mkdirSync("temp")
fastify.get("/:id", async ({ params }, reply) => {
    const { videoDetails, formats } = await ytdl.getInfo(params.id).catch(undefined)
    if(!videoDetails) return reply.code(404).send({ error: "Invalid id" })
    const length = videoDetails.lengthSeconds >> 0
    if(length > (process.env.maxLength || 600)) return reply.code(400).send({ error: `Audio too long (${length}/${process.env.maxLength || 600} seconds)`})

    const format = ytdl.chooseFormat(formats, {
        filter: "audioonly",
        quality: "highestaudio"
    })

    const vID = videoID++
    const ffmpeg = spawn('ffmpeg', ['-i', 'pipe:', '-vn', '-b:a', `128k`, '-f', 'mp3', '-'])
    ffmpeg.on("exit", (code) => {
        if(code != 0) return;
        console.log(`Finished converting ${videoDetails.title} - ${vID}`)
    })
    ffmpeg.on("spawn", () => {
        console.log(`Started converting ${videoDetails.title} - ${vID}`)
        reply.header("Content-Disposition", `attachment; filename="${encodeURI(videoDetails.title)}.mp3"`)
        reply.header("Content-Length", (128000 / 8) * (format.approxDurationMs / 1000).toString())
        reply.send(ffmpeg.stdout)
        ytdl(params.id, { format }).pipe(ffmpeg.stdin).on("error", () => console.log(`Aborted converting ${videoDetails.title} - ${vID}`))
    })

    return reply;
})

fastify.listen({ host: "0.0.0.0", port: process.env.port || 2461 })
console.log(`Server running on port ${process.env.port || 2461}`)