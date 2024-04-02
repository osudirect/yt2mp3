import "dotenv/config"
import fs from "fs"
import { fastify as f } from "fastify"
import ytdl from "ytdl-core"
import { spawn } from "child_process"

const fastify = f({ trustProxy: true })
if(!fs.existsSync("temp")) fs.mkdirSync("temp")
fastify.get("/:id", async ({ params }, reply) => {
    const { videoDetails } = await ytdl.getBasicInfo(params.id).catch(undefined)
    if(!videoDetails) return reply.code(404).send({ error: "Invalid id" })
    ytdl(params.id, {
        quality: "highestaudio",
        filter: "audioonly"
    }).pipe(fs.createWriteStream(`temp/${videoDetails.title}`)).on("finish", () => {
        console.log(`Finished downloading ${videoDetails.title}`)
        const ffmpeg = spawn("ffmpeg", ["-i", `temp/${videoDetails.title}`, "-vn", `temp/${videoDetails.title}.mp3`])
        ffmpeg.on("close", () => {
            console.log(`Finished converting ${videoDetails.title}`)
            fs.rmSync(`temp/${videoDetails.title}`, { recursive: true, force: true })
            const buffer = fs.statSync(`temp/${videoDetails.title}.mp3`).size
            reply.header('Content-Length', buffer);
            reply.header("Content-Disposition", `attachment; filename="${encodeURI(videoDetails.title)}"`)
            const stream = fs.createReadStream(`temp/${videoDetails.title}.mp3`)
            stream.on("end", () => {
                fs.rmSync(`temp/${videoDetails.title}.mp3`, { recursive: true, force: true })
            })
            reply.send(stream)
        })
    }).on("error", () => {
        reply.code(500).send({ error: "Something went wrong while downloading" })
    })
    return reply;
})

fastify.listen({ host: "0.0.0.0", port: process.env.port })
console.log(`Server running on port ${process.env.port}`)