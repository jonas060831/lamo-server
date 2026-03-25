import { Schema, model } from 'mongoose'


interface IReceipt {
 companyName: 'costco' | 'sams club' | 'the home depot' | 'abt' | 'target' | 'apple',
 owner: Schema.Types.ObjectId
}


const receiptSchema = new Schema<IReceipt>({
  companyName: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }

  },
  { timestamps: true }
)


const Receipt = model('Receipt', receiptSchema)

export default Receipt
