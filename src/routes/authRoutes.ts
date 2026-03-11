import { Router } from 'express'
import controllers from '../controllers'

const router = Router()

router.post('/sign-up', controllers.auth.signUp)


export default router
