import { Router } from 'express'

import exampleRoutes from './exampleRoutes'

const routes = Router()

routes.use('/examples', exampleRoutes)

export default routes
