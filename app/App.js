import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const DEFAULT_BACKEND =
  Constants.expoConfig?.extra?.backendUrl || 'http://localhost:3000';

export default function App() {
  const [tab, setTab] = useState('events');
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND);
  const [events, setEvents] = useState([]);
  const [clock, setClock] = useState(now());
  const [refreshing, setRefreshing] = useState(false);
  const [pushStatus, setPushStatus] = useState('Chưa bật');

  // Đồng hồ góc phải
  useEffect(() => {
    const t = setInterval(() => setClock(now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl.replace(/\/$/, '')}/events`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (e) {
      // giữ danh sách cũ nếu backend không truy cập được
    }
  }, [backendUrl]);

  useEffect(() => {
    loadEvents();
    const t = setInterval(loadEvents, 15000);
    return () => clearInterval(t);
  }, [loadEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const enablePush = async () => {
    try {
      const token = await registerForPush();
      if (!token) {
        setPushStatus('Thiết bị không hỗ trợ / bị từ chối');
        return;
      }
      await fetch(`${backendUrl.replace(/\/$/, '')}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      setPushStatus('Đã bật ✓');
    } catch (e) {
      setPushStatus('Lỗi: ' + e.message);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>NOW EVENT NOTIFICATION</Text>
          <Text style={styles.subtitle}>
            Trang doantn: {events.length} sự kiện
          </Text>
        </View>
        <Text style={styles.clock}>{clock}</Text>
      </View>

      {tab === 'events' ? (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {events.length === 0 && (
            <Text style={styles.empty}>
              Chưa có dữ liệu. Kiểm tra backend ở tab Cài đặt.
            </Text>
          )}
          {events.map((e, i) => (
            <EventCard key={i} event={e} />
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.settings}>
          <Text style={styles.label}>Địa chỉ backend</Text>
          <TextInput
            style={styles.input}
            value={backendUrl}
            onChangeText={setBackendUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://192.168.x.x:3000"
          />
          <Text style={styles.hint}>
            Trên iPhone thật, thay "localhost" bằng IP máy chạy backend
            (cùng Wi-Fi), ví dụ http://192.168.1.10:3000
          </Text>

          <TouchableOpacity style={styles.button} onPress={enablePush}>
            <Text style={styles.buttonText}>Bật thông báo đẩy</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Trạng thái: {pushStatus}</Text>

          <TouchableOpacity
            style={[styles.button, styles.buttonAlt]}
            onPress={onRefresh}
          >
            <Text style={[styles.buttonText, { color: '#4F46E5' }]}>
              Làm mới danh sách
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Bottom tab bar */}
      <View style={styles.tabbar}>
        <TabItem
          icon="🗓️"
          label="Sự kiện"
          active={tab === 'events'}
          onPress={() => setTab('events')}
        />
        <TabItem
          icon="⚙️"
          label="Cài đặt"
          active={tab === 'settings'}
          onPress={() => setTab('settings')}
        />
      </View>
    </View>
  );
}

function EventCard({ event }) {
  const open = event.isOpen;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View
          style={[
            styles.pill,
            { borderColor: open ? '#16A34A' : '#DC2626' },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              { color: open ? '#16A34A' : '#DC2626' },
            ]}
          >
            {open ? 'Đăng ký' : 'Đã đủ số lượng'}
          </Text>
        </View>
        <Text style={styles.count}>
          {event.current != null ? `${event.current} / ${event.max}` : ''}
        </Text>
      </View>
      <View style={styles.bar} />
      <Text style={styles.cardTitle}>
        {event.name}
        {event.max != null ? ` (${event.current}/${event.max})` : ''}
      </Text>
      {!!event.deadline && (
        <Text style={styles.deadline}>Hết hạn: {event.deadline}</Text>
      )}
    </View>
  );
}

function TabItem({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress}>
      <View style={[styles.tabIconWrap, active && styles.tabIconActive]}>
        <Text style={styles.tabIcon}>{icon}</Text>
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

async function registerForPush() {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  const token = (
    await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    )
  ).data;
  return token;
}

function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FB', paddingTop: 54 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1F2430' },
  subtitle: { fontSize: 13, color: '#8A90A0', marginTop: 2 },
  clock: { fontSize: 18, color: '#8A90A0', fontVariant: ['tabular-nums'] },

  list: { padding: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#8A90A0', marginTop: 40 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: { fontSize: 14, fontWeight: '600' },
  count: { fontSize: 18, fontWeight: '600', color: '#2B3040' },
  bar: {
    height: 4,
    backgroundColor: '#1F2430',
    borderRadius: 2,
    marginTop: 14,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 18, lineHeight: 26, color: '#2B3040' },
  deadline: { marginTop: 8, fontSize: 13, color: '#8A90A0' },

  settings: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#2B3040', marginBottom: 6 },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E6EF',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 8,
    fontSize: 15,
  },
  hint: { fontSize: 12, color: '#8A90A0', marginTop: 8, lineHeight: 18 },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonAlt: { backgroundColor: '#EEF0FB' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  tabbar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F5',
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIconWrap: {
    paddingHorizontal: 22,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tabIconActive: { backgroundColor: '#EDE9FE' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 12, color: '#8A90A0', marginTop: 2 },
  tabLabelActive: { color: '#F97316', fontWeight: '600' },
});
