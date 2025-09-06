import { motion } from 'framer-motion'

const Settings = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and preferences</p>
      </div>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h2>
        <p className="text-gray-600">Settings management coming soon...</p>
      </div>
    </motion.div>
  )
}

export default Settings