import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { Platform, Alert } from 'react-native';
import { useAuth } from './AuthProvider';

// Try to import RevenueCat - it may not be available in Expo Go
let Purchases: any = null;
let LOG_LEVEL: any = null;
try {
  const RC = require('react-native-purchases');
  Purchases = RC.default;
  LOG_LEVEL = RC.LOG_LEVEL;
} catch (e) {
  console.log('RevenueCat not available - running in Expo Go or native module not linked');
}

// Type imports for TypeScript
import type {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
} from 'react-native-purchases';

// RevenueCat API Keys - Replace with your actual keys from RevenueCat dashboard
// Get these from: https://app.revenuecat.com/
// IMPORTANT: Leave as placeholder until you set up RevenueCat
const REVENUECAT_API_KEY_IOS = ''; // Set your key: 'appl_xxxxx'
const REVENUECAT_API_KEY_ANDROID = ''; // Set your key: 'goog_xxxxx'

// Entitlement ID - This should match what you set up in RevenueCat
const PREMIUM_ENTITLEMENT_ID = 'premium';

// Check if RevenueCat is properly configured
const isRevenueCatConfigured = () => {
  return Purchases && REVENUECAT_API_KEY_IOS.length > 0;
};

// Types
export interface PaymentContextType {
  isLoading: boolean;
  isPremium: boolean;
  isConfigured: boolean;
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
  isConfigured: false,
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
    // Skip initialization if RevenueCat is not configured
    if (!isRevenueCatConfigured()) {
      console.log('RevenueCat not configured - skipping initialization');
      console.log('To enable payments, add your RevenueCat API key to PaymentProvider.tsx');
      setIsLoading(false);
      return;
    }

    try {
      // Set log level for debugging (remove in production)
      if (LOG_LEVEL) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      // Configure RevenueCat with the appropriate API key
      const apiKey = Platform.OS === 'ios' 
        ? REVENUECAT_API_KEY_IOS 
        : REVENUECAT_API_KEY_ANDROID;

      await Purchases.configure({ apiKey });

      // Listen for customer info updates
      Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
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
    if (!isRevenueCatConfigured()) return;
    
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
    if (!isRevenueCatConfigured()) return;
    
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
    if (!isRevenueCatConfigured()) {
      Alert.alert(
        'Payments Not Configured',
        'In-app purchases are not yet available. This feature requires a development build with RevenueCat configured.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
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
    if (!isRevenueCatConfigured()) {
      Alert.alert(
        'Payments Not Configured',
        'In-app purchases are not yet available. This feature requires a development build with RevenueCat configured.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
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
    if (!isRevenueCatConfigured()) return false;
    
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
    isConfigured: isRevenueCatConfigured(),
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
