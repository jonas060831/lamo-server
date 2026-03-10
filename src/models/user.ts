import { Schema, model } from 'mongoose'

const userSchema = new Schema({
  username: { type: String, required: true },
  hashedPassword: { type: String, required: true }
})

userSchema.set('toJSON', {
  transform: (_, returnedObject) => {
    delete returnedObject.hashedPassword
  }
})

const User = model('User', userSchema)

module.exports = User
