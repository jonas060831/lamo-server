import dotenv from 'dotenv'
dotenv.config()
import express, { Request, Response } from "express";
import cors from 'cors'
import morgan from 'morgan'

import { connectDB } from './database'

import routes from './routes'

const server = express();
const PORT = process.env.PORT || 9000;

server.use(express.json({ limit: "50mb" }));
server.use(express.urlencoded({ extended: true }))
server.use(morgan('dev'))

server.use(cors({
    origin: [
        process.env.FRONTEND_URL_DEV!,
        process.env.FRONTEND_URL_MASTER!
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}))




if(process.env.NODE_ENV === 'development') {
    server.use('/api', routes)
}

server.use(routes)

//connect to db and run server
const startServer = async() => {
    await connectDB()

    server.listen(PORT, () => {
        console.log(`Server Listening on PORT: ${PORT}`)
    })
}

startServer()
