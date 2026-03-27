import { Schema, model } from 'mongoose'
import { COMPANIES, Company } from './store';




export interface ParsedItem {
  number: string;
  name: string;
  price: number;
  quantity: number;
}




export interface ParsedReceipt {
  owner: Schema.Types.ObjectId
  company: Company
  storeNumber: string
  rawText: string
  subtotal?: number
  tax?: number
  total?: number
  items: ParsedItem[]
  date?: string
  totalItemsSold?: number
  preview?: string
}

const ParsedItemSchema = new Schema({
    number: {  type: String },
    name: { type: String },
    price: { type: Number },
    quantity: { type: Number }
})


const receiptSchema = new Schema<ParsedReceipt>({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  company: { 
    type: String,
    enum: COMPANIES,
    required: true
  },
  storeNumber: { type: String, required: true },
  rawText: { type: String, required: true },
  subtotal: { type: Number, required: false},
  tax: { type: Number, required: false},
  total: { type: Number, required: false },
  items: { type: [ParsedItemSchema], required: true },
  date: { type: String, required: false },
  totalItemsSold: { type: Number, required: false },
  preview: { type: String, required: false }
  },
  { timestamps: true }
)


const Receipt = model('Receipt', receiptSchema)

export default Receipt
