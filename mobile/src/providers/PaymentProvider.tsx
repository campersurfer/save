import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { Platform, Alert } from 'react-native';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import { useAuth } from './AuthProvider';

// RevenueCat API Keys - Replace with your actual keys from RevenueCat dashboard
// Get these from: https://app.revenuecat.com/
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_REVENUECAT_IOS_API_KEY';
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_REVENUECAT_ANDROID_API_KEY';

// Entitlement ID - This should match what you set up in RevenueCat
const PREMIUM_ENTITLEMENT_ID = 'premium';

// Types
export interface PaymentContextType {
  isLoading: boolean;
  isPremium: boolean;
  offerings: PurchasesOffering | null;
  customerInfo: CustomerInfo | null;
  
  // Actions
  loadOfferings: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkPremiumStatus: () => Promise<boolean>;
}

const PaymentContext = createContext<PaymentContextType>({
  isLoading: true,
  isPremium: false,
  offerings: null,
  customerInfo: null,
  loadOfferings: async () => {},
  purchasePackage: async () => false,
  restorePurchases: async () => false,
  checkPremiumStatus: async () => false,
});

interface PaymentProviderProps {
  children: React.ReactNode;
}

export const PaymentProvider: React.FC<PaymentProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  // Initialize RevenueCat
  useEffect(() => {
    initializeRevenueCat();
  }, []);

  // Update user ID when auth changes
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      identifyUser(user.id);
    }
  }, [isAuthenticated, user?.id]);

  const initializeRevenueCat = async () => {
    try {
      // Set log level for debugging (remove in production)
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      // Configure RevenueCat with the appropriate API key
      const apiKey = Platform.OS === 'ios' 
        ? REVENUECAT_API_KEY_IOS 
        : REVENUECAT_API_KEY_ANDROID;

      await Purchases.configure({ apiKey });

      // Listen for customer info updates
      Purchases.addCustomerInfoUpdateListener((info) => {
        setCustomerInfo(info);
        checkEntitlements(info);
      });

      // Get initial customer info
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      checkEntitlements(info);

      // Load offerings
      await loadOfferings();
    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const identifyUser = async (userId: string) => {
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      setCustomerInfo(customerInfo);
      checkEntitlements(customerInfo);
    } catch (error) {
      console.error('Error identifying user:', error);
    }
  };

  const checkEntitlements = (info: CustomerInfo) => {
    // Check if user has premium entitlement
    const hasPremium = typeof info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== 'undefined';
    setIsPremium(hasPremium);
  };

  const loadOfferings = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setOfferings(offerings.current);
      }
    } catch (error) {
      console.error('Error loading offerings:', error);
    }
  }, []);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      setIsLoading(true);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      
      // Check if purchase was successful
      const hasPremium = typeof customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== 'undefined';
      
      if (hasPremium) {
        setIsPremium(true);
        setCustomerInfo(customerInfo);
        Alert.alert(
          'Purchase Successful!',
          'Thank you for upgrading to Nook Premium! Enjoy unlimited features.',
          [{ text: 'OK' }]
        );
        return true;
      }
      
      return false;
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error('Error purchasing package:', error);
        Alert.alert(
          'Purchase Failed',
          error.message || 'Unable to complete purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const customerInfo = await Purchases.restorePurchases();
      
      const hasPremium = typeof customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== 'undefined';
      
      if (hasPremium) {
        setIsPremium(true);
        setCustomerInfo(customerInfo);
        Alert.alert(
          'Purchases Restored',
          'Your premium subscription has been restored!',
          [{ text: 'OK' }]
        );
        return true;
      } else {
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any previous purchases to restore.',
          [{ text: 'OK' }]
        );
        return false;
      }
    } catch (error: any) {
      console.error('Error restoring purchases:', error);
      Alert.alert(
        'Restore Failed',
        error.message || 'Unable to restore purchases. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkPremiumStatus = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.getCustomerInfo();
      const hasPremium = typeof info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== 'undefined';
      setIsPremium(hasPremium);
      return hasPremium;
    } catch (error) {
      console.error('Error checking premium status:', error);
      return false;
    }
  }, []);

  const contextValue: PaymentContextType = {
    isLoading,
    isPremium,
    offerings,
    customerInfo,
    loadOfferings,
    purchasePackage,
    restorePurchases,
    checkPremiumStatus,
  };

  return (
    <PaymentContext.Provider value={contextValue}>
      {children}
    </PaymentContext.Provider>
  );
};

export const usePayment = () => useContext(PaymentContext);
export { PaymentContext };
