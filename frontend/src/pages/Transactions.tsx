import { motion } from 'framer-motion'

const Transactions = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
        <p className="text-gray-600 mt-1">Manage your income and expenses</p>
      </div>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction Management</h2>
        <p className="text-gray-600">Transaction features coming soon...</p>
      </div>
    </motion.div>
  )
}

export default Transactions