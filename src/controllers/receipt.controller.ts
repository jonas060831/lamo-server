/*

/receipts/ GET show all receipt authenticated user
/receipts/ POST add new receipt authenticated user
/receipts/:receiptId GET specific receipt

*/

import { Request, Response } from 'express'
import Receipt, { ParsedReceipt } from '../models/receipt'
import costcoReceiptParser from '../utils/parser/costcoReceiptParse'
import { checkIsPartner, addPartner } from '../services/costcoService'
import costcoStringDateFormat from '../utils/costcoStringDateFormat'
import { COMPANIES } from '../models/store'
import Item from '../models/item'

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
        
        const lines = extractedText
        .split("\n")
        .map((line:string) => line.trim())
        .filter(Boolean);

        const company = lines[0].toLowerCase();

        if(company !== 'costco') return res.status(400).send({ message: 'This company is not a partner yet' })

        const details = costcoReceiptParser(extractedText, req.body.owner)
        //needs a better approach for this one later 
        details.date = costcoStringDateFormat(new Date())
        details.preview = preview

        //TODO: base on details.company && details.storeNumber check if the store is already a partner

        //if its not create the store info from the receipt using the receipt detail

        const isStoreAPartner = await checkIsPartner(company, details.storeNumber)

        if(!isStoreAPartner) {
            //notify dev for a new user that uses the service?
            console.log(`New store detected: ${company} #${details.storeNumber} adding to store db...`)
            //create the store
            await addPartner(company, details.storeNumber)
        }

    
        //check if scanner get the items
        if(details.items.length === 0 || details.items == undefined) return res.status(400).send({ message: 'No Item found in your receipt' })

        const savedItems = []

        //cross check each parsedItem from the receipt from previous Item records
        for(const item of details.items) {
            let itemDoc = await Item.findOne({
                itemNumber: item.number,
                company,
                storeNumber: details.storeNumber
            })
            //if it does not exist add it 
            if(!itemDoc) {
                itemDoc = await Item.create({
                    itemNumber: item.number,
                    name: item.name,
                    company,
                    storeNumber: details.storeNumber,
                    priceHistory: [{ price: item.price, date: new Date() }]
                })
            } else {
                //we have this item already
                const lastPrice = itemDoc.priceHistory[itemDoc.priceHistory.length - 1]

                //if the item from db is not equivalent from this new receipt record
                if(lastPrice.price !== item.price) {
                    itemDoc.priceHistory.push({ price: item.price, date: new Date() })
                    await itemDoc.save()
                }
            }
            
            //push reference for receipt
            savedItems.push({
                item: itemDoc._id,
                number: item.number,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            })
        }


        details.items = savedItems

        async function saveReceipt() {
            const receipt = await Receipt.create(details)
            await receipt.save()
            return res.send(200).send(receipt)
        }

        //save the receipt
        await saveReceipt()
        
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
