import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startLogin, submitLogin } from './iuhLogin';
import { updateRepoSecret } from './github';

const DEFAULT_OWNER =
  Constants.expoConfig?.extra?.repoOwner || 'LeGiaBaoDev';
const DEFAULT_REPO = Constants.expoConfig?.extra?.repoName || 'alertdrl';

function eventsUrl(owner, repo) {
  // Nhánh "data" được GitHub Actions cập nhật mỗi khi sự kiện thay đổi.
  return `https://raw.githubusercontent.com/${owner}/${repo}/data/events.json`;
}

export default function App() {
  const [tab, setTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [clock, setClock] = useState(now());
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState('');

  // Cấu hình GitHub (lưu trong máy)
  const [owner, setOwner] = useState(DEFAULT_OWNER);
  const [repo, setRepo] = useState(DEFAULT_REPO);
  const [token, setToken] = useState('');
  const cfgLoaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [o, r, t] = await Promise.all([
          AsyncStorage.getItem('repoOwner'),
          AsyncStorage.getItem('repoName'),
          AsyncStorage.getItem('githubToken'),
        ]);
        if (o) setOwner(o);
        if (r) setRepo(r);
        if (t) setToken(t);
      } catch {}
      cfgLoaded.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!cfgLoaded.current) return;
    AsyncStorage.setItem('repoOwner', owner).catch(() => {});
    AsyncStorage.setItem('repoName', repo).catch(() => {});
    AsyncStorage.setItem('githubToken', token).catch(() => {});
  }, [owner, repo, token]);

  useEffect(() => {
    const t = setInterval(() => setClock(now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadEvents = useCallback(async () => {
    const url = `${eventsUrl(owner, repo)}?t=${Date.now()}`;
    try {
      const res = await fetch(url);
      if (res.status === 404) {
        setEvents([]);
        setLastError('Chưa có dữ liệu trên nhánh "data" (đợi GitHub Actions quét lần đầu).');
        return;
      }
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : data.events || []);
      setLastError('');
    } catch (e) {
      setLastError(`Không tải được danh sách: ${e.message}`);
    }
  }, [owner, repo]);

  useEffect(() => {
    loadEvents();
    const t = setInterval(loadEvents, 60000);
    return () => clearInterval(t);
  }, [loadEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>NOW EVENT NOTIFICATION</Text>
          <Text style={styles.subtitle}>Trang doantn: {events.length} sự kiện</Text>
        </View>
        <Text style={styles.clock}>{clock}</Text>
      </View>

      {tab === 'events' && (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {events.length === 0 && (
            <Text style={styles.empty}>
              {lastError || 'Chưa có dữ liệu.'}
            </Text>
          )}
          {events.map((e, i) => (
            <EventCard key={i} event={e} />
          ))}
        </ScrollView>
      )}

      {tab === 'login' && (
        <LoginScreen owner={owner} repo={repo} token={token} onNeedToken={() => setTab('settings')} />
      )}

      {tab === 'settings' && (
        <ScrollView contentContainerStyle={styles.settings}>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>🔔 Thông báo chính qua ntfy</Text>
            <Text style={styles.infoText}>
              Sự kiện mới được GitHub Actions quét 24/7 và đẩy qua ntfy, kể cả khi
              app đóng. Cài app ntfy + subscribe topic của bạn để nhận.
            </Text>
            <Text style={styles.infoText}>
              App này để: xem danh sách sự kiện và cập nhật cookie khi hết hạn.
            </Text>
          </View>

          <Text style={styles.label}>GitHub Token (để đẩy cookie)</Text>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholder="github_pat_..."
          />
          <Text style={styles.hint}>
            Token fine-grained, quyền "Secrets: Read and write" cho repo {owner}/{repo}.
            Lưu trong máy, không gửi đi đâu ngoài GitHub.
          </Text>

          <Text style={[styles.label, { marginTop: 18 }]}>Repo owner</Text>
          <TextInput
            style={styles.input}
            value={owner}
            onChangeText={setOwner}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.label, { marginTop: 18 }]}>Repo name</Text>
          <TextInput
            style={styles.input}
            value={repo}
            onChangeText={setRepo}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity style={[styles.button, styles.buttonAlt]} onPress={onRefresh}>
            <Text style={[styles.buttonText, { color: '#4F46E5' }]}>Làm mới danh sách</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <View style={styles.tabbar}>
        <TabItem icon="🗓️" label="Sự kiện" active={tab === 'events'} onPress={() => setTab('events')} />
        <TabItem icon="🔑" label="Đăng nhập" active={tab === 'login'} onPress={() => setTab('login')} />
        <TabItem icon="⚙️" label="Cài đặt" active={tab === 'settings'} onPress={() => setTab('settings')} />
      </View>
    </View>
  );
}

function LoginScreen({ owner, repo, token, onNeedToken }) {
  const [phase, setPhase] = useState('idle'); // idle | loading | ready | submitting | done
  const [captcha, setCaptcha] = useState(null);
  const [phpsessid, setPhpsessid] = useState('');
  const [mssv, setMssv] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  const begin = async () => {
    setMsg('');
    setPhase('loading');
    try {
      const { phpsessid, captchaDataUri } = await startLogin();
      setPhpsessid(phpsessid);
      setCaptcha(captchaDataUri);
      setCode('');
      setPhase('ready');
    } catch (e) {
      setMsg('❌ ' + e.message);
      setPhase('idle');
    }
  };

  const submit = async () => {
    if (!token) {
      setMsg('⚠️ Chưa có GitHub token. Vào Cài đặt nhập trước.');
      onNeedToken();
      return;
    }
    if (!mssv || !password || !code) {
      setMsg('⚠️ Nhập đủ MSSV, mật khẩu và captcha.');
      return;
    }
    setMsg('');
    setPhase('submitting');
    try {
      const cookie = await submitLogin({ phpsessid, mssv, password, code });
      await updateRepoSecret({ token, owner, repo, name: 'COOKIE', value: cookie });
      setMsg('✅ Đăng nhập OK và đã cập nhật cookie lên GitHub! Lần quét tới sẽ dùng cookie mới.');
      setPhase('done');
      setPassword('');
    } catch (e) {
      // sai captcha -> cần captcha mới
      setMsg('❌ ' + e.message);
      setPhase('idle');
      setCaptcha(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.settings}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>🔑 Cập nhật cookie</Text>
        <Text style={styles.infoText}>
          Khi nhận cảnh báo "COOKIE hết hạn": bấm nút dưới để lấy captcha, nhập
          MSSV + mật khẩu + captcha, app sẽ tự đăng nhập và đẩy cookie mới lên GitHub.
        </Text>
      </View>

      {phase === 'idle' || phase === 'done' ? (
        <TouchableOpacity style={styles.button} onPress={begin}>
          <Text style={styles.buttonText}>Bắt đầu / Lấy captcha mới</Text>
        </TouchableOpacity>
      ) : null}

      {phase === 'loading' && <ActivityIndicator style={{ marginTop: 24 }} color="#4F46E5" />}

      {(phase === 'ready' || phase === 'submitting') && (
        <>
          {captcha && (
            <Image
              source={{ uri: captcha }}
              style={styles.captcha}
              resizeMode="contain"
            />
          )}
          <Text style={[styles.label, { marginTop: 16 }]}>MSSV</Text>
          <TextInput style={styles.input} value={mssv} onChangeText={setMssv} autoCapitalize="none" autoCorrect={false} keyboardType="numeric" />
          <Text style={[styles.label, { marginTop: 14 }]}>Mật khẩu</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />
          <Text style={[styles.label, { marginTop: 14 }]}>Mã captcha trong ảnh</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} />

          <TouchableOpacity
            style={[styles.button, phase === 'submitting' && { opacity: 0.6 }]}
            onPress={submit}
            disabled={phase === 'submitting'}
          >
            <Text style={styles.buttonText}>
              {phase === 'submitting' ? 'Đang xử lý…' : 'Đăng nhập & cập nhật cookie'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {!!msg && <Text style={styles.msg}>{msg}</Text>}
    </ScrollView>
  );
}

function EventCard({ event }) {
  const open = event.isOpen;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.pill, { borderColor: open ? '#16A34A' : '#DC2626' }]}>
          <Text style={[styles.pillText, { color: open ? '#16A34A' : '#DC2626' }]}>
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
      {!!event.deadline && <Text style={styles.deadline}>Hết hạn: {event.deadline}</Text>}
    </View>
  );
}

function TabItem({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress}>
      <View style={[styles.tabIconWrap, active && styles.tabIconActive]}>
        <Text style={styles.tabIcon}>{icon}</Text>
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FB', paddingTop: 54 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1F2430' },
  subtitle: { fontSize: 13, color: '#8A90A0', marginTop: 2 },
  clock: { fontSize: 18, color: '#8A90A0', fontVariant: ['tabular-nums'] },

  list: { padding: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#8A90A0', marginTop: 40, paddingHorizontal: 20, lineHeight: 20 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  pillText: { fontSize: 14, fontWeight: '600' },
  count: { fontSize: 18, fontWeight: '600', color: '#2B3040' },
  bar: { height: 4, backgroundColor: '#1F2430', borderRadius: 2, marginTop: 14, marginBottom: 14 },
  cardTitle: { fontSize: 18, lineHeight: 26, color: '#2B3040' },
  deadline: { marginTop: 8, fontSize: 13, color: '#8A90A0' },

  settings: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: '#2B3040', marginBottom: 6 },
  input: {
    backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E6EF',
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 8, fontSize: 15,
  },
  hint: { fontSize: 12, color: '#8A90A0', marginTop: 8, lineHeight: 18 },
  captcha: { width: '100%', height: 90, marginTop: 16, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E6EF' },
  msg: { marginTop: 18, fontSize: 14, lineHeight: 20, color: '#2B3040' },
  infoBox: { backgroundColor: '#EDE9FE', borderRadius: 14, padding: 16, marginBottom: 20 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#4F46E5', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#4B4F63', lineHeight: 19, marginTop: 4 },
  button: { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  buttonAlt: { backgroundColor: '#EEF0FB' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  tabbar: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 10, paddingBottom: 26, borderTopWidth: 1, borderTopColor: '#EEF0F5' },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIconWrap: { paddingHorizontal: 22, paddingVertical: 6, borderRadius: 16 },
  tabIconActive: { backgroundColor: '#EDE9FE' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 12, color: '#8A90A0', marginTop: 2 },
  tabLabelActive: { color: '#F97316', fontWeight: '600' },
});
