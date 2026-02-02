import express from "express"
import "dotenv/config"
import { appRouter } from "./routes";
import cookieParser from "cookie-parser"

const app = express();

app.use(express.json())
app.use(cookieParser())

const PORT = process.env.PORT || 3000
app.use("/api/v1", appRouter);


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
} )