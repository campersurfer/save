import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../providers/AuthProvider';
import { useTheme } from '../providers/ThemeProvider';
import { Colors, Typography, Spacing, Geometry } from '../styles/BauhausDesign';

const { width, height } = Dimensions.get('window');

type AuthStep = 'welcome' | 'email' | 'verify';

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const { signInWithApple, signInWithEmail, verifyEmailCode, isLoading } = useAuth();
  
  const [step, setStep] = useState<AuthStep>('welcome');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Animation
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    checkAppleAvailability();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const checkAppleAvailability = async () => {
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      setIsAppleAvailable(available);
    } catch {
      setIsAppleAvailable(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsSubmitting(true);
    try {
      await signInWithApple();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) return;
    
    setIsSubmitting(true);
    try {
      await signInWithEmail(email.trim());
      setStep('verify');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) return;
    
    setIsSubmitting(true);
    try {
      await verifyEmailCode(email, verificationCode);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderWelcomeStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      {/* Logo and Branding */}
      <View style={styles.brandingContainer}>
        <View style={[styles.logoContainer, { backgroundColor: colors.primary.blue }]}>
          <Ionicons name="book" size={48} color={colors.primary.white} />
        </View>
        <Text style={[styles.appName, { color: colors.text.primary }]}>Nook</Text>
        <Text style={[styles.tagline, { color: colors.text.secondary }]}>
          Your personal reading companion
        </Text>
      </View>

      {/* Features */}
      <View style={styles.featuresContainer}>
        <View style={styles.featureItem}>
          <Ionicons name="bookmark-outline" size={24} color={colors.primary.blue} />
          <Text style={[styles.featureText, { color: colors.text.secondary }]}>
            Save articles from anywhere
          </Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="headset-outline" size={24} color={colors.primary.blue} />
          <Text style={[styles.featureText, { color: colors.text.secondary }]}>
            Listen with text-to-speech
          </Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="grid-outline" size={24} color={colors.primary.blue} />
          <Text style={[styles.featureText, { color: colors.text.secondary }]}>
            Organize your reading visually
          </Text>
        </View>
      </View>

      {/* Sign In Options */}
      <View style={styles.authButtonsContainer}>
        {/* Sign in with Apple - Primary option */}
        {isAppleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={isDark 
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE 
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={12}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        )}

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.text.tertiary }]}>or</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        {/* Email Sign In */}
        <TouchableOpacity
          style={[styles.emailButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setStep('email')}
        >
          <Ionicons name="mail-outline" size={20} color={colors.text.primary} />
          <Text style={[styles.emailButtonText, { color: colors.text.primary }]}>
            Continue with Email
          </Text>
        </TouchableOpacity>
      </View>

      {/* Terms */}
      <Text style={[styles.termsText, { color: colors.text.tertiary }]}>
        By continuing, you agree to our{' '}
        <Text style={{ color: colors.primary.blue }}>Terms of Service</Text>
        {' '}and{' '}
        <Text style={{ color: colors.primary.blue }}>Privacy Policy</Text>
      </Text>
    </Animated.View>
  );

  const renderEmailStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => setStep('welcome')}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>

      <View style={styles.emailStepContent}>
        <Text style={[styles.stepTitle, { color: colors.text.primary }]}>
          Enter your email
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.text.secondary }]}>
          We'll send you a verification code to sign in securely
        </Text>

        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="mail-outline" size={20} color={colors.text.tertiary} />
          <TextInput
            style={[styles.textInput, { color: colors.text.primary }]}
            placeholder="your@email.com"
            placeholderTextColor={colors.text.tertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary.blue },
            (!email.trim() || isSubmitting) && styles.submitButtonDisabled
          ]}
          onPress={handleEmailSubmit}
          disabled={!email.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.primary.white} />
          ) : (
            <>
              <Text style={[styles.submitButtonText, { color: colors.primary.white }]}>
                Send Code
              </Text>
              <Ionicons name="arrow-forward" size={20} color={colors.primary.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderVerifyStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => setStep('email')}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>

      <View style={styles.emailStepContent}>
        <Text style={[styles.stepTitle, { color: colors.text.primary }]}>
          Check your email
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.text.secondary }]}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={{ color: colors.primary.blue }}>{email}</Text>
        </Text>

        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="keypad-outline" size={20} color={colors.text.tertiary} />
          <TextInput
            style={[styles.textInput, styles.codeInput, { color: colors.text.primary }]}
            placeholder="000000"
            placeholderTextColor={colors.text.tertiary}
            value={verificationCode}
            onChangeText={(text) => setVerificationCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary.blue },
            (verificationCode.length !== 6 || isSubmitting) && styles.submitButtonDisabled
          ]}
          onPress={handleVerifyCode}
          disabled={verificationCode.length !== 6 || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.primary.white} />
          ) : (
            <>
              <Text style={[styles.submitButtonText, { color: colors.primary.white }]}>
                Verify & Sign In
              </Text>
              <Ionicons name="checkmark" size={20} color={colors.primary.white} />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.resendButton}
          onPress={() => signInWithEmail(email)}
        >
          <Text style={[styles.resendText, { color: colors.text.tertiary }]}>
            Didn't receive the code?{' '}
            <Text style={{ color: colors.primary.blue }}>Resend</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'welcome' && renderWelcomeStep()}
          {step === 'email' && renderEmailStep()}
          {step === 'verify' && renderVerifyStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  
  // Branding
  brandingContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: Typography.fontSize.body,
    textAlign: 'center',
  },

  // Features
  featuresContainer: {
    marginBottom: Spacing.xxl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  featureText: {
    fontSize: Typography.fontSize.body,
    marginLeft: Spacing.md,
  },

  // Auth Buttons
  authButtonsContainer: {
    marginBottom: Spacing.xl,
  },
  appleButton: {
    width: '100%',
    height: 50,
    marginBottom: Spacing.md,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    fontSize: Typography.fontSize.caption,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
  },
  emailButtonText: {
    fontSize: Typography.fontSize.body,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },

  // Terms
  termsText: {
    fontSize: Typography.fontSize.caption,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Email Step
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: Spacing.sm,
    zIndex: 1,
  },
  emailStepContent: {
    paddingTop: Spacing.xxl,
  },
  stepTitle: {
    fontSize: Typography.fontSize.h2,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    fontSize: Typography.fontSize.body,
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.fontSize.body,
    marginLeft: Spacing.sm,
  },
  codeInput: {
    letterSpacing: 8,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: Typography.fontSize.body,
    fontWeight: '600',
    marginRight: Spacing.sm,
  },
  resendButton: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  resendText: {
    fontSize: Typography.fontSize.caption,
  },
});
