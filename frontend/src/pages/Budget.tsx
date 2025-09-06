import { motion } from 'framer-motion'

const Budget = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Budget</h1>
        <p className="text-gray-600 mt-1">Plan and track your spending</p>
      </div>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Planning</h2>
        <p className="text-gray-600">Budget features coming soon...</p>
      </div>
    </motion.div>
  )
}

export default Budget