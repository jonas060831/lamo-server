import { Router } from 'express'
import controllers from '../controllers'
import validate from '../middlewares/validate'
import userNamePasswordSchema from '../schemas/userNamePassword.schema'

const router = Router()

router.post('/sign-up', validate(userNamePasswordSchema) , controllers.auth.signUp)


export default router
