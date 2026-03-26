/*

/receipts/ GET show all receipt authenticated user
/receipts/ POST add new receipt authenticated user
/receipts/:receiptId GET specific receipt

*/

import { Request, Response } from 'express'
import Receipt from '../models/receipt'
import costcoReceiptParser from '../utils/parser/costcoReceiptParse'

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

        if(!req.body) return res.status(400).send({ mesage: 'Missing Request body'})


        req.body.owner = req.user._id

        const extractedText = req.body.text

        const preview = req.body.preview
        
        console.log('owner id:', req.body.owner)

        const lines = extractedText
        .split("\n")
        .map((line:string) => line.trim())
        .filter(Boolean);

        const company = lines[0].toLowerCase();

        let details:any
        if(company === 'costco') {
            details = costcoReceiptParser(extractedText, req.body.owner)
        }
        
        console.log(details)

        //TODO: base on details.company make a get request to /api/<company_name>/:storeId
        //if the reponse is 200 proceed in adding the receipt to the database
        //if its not make a post request to /api/<company_name>/:storeId to save item details
        
        // const receipt = await Receipt.create(details)

        res.status(201).send("ok")

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Server Error'
        console.log(error)
        return res.status(500).send({ errorMessage })
    }
}

export default {
  index,
  addNew
}
