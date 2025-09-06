import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  CreditCard, 
  PiggyBank, 
  Target, 
  BarChart3, 
  Settings 
} from 'lucide-react'

const Navigation = () => {
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/transactions', label: 'Transactions', icon: CreditCard },
    { path: '/budget', label: 'Budget', icon: PiggyBank },
    { path: '/goals', label: 'Goals', icon: Target },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-800">Save App</h1>
            </div>
            
            <div className="hidden md:block">
              <div className="flex items-baseline space-x-4">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }: { isActive: boolean }) =>
                      `nav-link ${isActive ? 'nav-link-active' : ''}`
                    }
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              <button className="btn btn-primary">
                Add Transaction
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation