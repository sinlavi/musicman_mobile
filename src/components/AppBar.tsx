import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { DL } from '../services/downloadManager';

interface AppBarProps {
  onOpenSettings: () => void;
}

export const AppBar: React.FC<AppBarProps> = ({ onOpenSettings }) => {
  const { route, goBack, navigate } = useApp();
  const [activeDlCount, setActiveDlCount] = useState<number>(0);

  useEffect(() => {
    const updateCount = () => {
      const active = DL.active().length + DL.ready().length;
      setActiveDlCount(active);
    };
    updateCount();
    const unsub = DL.onChange(updateCount);
    return () => unsub();
  }, []);

  const getTitle = () => {
    switch (route.name) {
      case 'search':
        return 'Search';
      case 'library':
        return 'Library';
      case 'artist':
        return 'Artist';
      case 'album':
        return 'Album';
      case 'track':
        return 'Track';
      default:
        return 'MusicMan';
    }
  };

  const isHome = route.name === 'home';

  return (
    <View style={styles.header}>
      {isHome ? (
        <View style={styles.brandContainer}>
          <MaterialIcons name="graphic-eq" size={24} color="#7b2ff7" />
          <Text style={styles.brandText}>MusicMan</Text>
        </View>
      ) : (
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={28} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.pageTitle} numberOfLines={1}>
            {getTitle()}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        {activeDlCount > 0 ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigate({ name: 'library', subtab: 'downloads' })}
            activeOpacity={0.7}
          >
            <MaterialIcons name="cloud-download" size={22} color="#0dcaf0" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeDlCount}</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.actionBtn} onPress={onOpenSettings} activeOpacity={0.7}>
          <MaterialIcons name="settings" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#0b0b0d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  pageTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#7b2ff7',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});
