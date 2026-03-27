import { Schema, model } from 'mongoose'

export const COMPANIES = [
    'costco',
    'sams club',
    'the home depot',
    'abt',
    'target',
    'apple'
    ] as const

export type Company = typeof COMPANIES[number]


interface IStore {
    name: string
    storeNumber: string
    company: Company
}

const storeSchema = new Schema<IStore>({
  name: { type: String, required: true },
  storeNumber: { type: String, required: true },
  company: { type: String, enum: COMPANIES, required: true }
  },
  { timestamps: true }
)

const Store = model('Store', storeSchema)

export default Store