import { z } from 'zod'

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@$*])[A-Za-z\d!@$*]{8,}$/

const userNamePasswordSchema = z.object({

  body: z.object({
    username: z.string().email(),
    password: z
        .string()
        .min(8)
        .regex(
        passwordRegex,
        'Password must be at least 8 characters and include uppercase, lowercase, number, and any one from ! @ $ *'
        )
  })
})

export default userNamePasswordSchema