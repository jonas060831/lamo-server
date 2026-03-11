import { Router } from 'express'

import exampleRoutes from './exampleRoutes'
import authRoutes from './authRoutes'

const routes = Router()

routes.use('/examples', exampleRoutes)
routes.use('/auth', authRoutes)

export default routes
