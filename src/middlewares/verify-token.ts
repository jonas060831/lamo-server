import { NextFunction, Request, Response } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { IUser } from '../models/user'



const verifyToken = (req: Request, res: Response, next: NextFunction) => {

    try {
        
        const auth = req.headers.authorization

        if(!auth) {
            return res.status(401).json({ error: 'Must Provide token' })
        }
        const token = auth.split(' ')[1]

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload

        //assign decoded payload to req.user
        req.user = decoded.payload

        //Call next() to invoke the next middleware function
        next()
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' })
    }
}

export default verifyToken