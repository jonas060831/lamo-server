import Store from "../models/store"

const checkIsPartner = async (company: string, storeNumber: string) => {
    if(!company || !storeNumber) throw new Error('Company and Store Number are required')

    const store = await Store.findOne({ company, storeNumber })

    return !!store //returns boolean
}

const addPartner = async (company: string, storeNumber: string) => {
    if(!company || storeNumber) throw new Error('Company and Store Number are required')

    const store = await Store.create({ name: `${company} #${storeNumber}`, company, storeNumber })

    return store
}

export {
    checkIsPartner,
    addPartner
}