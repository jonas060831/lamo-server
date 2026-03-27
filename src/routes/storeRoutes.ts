import { Router } from 'express'
import controllers from '../controllers'

const router = Router()

router.get('/', controllers.store.isPartner)


export default router