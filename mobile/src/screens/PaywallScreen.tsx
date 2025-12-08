import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PurchasesPackage } from 'react-native-purchases';
import { usePayment } from '../providers/PaymentProvider';
import { useTheme } from '../providers/ThemeProvider';
import { Typography, Spacing, Colors } from '../styles/BauhausDesign';

const { width } = Dimensions.get('window');

interface PaywallScreenProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const PREMIUM_FEATURES = [
  {
    icon: 'infinite-outline',
    title: 'Unlimited Saves',
    description: 'Save as many articles as you want',
  },
  {
    icon: 'cloud-offline-outline',
    title: 'Offline Reading',
    description: 'Download articles for offline access',
  },
  {
    icon: 'mic-outline',
    title: 'Premium Voices',
    description: 'Access high-quality TTS voices',
  },
  {
    icon: 'color-palette-outline',
    title: 'Custom Themes',
    description: 'Personalize your reading experience',
  },
  {
    icon: 'sync-outline',
    title: 'Cross-Device Sync',
    description: 'Sync your library across all devices',
  },
  {
    icon: 'sparkles-outline',
    title: 'AI Summaries',
    description: 'Get AI-powered article summaries',
  },
];

export default function PaywallScreen({ onClose, onSuccess }: PaywallScreenProps) {
  const { colors, isDark } = useTheme();
  const { offerings, purchasePackage, restorePurchases, isLoading, isPremium, isConfigured } = usePayment();
  
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    // Auto-select the first package (usually monthly)
    if (offerings?.availablePackages && offerings.availablePackages.length > 0) {
      // Try to select annual first, then monthly
      const annualPkg = offerings.availablePackages.find(p => 
        p.packageType === 'ANNUAL' || p.identifier.toLowerCase().includes('annual')
      );
      const monthlyPkg = offerings.availablePackages.find(p => 
        p.packageType === 'MONTHLY' || p.identifier.toLowerCase().includes('monthly')
      );
      setSelectedPackage(annualPkg || monthlyPkg || offerings.availablePackages[0]);
    }
  }, [offerings]);

  // If user is already premium, show success
  useEffect(() => {
    if (isPremium) {
      onSuccess?.();
    }
  }, [isPremium]);

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    
    setIsPurchasing(true);
    const success = await purchasePackage(selectedPackage);
    setIsPurchasing(false);
    
    if (success) {
      onSuccess?.();
      onClose();
    }
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    const success = await restorePurchases();
    setIsPurchasing(false);
    
    if (success) {
      onSuccess?.();
      onClose();
    }
  };

  const formatPrice = (pkg: PurchasesPackage): string => {
    return pkg.product.priceString;
  };

  const formatPeriod = (pkg: PurchasesPackage): string => {
    if (pkg.packageType === 'ANNUAL' || pkg.identifier.toLowerCase().includes('annual')) {
      return '/year';
    }
    if (pkg.packageType === 'MONTHLY' || pkg.identifier.toLowerCase().includes('monthly')) {
      return '/month';
    }
    if (pkg.packageType === 'WEEKLY' || pkg.identifier.toLowerCase().includes('weekly')) {
      return '/week';
    }
    if (pkg.packageType === 'LIFETIME' || pkg.identifier.toLowerCase().includes('lifetime')) {
      return ' one-time';
    }
    return '';
  };

  const getSavingsText = (pkg: PurchasesPackage): string | null => {
    if (pkg.packageType === 'ANNUAL' || pkg.identifier.toLowerCase().includes('annual')) {
      return 'Save 40%';
    }
    return null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary.blue }]}>
            <Ionicons name="diamond" size={40} color={colors.primary.white} />
          </View>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Upgrade to Premium
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Unlock the full power of Nook
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          {PREMIUM_FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary.blue + '20' }]}>
                <Ionicons name={feature.icon as any} size={24} color={colors.primary.blue} />
              </View>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: colors.text.primary }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDescription, { color: colors.text.tertiary }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing Options */}
        {!isConfigured ? (
          <View style={styles.comingSoonContainer}>
            <View style={[styles.comingSoonBadge, { backgroundColor: colors.primary.blue + '20' }]}>
              <Ionicons name="time-outline" size={32} color={colors.primary.blue} />
            </View>
            <Text style={[styles.comingSoonTitle, { color: colors.text.primary }]}>
              Coming Soon
            </Text>
            <Text style={[styles.comingSoonText, { color: colors.text.tertiary }]}>
              Premium subscriptions will be available soon. We're working hard to bring you these amazing features!
            </Text>
          </View>
        ) : isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.blue} />
            <Text style={[styles.loadingText, { color: colors.text.tertiary }]}>
              Loading plans...
            </Text>
          </View>
        ) : offerings?.availablePackages ? (
          <View style={styles.pricingSection}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Choose Your Plan
            </Text>
            
            {offerings.availablePackages.map((pkg) => {
              const isSelected = selectedPackage?.identifier === pkg.identifier;
              const savings = getSavingsText(pkg);
              
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.pricingOption,
                    { 
                      backgroundColor: colors.surface,
                      borderColor: isSelected ? colors.primary.blue : colors.border,
                    },
                    isSelected && styles.pricingOptionSelected,
                  ]}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  {savings && (
                    <View style={[styles.savingsBadge, { backgroundColor: colors.semantic.success }]}>
                      <Text style={styles.savingsText}>{savings}</Text>
                    </View>
                  )}
                  
                  <View style={styles.pricingContent}>
                    <View style={styles.pricingLeft}>
                      <View style={[
                        styles.radioButton,
                        { borderColor: isSelected ? colors.primary.blue : colors.border }
                      ]}>
                        {isSelected && (
                          <View style={[styles.radioButtonInner, { backgroundColor: colors.primary.blue }]} />
                        )}
                      </View>
                      <Text style={[styles.pricingTitle, { color: colors.text.primary }]}>
                        {pkg.product.title.replace(' (Nook)', '').replace(' (Reading Nook)', '')}
                      </Text>
                    </View>
                    <View style={styles.pricingRight}>
                      <Text style={[styles.pricingPrice, { color: colors.text.primary }]}>
                        {formatPrice(pkg)}
                      </Text>
                      <Text style={[styles.pricingPeriod, { color: colors.text.tertiary }]}>
                        {formatPeriod(pkg)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.text.tertiary} />
            <Text style={[styles.errorText, { color: colors.text.tertiary }]}>
              Unable to load pricing. Please try again later.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {isConfigured ? (
          <>
            <TouchableOpacity
              style={[
                styles.purchaseButton,
                { backgroundColor: colors.primary.blue },
                (!selectedPackage || isPurchasing) && styles.purchaseButtonDisabled,
              ]}
              onPress={handlePurchase}
              disabled={!selectedPackage || isPurchasing}
            >
              {isPurchasing ? (
                <ActivityIndicator color={colors.primary.white} />
              ) : (
                <Text style={[styles.purchaseButtonText, { color: colors.primary.white }]}>
                  {selectedPackage 
                    ? `Subscribe for ${formatPrice(selectedPackage)}${formatPeriod(selectedPackage)}`
                    : 'Select a Plan'
                  }
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isPurchasing}
            >
              <Text style={[styles.restoreButtonText, { color: colors.text.tertiary }]}>
                Restore Purchases
              </Text>
            </TouchableOpacity>

            <Text style={[styles.termsText, { color: colors.text.tertiary }]}>
              Cancel anytime. Subscription auto-renews.{'\n'}
              <Text style={{ color: colors.primary.blue }}>Terms</Text> • <Text style={{ color: colors.primary.blue }}>Privacy</Text>
            </Text>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.purchaseButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.purchaseButtonText, { color: colors.text.primary }]}>
              Got it, notify me when available
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  
  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.fontSize.body,
    textAlign: 'center',
  },

  // Features
  featuresSection: {
    marginBottom: Spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: Typography.fontSize.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: Typography.fontSize.caption,
  },

  // Pricing
  pricingSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.h4,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  pricingOption: {
    borderRadius: 12,
    borderWidth: 2,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  pricingOptionSelected: {
    borderWidth: 2,
  },
  savingsBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pricingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pricingTitle: {
    fontSize: Typography.fontSize.body,
    fontWeight: '600',
  },
  pricingRight: {
    alignItems: 'flex-end',
  },
  pricingPrice: {
    fontSize: Typography.fontSize.h4,
    fontWeight: '700',
  },
  pricingPeriod: {
    fontSize: Typography.fontSize.caption,
  },

  // Loading & Error
  loadingContainer: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.body,
  },
  errorContainer: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.body,
    textAlign: 'center',
  },

  // Bottom Actions
  bottomActions: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  purchaseButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  purchaseButtonDisabled: {
    opacity: 0.5,
  },
  purchaseButtonText: {
    fontSize: Typography.fontSize.body,
    fontWeight: '600',
  },
  restoreButton: {
    alignItems: 'center',
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  restoreButtonText: {
    fontSize: Typography.fontSize.caption,
  },
  termsText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  comingSoonContainer: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  comingSoonBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  comingSoonTitle: {
    fontSize: Typography.fontSize.h3,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  comingSoonText: {
    fontSize: Typography.fontSize.body,
    textAlign: 'center',
    lineHeight: 22,
  },
});
