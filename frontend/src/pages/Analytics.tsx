import { motion } from 'framer-motion'

const Analytics = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Insights into your financial patterns</p>
      </div>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Analytics</h2>
        <p className="text-gray-600">Analytics dashboard coming soon...</p>
      </div>
    </motion.div>
  )
}

export default Analytics