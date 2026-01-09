import express from "express"
import "dotenv/config"

const app = express();

app.use(express.json())

const PORT = process.env.PORT

app.get("/", (req, res) => {
    res.send("hello world")
})

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
} )