/*

/receipts/ GET show all receipt authenticated user
/receipts/ POST add new receipt authenticated user
/receipts/:receiptId GET specific receipt

*/

import { Request, Response } from 'express'
import Receipt, { ParsedItem, ParsedReceipt } from '../models/receipt'
import costcoReceiptParser from '../utils/parser/costcoReceiptParse'
import { checkIsPartner, addPartner } from '../services/costcoService'
import costcoStringDateFormat from '../utils/costcoStringDateFormat'
import { COMPANIES } from '../models/store'
import Item, { PriceHistory } from '../models/item'

const index = async (req: Request, res: Response) => {

    try {
        const authedUser = req.user

        if(!authedUser) return res.status(401).send({ message: 'Unauthorized' })

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
        
        if(!req.user) return res.status(401).send({ message: 'Unauthorized' })

        if(!req.body.text || !req.body.preview) return res.status(400).send({ message: 'Missing Request body'})


        req.body.owner = req.user._id

        const extractedText = req.body.text

        const preview = req.body.preview
        
        const lines = extractedText
        .split("\n")
        .map((line:string) => line.trim())
        .filter(Boolean);

        if(!lines.length) return res.status(400).send({ message: 'Invalid receipt data' })

        const company = lines[0].toLowerCase();

        if(company !== 'costco') return res.status(400).send({ message: 'This company is not a partner yet' })

        const details = costcoReceiptParser(extractedText, req.body.owner)

        console.log(details)

        //needs a better approach for this one later cannot scan the whole receipt or the items does not get populated/letters && numbers too small
        details.date = costcoStringDateFormat(new Date())
        details.preview = preview


        const isStoreAPartner = await checkIsPartner(company, details.storeNumber)

        //if its not create the store info from the receipt using the receipt detail
        if(!isStoreAPartner) {
            //notify dev for a new user that uses the service?
            console.log(`New store detected: ${company} #${details.storeNumber} adding to store db...`)
            //create the store
            await addPartner(company, details.storeNumber)
        }


        //check if scanner get the items
        if(!details.items || details.items.length === 0) return res.status(400).send({ message: 'No Item found in your receipt' })

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
                const history = itemDoc.priceHistory

                const lastPrice = history.length > 0 ? history[history.length - 1] : null

                //if the matched item from db is not equivalent from this new receipt
                //record price change either up or down
                if(!lastPrice || lastPrice.price !== item.price) {
                    history.push({ price: item.price, date: new Date() })
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

        const receipt = await Receipt.create(details)
        return res.status(200).send(receipt)
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Server Error'
        console.log(error)
        return res.status(500).send({ errorMessage })
    }
}


const computePriceDrop = async (req: Request, res: Response) => {
  try {
    const { items, company, storeNumber, receiptDate } = req.body;

    if (!items || !company || !storeNumber || !receiptDate) {
      return res.status(400).send({ message: 'Missing required fields' });
    }

    const purchaseDate = new Date(receiptDate);
    const today = new Date()

    // check receipt is within 30 days
    const receiptDiffDays = Math.floor(
      (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    //handled on the front end
    if (receiptDiffDays > 30) {
      return res.status(200).send({ totalBack: -1, qualifiedItems: -1 })
    }

    let totalBack = 0
    let qualifiedItems = 0

    const itemNumbers = items.map((i: any) => i.number)

    const itemDocs = await Item.find({
      company,
      storeNumber,
      itemNumber: { $in: itemNumbers }
    });

    for (const item of items) {
      const itemDoc = itemDocs.find(d => d.itemNumber === item.number)
      if (!itemDoc || !itemDoc.priceHistory.length) continue

      const lastPrice = itemDoc.priceHistory[itemDoc.priceHistory.length - 1]
      const lastPriceDate = new Date(lastPrice.date);

      //ensure price update is recent (within 30 days from today)
      const priceDiffDays = Math.floor(
        (today.getTime() - lastPriceDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      //have to use math.abs considering previous date and future dates
      if (Math.abs(priceDiffDays) > 30) continue;

      // compute refund if price dropped
      if (lastPrice.price < item.price) {
        totalBack += (item.price - lastPrice.price) * item.quantity
        qualifiedItems += 1
      }
    }

    return res.status(200).send({ totalBack, qualifiedItems })

  } catch (error) {
    console.error(error)
    return res.status(500).send({ message: 'Server error' })
  }
}


export default {
  index,
  addNew,
  computePriceDrop
}
