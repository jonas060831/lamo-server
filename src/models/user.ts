import { Schema, model } from 'mongoose'

type ProfileType = {
  avatarImg: string
  firstName: string
  lastName: string
}

export interface IUser {
  username: string
  hashedPassword: string
  profile?: ProfileType
}


const ProfileSchema = new Schema<ProfileType>({
 avatarImg: { type: String, required: true, default: 'https://i.imgur.com/A4gxW8v_d.webp?maxwidth=760&fidelity=grand' },
 firstName: { type: String, required: false },
 lastName: { type: String, required: false }
})
const userSchema = new Schema<IUser>({
  username: { type: String, required: true },
  hashedPassword: { type: String, required: true },
  profile: {type: ProfileSchema, default: {} }
})

userSchema.set('toJSON', {
  transform: (_, returnedObject: Partial<IUser>) => {
    delete returnedObject.hashedPassword
  }
})

const User = model('User', userSchema)

export default User
