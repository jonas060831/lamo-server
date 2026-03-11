import { Router } from 'express'
import controllers from '../controllers'
import validate from '../middlewares/validate'
import userNamePasswordSchema from '../schemas/userNamePassword.schema'
import verifyToken from '../middlewares/verify-token'

const router = Router()

router.post('/sign-up', validate(userNamePasswordSchema) , controllers.auth.signUp)
router.get('/my-profile', verifyToken, controllers.auth.myProfile)


export default router
