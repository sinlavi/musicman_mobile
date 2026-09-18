import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { DL } from '../services/downloadManager';

export const TabBar: React.FC = () => {
  const { route, navigate } = useApp();
  const [badgeCount, setBadgeCount] = useState<number>(0);

  useEffect(() => {
    const updateCount = () => {
      const active = DL.active().length + DL.ready().length;
      setBadgeCount(active);
    };
    updateCount();
    const unsub = DL.onChange(updateCount);
    return () => unsub();
  }, []);

  const activeTab = route.name;

  return (
    <View style={styles.tabbar}>
      <TouchableOpacity
        style={styles.tab}
        onPress={() => navigate({ name: 'home' })}
        activeOpacity={0.7}
      >
        <MaterialIcons
          name="home"
          size={24}
          color={activeTab === 'home' ? '#7b2ff7' : '#8e8e93'}
        />
        <Text style={[styles.label, activeTab === 'home' && styles.activeLabel]}>
          Home
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={() => navigate({ name: 'search' })}
        activeOpacity={0.7}
      >
        <MaterialIcons
          name="search"
          size={24}
          color={activeTab === 'search' ? '#7b2ff7' : '#8e8e93'}
        />
        <Text style={[styles.label, activeTab === 'search' && styles.activeLabel]}>
          Search
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={() => navigate({ name: 'library', subtab: 'likes' })}
        activeOpacity={0.7}
      >
        <View style={styles.iconWrap}>
          <MaterialIcons
            name="library-music"
            size={24}
            color={activeTab === 'library' ? '#7b2ff7' : '#8e8e93'}
          />
          {badgeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeCount}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, activeTab === 'library' && styles.activeLabel]}>
          Library
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  tabbar: {
    height: 54,
    flexDirection: 'row',
    backgroundColor: '#0b0b0d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  iconWrap: {
    position: 'relative',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8e8e93',
    marginTop: 2,
  },
  activeLabel: {
    color: '#7b2ff7',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -8,
    backgroundColor: '#7b2ff7',
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
});
