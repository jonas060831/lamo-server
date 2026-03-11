import { Schema, model } from 'mongoose'


interface IUser {
  username: string
  hashedPassword: string
}
const userSchema = new Schema<IUser>({
  username: { type: String, required: true },
  hashedPassword: { type: String, required: true }
})

userSchema.set('toJSON', {
  transform: (_, returnedObject: Partial<IUser>) => {
    delete returnedObject.hashedPassword
  }
})

const User = model('User', userSchema)

export default User
