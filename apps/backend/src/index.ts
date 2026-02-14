import express from "express"
import "dotenv/config"
import { appRouter } from "./routes";
import cookieParser from "cookie-parser"
import { errorHandler } from "./middlewares/errorHandler.middleware";
import cors from "cors";

const app = express();
const ORIGIN = process.env.ORIGIN || "http://localhost:3000";

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
}))

const PORT = process.env.PORT || 3000
app.use("/api/v1", appRouter);

app.use(errorHandler)

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
} )