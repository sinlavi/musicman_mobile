import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { cacheAll, cacheClear } from '../services/downloadManager';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const {
    settings,
    updateSetting,
    clearRecentSearches,
    resetAllData,
    showToast,
    refreshCachedIds,
  } = useApp();

  const [cacheSizeText, setCacheSizeText] = useState<string>('—');

  useEffect(() => {
    if (visible) {
      updateCacheInfo();
    }
  }, [visible]);

  const updateCacheInfo = async () => {
    try {
      const all = await cacheAll();
      const total = all.reduce((sum, e) => sum + (e.size || 0), 0);
      const fmtSize = (b: number) => {
        if (b < 1024) return `${b} B`;
        if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
        return `${(b / 1048576).toFixed(1)} MB`;
      };
      setCacheSizeText(all.length ? `${all.length} tracks · ${fmtSize(total)}` : 'Empty');
    } catch {}
  };

  const clearCache = async () => {
    await cacheClear();
    await refreshCachedIds();
    await updateCacheInfo();
    showToast('Offline cache cleared');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Appearance */}
            <Text style={styles.secTitle}>APPEARANCE</Text>
            <View style={styles.row}>
              <MaterialIcons name="invert-colors" size={22} color="#8e8e93" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Theme</Text>
                <Text style={styles.rowSub}>Choose your preferred look</Text>
              </View>
              <View style={styles.themeSeg}>
                <TouchableOpacity
                  style={[styles.segBtn, settings.theme === 'dark' && styles.segBtnOn]}
                  onPress={() => updateSetting('theme', 'dark')}
                >
                  <Text style={[styles.segText, settings.theme === 'dark' && styles.segTextOn]}>
                    Dark
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segBtn, settings.theme === 'light' && styles.segBtnOn]}
                  onPress={() => updateSetting('theme', 'light')}
                >
                  <Text style={[styles.segText, settings.theme === 'light' && styles.segTextOn]}>
                    Light
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Playback */}
            <Text style={styles.secTitle}>PLAYBACK</Text>
            <View style={styles.row}>
              <MaterialIcons name="speed" size={22} color="#8e8e93" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Playback speed</Text>
              </View>
              <View style={styles.rateRow}>
                <TouchableOpacity
                  onPress={() =>
                    updateSetting('playbackRate', Math.max(0.5, settings.playbackRate - 0.25))
                  }
                >
                  <MaterialIcons name="remove" size={20} color="#7b2ff7" />
                </TouchableOpacity>
                <Text style={styles.rateText}>{settings.playbackRate.toFixed(2)}x</Text>
                <TouchableOpacity
                  onPress={() =>
                    updateSetting('playbackRate', Math.min(2.0, settings.playbackRate + 0.25))
                  }
                >
                  <MaterialIcons name="add" size={20} color="#7b2ff7" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              <MaterialIcons name="subtitles" size={22} color="#8e8e93" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Auto-scroll lyrics</Text>
                <Text style={styles.rowSub}>Follow active line automatically</Text>
              </View>
              <Switch
                value={settings.autoScrollLyrics}
                onValueChange={v => updateSetting('autoScrollLyrics', v)}
                trackColor={{ false: '#333', true: '#7b2ff7' }}
              />
            </View>

            <View style={styles.row}>
              <MaterialIcons name="refresh" size={22} color="#8e8e93" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Auto-retry downloads</Text>
                <Text style={styles.rowSub}>Retry automatically on failure</Text>
              </View>
              <Switch
                value={settings.autoRetry}
                onValueChange={v => updateSetting('autoRetry', v)}
                trackColor={{ false: '#333', true: '#7b2ff7' }}
              />
            </View>

            {/* Storage */}
            <Text style={styles.secTitle}>STORAGE</Text>
            <View style={styles.row}>
              <MaterialIcons name="sd-storage" size={22} color="#8e8e93" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Offline cache</Text>
                <Text style={styles.rowSub}>{cacheSizeText}</Text>
              </View>
              <TouchableOpacity style={styles.dangerBtn} onPress={clearCache}>
                <Text style={styles.dangerBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <MaterialIcons name="history" size={22} color="#8e8e93" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Recent searches</Text>
              </View>
              <TouchableOpacity
                style={styles.pillBtn}
                onPress={async () => {
                  await clearRecentSearches();
                  showToast('Search history cleared');
                }}
              >
                <Text style={styles.pillBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <MaterialIcons name="restore" size={22} color="#8e8e93" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Reset app data</Text>
                <Text style={styles.rowSub}>Remove all local settings and data</Text>
              </View>
              <TouchableOpacity style={styles.dangerBtn} onPress={resetAllData}>
                <Text style={styles.dangerBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>

            {/* About */}
            <Text style={styles.secTitle}>ABOUT</Text>
            <View style={styles.row}>
              <MaterialIcons name="info-outline" size={22} color="#8e8e93" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>MusicMan</Text>
                <Text style={styles.rowSub}>Version 3.7 · Native Android</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#18181c',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  secTitle: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
  },
  rowTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
  },
  themeSeg: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 2,
  },
  segBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  segBtnOn: {
    backgroundColor: '#7b2ff7',
  },
  segText: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '700',
  },
  segTextOn: {
    color: '#ffffff',
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  rateText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  dangerBtn: {
    backgroundColor: 'rgba(220, 53, 69, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dangerBtnText: {
    color: '#dc3545',
    fontSize: 12,
    fontWeight: '700',
  },
  pillBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
