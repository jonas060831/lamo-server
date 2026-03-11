import { NextFunction, Request, Response } from 'express'
import { ZodError, ZodObject } from 'zod'

const validate = (schema: ZodObject) => (req: Request, res: Response, next: NextFunction) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params
        })

        next()
    } catch (error) {
        
        if(error instanceof ZodError) {
            return res.status(422).json({
                message: 'Validation failed',
                errors: error.flatten()
            })
        }
        next(error)
    }
}

export default validate