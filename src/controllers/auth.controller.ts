import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import User from '../models/user'

const saltRounds = parseInt(process.env.SALT_ROUNDS!);


const signUp = async (req: Request, res: Response) => {
  try {

    const { username, password }  = req.body

    const userInDatabase = await User.findOne({ username: username })

    if(userInDatabase) return res.status(409).json({ error: 'Username already taken.' })

    const user = await User.create({
      username: username,
      hashedPassword: bcrypt.hashSync(password, saltRounds)
    })


    const payload = { username: user.username, _id: user._id }

    const token = jwt.sign({ payload }, process.env.JWT_SECRET!)

    res.status(201).json({ user, token })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Server Error'

    res.status(500).json({ error: errorMessage })
  }
}

export default {
  signUp
}
