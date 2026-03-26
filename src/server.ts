import dotenv from 'dotenv'
dotenv.config()
import express, { Request, Response } from "express";
import cors from 'cors'
import morgan from 'morgan'

import { connectDB } from './database'

import routes from './routes'

const server = express();
const PORT = process.env.PORT || 9000;

server.use(express.json());
server.use(morgan('dev'))

server.use(cors())
//handle preflight
server.options("/*", cors())


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
