import express from "express"
import "dotenv/config"
import { appRouter } from "./routes";

const app = express();

app.use(express.json())

const PORT = process.env.PORT

app.use("/api/v1", appRouter)

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
} )