import { Request, Response } from 'express'
import Store from '../models/store'

const isPartner =  async (req: Request, res: Response) => {

    //will check for company name and store id if we have data available return status 200
    const { company, storeNumber } = req.query

    try {

        if(!company || !storeNumber) return res.status(400).send({ message: 'Company name and Store Number are required.' })
        

        const partnerCompany = await Store.findOne({ company, storeNumber })

        if(!partnerCompany) return res.status(404).send({ message: 'Store not found' })//what is the best status code here

        return res.status(200).json({ message: 'Partner store found' })
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Server Error'
        console.log(error)
        return res.status(400).send({ errorMessage })
    }

}

export default {
  isPartner
}
