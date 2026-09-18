import React from 'react';
import { StyleSheet, View } from 'react-native';

export const Skeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={[styles.sk, { height: 26, width: '45%', marginBottom: 16 }]} />
      <View style={styles.row}>
        <View style={[styles.sk, styles.cardSk]} />
        <View style={[styles.sk, styles.cardSk]} />
        <View style={[styles.sk, styles.cardSk]} />
      </View>
      <View style={[styles.sk, { height: 18, width: '35%', marginVertical: 16 }]} />
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={styles.listRow}>
          <View style={[styles.sk, styles.artSk]} />
          <View style={styles.textWrap}>
            <View style={[styles.sk, { height: 13, width: '65%', marginBottom: 8 }]} />
            <View style={[styles.sk, { height: 11, width: '40%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  sk: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  cardSk: {
    width: 120,
    height: 120,
    borderRadius: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  artSk: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  textWrap: {
    marginLeft: 12,
    flex: 1,
  },
});
