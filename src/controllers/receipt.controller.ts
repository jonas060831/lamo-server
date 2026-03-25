/*

/receipts/ GET show all receipt authenticated user
/receipts/ POST add new receipt authenticated user
/receipts/:receiptId GET specific receipt

*/

import { Request, Response } from 'express'
import Receipt from '../models/receipt'

const index = async (req: Request, res: Response) => {

    try {
        const authedUser = req.user

        if(!authedUser) return res.status(401).send({ message: 'Unathorized' })

        const receipts = await Receipt.find({ owner: authedUser._id })

        res.status(200).send(receipts)

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Server Error'
        console.log(errorMessage)
        return res.status(500).send({ message: errorMessage })
    }
}

const addNew = async (req: Request, res: Response) => {
    try {
        
        if(!req.user) return res.status(401).send({ message: 'Unathorized' })


        req.body.owner = req.user._id

        const receipt = await Receipt.create(req.body)

        res.status(201).send(receipt)

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Server Error'
        return res.status(500).send({ errorMessage })
    }
}

export default {
  index,
  addNew
}
