import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';

export const Toast: React.FC = () => {
  const { toastMessage, toastVariant } = useApp();

  if (!toastMessage) return null;

  const getBgColor = () => {
    switch (toastVariant) {
      case 'success':
        return '#198754';
      case 'danger':
        return '#dc3545';
      case 'warning':
        return '#ffc107';
      case 'info':
        return '#0dcaf0';
      default:
        return '#212529';
    }
  };

  const getTextColor = () => {
    return toastVariant === 'warning' || toastVariant === 'info' ? '#000000' : '#ffffff';
  };

  return (
    <View style={[styles.container, { backgroundColor: getBgColor() }]}>
      <Text style={[styles.text, { color: getTextColor() }]}>{toastMessage}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: '88%',
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
