import { Router } from 'express'
import controllers from '../controllers'
import validate from '../middlewares/validate'
import verifyToken from '../middlewares/verify-token'

const router = Router()

router.get('/', verifyToken, controllers.receipt.index)
router.post('/', verifyToken, controllers.receipt.addNew)
router.post('/compute-price-drop', verifyToken, controllers.receipt.computePriceDrop)


export default router