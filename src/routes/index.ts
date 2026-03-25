import { Router } from 'express'

import exampleRoutes from './exampleRoutes'
import authRoutes from './authRoutes'
import receiptRoutes from './receiptRoutes'

const routes = Router()

routes.use('/examples', exampleRoutes)
routes.use('/auth', authRoutes)
routes.use('/receipts', receiptRoutes)

export default routes
