import "dotenv/config"
import fs from "fs/promises"
import { MeiliSearch } from "meilisearch";
let database;
if(process.env.localStorage === "true"){
    if (!await fs.stat(".data").catch(() => { })){
        await fs.mkdir(".data")
    }
}

if (process.env.enableDatabase === "true") {
    database = new MeiliSearch({
        host: process.env.databaseHost,
        apiKey: process.env.databaseKey,
    })
    await database.createIndex("songs").catch(() => { })
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
}
