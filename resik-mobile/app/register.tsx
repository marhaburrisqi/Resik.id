import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  } from 'react-native';
import { useAuthContext } from '@/hooks/auth-context';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'warga' | 'bank_sampah' | 'umkm'>('warga');
  const [triedSubmit, setTriedSubmit] = useState(false);
  const { signUp, loading, error, clearError } = useAuthContext();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const nameEmpty = triedSubmit && !fullName;
  const emailEmpty = triedSubmit && !email;
  const emailInvalid = triedSubmit && email.length > 0 && !emailRegex.test(email);
  const passEmpty = triedSubmit && !password;
  const confirmEmpty = triedSubmit && !confirmPassword;
  const passMismatch = triedSubmit && password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) clearError();
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (error) clearError();
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (error) clearError();
  };

  const handleFullNameChange = (text: string) => {
    setFullName(text);
    if (error) clearError();
  };

  const handleRegister = async () => {
    setTriedSubmit(true);
    if (!email || !password || !confirmPassword || !fullName) return;
    if (password !== confirmPassword) return;
    if (!emailRegex.test(email)) return;

    try {
      await signUp(email, password, fullName, role);
      router.replace('/(tabs)');
     } catch {
      // Error is handled in the hook
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>DAFTAR RESIK</Text>
            <Text style={styles.subtitle}>Buat akun baru</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nama Lengkap</Text>
              <TextInput
                style={[styles.input, nameEmpty && styles.inputError]}
                placeholder="Nama lengkap"
                value={fullName}
                onChangeText={handleFullNameChange}
                autoCapitalize="words"
              />
              {nameEmpty && <Text style={styles.fieldError}>Nama lengkap wajib diisi</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, (emailEmpty || emailInvalid) && styles.inputError]}
                placeholder="nama@email.com"
                value={email}
                onChangeText={handleEmailChange}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              {emailEmpty && <Text style={styles.fieldError}>Email wajib diisi</Text>}
              {emailInvalid && <Text style={styles.fieldError}>Format email tidak valid</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.input, passEmpty && styles.inputError]}
                placeholder="••••••••"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry
                autoComplete="password"
              />
              {passEmpty && <Text style={styles.fieldError}>Password wajib diisi</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Konfirmasi Password</Text>
              <TextInput
                style={[styles.input, (confirmEmpty || passMismatch) && styles.inputError]}
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry
                autoComplete="password"
              />
              {confirmEmpty && <Text style={styles.fieldError}>Konfirmasi password wajib diisi</Text>}
              {passMismatch && <Text style={styles.fieldError}>Password tidak cocok</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Daftar sebagai</Text>
              <View style={styles.roleContainer}>
                {(['warga', 'bank_sampah', 'umkm'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleOption,
                      role === r && styles.roleSelected,
                    ]}
                    onPress={() => setRole(r)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.roleText, role === r && styles.roleTextSelected]}>
                      {r === 'warga' ? 'Warga' : r === 'bank_sampah' ? 'Bank Sampah' : 'UMKM'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.registerButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.registerButtonText}>DAFTAR</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Sudah punya akun?</Text>
              <TouchableOpacity onPress={() => router.replace('/login')} activeOpacity={0.7}>
                <Text style={styles.loginLink}>Masuk Sekarang</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#2E7D32',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    fontWeight: '500',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    height: 64,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  inputError: {
    borderColor: '#D32F2F',
    backgroundColor: '#FFF8F8',
  },
  fieldError: {
    color: '#D32F2F',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 4,
  },
  passwordMismatch: {
    color: '#D32F2F',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 4,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  roleSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  roleTextSelected: {
    color: '#2E7D32',
  },
  registerButton: {
    backgroundColor: '#2E7D32',
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    elevation: 4,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  footerText: {
    color: '#666',
    fontSize: 15,
  },
  loginLink: {
    color: '#2E7D32',
    fontSize: 15,
    fontWeight: '800',
  },
});
