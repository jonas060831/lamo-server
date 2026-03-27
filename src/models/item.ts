import { Schema, model } from 'mongoose'
import { COMPANIES, Company } from './store'


type PriceHistory = {
    price: Number
    date: Date;
}

interface ItemInterface {
    company: Company
    storeNumber: string
    itemNumber: string
    name: string
    normalized_name?: String
    brand?: string
    aliases?:  string[]
    imagesUrl?: string[]
    priceHistory: PriceHistory[]
}

const itemSchema = new Schema<ItemInterface>({
    company: { type: String, enum: COMPANIES, required: true },
    storeNumber: { type: String, required: true },
    itemNumber: { type: String, required: true },
    name: { type: String, required: true },
    normalized_name: { type: String, required: false },
    brand: { type: String, required: false },
    aliases: { type: [String], required: false },
    imagesUrl: { type: [String], required: false },
    priceHistory: {
        type: [
            {
                price: { type: Number, required: true},
                date: { type: Date, required: true, default: Date.now }
            }
        ]
    }
    },
    { timestamps: true }
)

const Item = model('Item', itemSchema)

export default Item
