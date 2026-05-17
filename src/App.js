import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, collection, query, where, orderBy, onSnapshot, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB8U78q9OabXopXBP2_TNu0AqMgi63v4sw",
  authDomain: "app-club95.firebaseapp.com",
  projectId: "app-club95",
  storageBucket: "app-club95.firebasestorage.app",
  messagingSenderId: "866738204928",
  appId: "1:866738204928:web:0caaca11ff134bf4ab43e5"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const T = {
  primary: '#F03D00', bg: '#0A0A0A', surface: '#1A1A1A',
  border: '#2A2A2A', text: '#FFFFFF', muted: '#6B6460',
  green: '#22C55E', surfaceAlt: '#242424', blue: '#3B82F6',
};

const PLAN_CONFIG = {
  black: { label: '⬛ Black', color: '#C0C0C0' },
  gold: { label: '🥇 Gold', color: '#D4A017' },
  premium: { label: '💎 Premium', color: '#F03D00' },
};

const styles = {
  root: { minHeight: '100vh', backgroundColor: T.bg, color: T.text, fontFamily: "'Segoe UI', sans-serif", maxWidth: 430, margin: '0 auto' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 28 },
  input: { width: '100%', backgroundColor: T.surface, borderRadius: 12, padding: 14, marginBottom: 12, color: T.text, fontSize: 15, border: `1px solid ${T.border}`, outline: 'none', boxSizing: 'border-box' },
  btn: { width: '100%', backgroundColor: T.primary, borderRadius: 12, padding: 14, color: '#fff', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 8 },
  btnGhost: { width: '100%', backgroundColor: 'transparent', borderRadius: 12, padding: 14, color: T.muted, fontWeight: 800, fontSize: 15, border: `1px solid ${T.border}`, cursor: 'pointer' },
  card: { backgroundColor: T.surface, borderRadius: 16, padding: 20, marginBottom: 12, border: `1px solid ${T.border}` },
  tabBar: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, display: 'flex', backgroundColor: T.surface, borderTop: `1px solid ${T.border}`, paddingBottom: 8 },
  tabItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0 0', cursor: 'pointer', background: 'none', border: 'none' },
  tabLabel: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
  row: { display: 'flex', alignItems: 'center', backgroundColor: T.surface, marginBottom: 8, borderRadius: 12, padding: 14, border: `1px solid ${T.border}` },
};

export default function App() {
  const [screen, setScreen] = useState('login');
  const [tab, setTab] = useState('scan');
  const [merchant, setMerchant] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [qrInput, setQrInput] = useState('');
  const [scannedUser, setScannedUser] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [txLoading, setTxLoading] = useState(false);
  const [txSuccess, setTxSuccess] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'merchants', firebaseUser.uid));
        if (snap.exists()) {
          setMerchant({ uid: firebaseUser.uid, ...snap.data() });
        } else {
          setMerchant({ uid: firebaseUser.uid, name: firebaseUser.email, discountBase: 20 });
        }
        setScreen('app');
      }
      setLoadingAuth(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!merchant) return;
    const q = query(
      collection(db, 'transactions'),
      where('merchantId', '==', merchant.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [merchant]);

  const login = async () => {
    setError(''); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'merchants', cred.user.uid));
      if (snap.exists()) {
        setMerchant({ uid: cred.user.uid, ...snap.data() });
      } else {
        setMerchant({ uid: cred.user.uid, name: email, discountBase: 20 });
      }
      setScreen('app');
    } catch (e) {
      setError('Email o contraseña incorrectos');
    }
    setLoading(false);
  };

  const buscarUsuario2 = async (uid) => {
    setScanError(''); setScanLoading(true); setScannedUser(null);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        setScannedUser({ uid, ...snap.data() });
      } else {
        setScanError('Usuario no encontrado.');
      }
    } catch (e) {
      setScanError('Error al buscar el usuario.');
    }
    setScanLoading(false);
  };

  const buscarUsuario = async () => {
    if (!qrInput.trim()) return;
    await buscarUsuario2(qrInput.trim());
  };

  const registrarTransaccion = async () => {
    const amt = parseFloat(amount);
    const disc = parseFloat(discount);
    if (!amt || amt <= 0) return;
    if (!disc || disc <= 0 || disc > 100) return;

    const saved = parseFloat((amt * disc / 100).toFixed(2));

    setTxLoading(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        userId: scannedUser.uid,
        merchantId: merchant.uid,
        merchantName: merchant.name || merchant.uid,
        amount: amt,
        discount: disc,
        saved,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', scannedUser.uid), {
        totalSaved: increment(saved),
      });
      setTxSuccess({ saved, descEfectivo: disc, userName: scannedUser.displayName });
      setAmount(''); setDiscount('');
    } catch (e) {
      alert('Error al registrar: ' + e.message);
    }
    setTxLoading(false);
  };

  const resetScan = () => {
    setScannedUser(null); setQrInput('');
    setTxSuccess(null); setScanError('');
    setAmount(''); setDiscount('');
  };

  const amountNum = parseFloat(amount) || 0;
  const discountNum = parseFloat(discount) || 0;
  const savedPreview = amountNum > 0 && discountNum > 0
    ? (amountNum * discountNum / 100).toFixed(2) : null;

  if (loadingAuth) return (
    <div style={{ ...styles.root, ...styles.center }}>
      <p style={{ fontSize: 48, fontWeight: 900 }}>CLUB<span style={{ color: T.primary }}>95.</span></p>
      <p style={{ color: T.muted, fontSize: 14, marginTop: 16 }}>Cargando...</p>
    </div>
  );

  if (screen === 'login') return (
    <div style={styles.root}>
      <div style={styles.center}>
        <p style={{ fontSize: 42, fontWeight: 900, margin: 0 }}>
          CLUB<span style={{ color: T.primary }}>95.</span>
        </p>
        <p style={{ color: T.muted, fontSize: 13, marginBottom: 40 }}>Panel de Comercio</p>
        <input style={styles.input} placeholder='Email' value={email}
          onChange={e => setEmail(e.target.value)} type='email' />
        <input style={styles.input} placeholder='Contraseña' value={password}
          onChange={e => setPassword(e.target.value)} type='password' />
        {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button style={styles.btn} onClick={login} disabled={loading}>
          {loading ? 'Ingresando...' : 'Acceder'}
        </button>
      </div>
    </div>
  );

  const ScanTab = () => {
    const scannerRef = React.useRef(null);
    const [scanning, setScanning] = React.useState(false);

    const startScanner = () => {
      setScanning(true);
      setTimeout(() => {
        const { Html5Qrcode } = require('html5-qrcode');
        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;
        html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            html5QrCode.stop();
            setScanning(false);
            setQrInput(decodedText);
            buscarUsuario2(decodedText);
          },
          () => { }
        ).catch(() => {
          setScanning(false);
          setScanError('No se pudo acceder a la cámara.');
        });
      }, 500);
    };

    const stopScanner = () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => { });
      }
      setScanning(false);
    };

    return (
      <div style={{ padding: 20, paddingBottom: 100 }}>
        <p style={{ color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, margin: 0 }}>
          Comercio
        </p>
        <p style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 20 }}>
          {merchant?.name || 'Mi Comercio'}
        </p>

        {txSuccess && (
          <div style={{ backgroundColor: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 20, padding: 28, textAlign: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 48, margin: 0 }}>✅</p>
            <p style={{ color: T.green, fontWeight: 900, fontSize: 18, margin: 0, marginTop: 12 }}>¡Operación registrada!</p>
            <p style={{ color: T.muted, fontSize: 13, margin: 0, marginTop: 4 }}>{txSuccess.userName}</p>
            <p style={{ color: T.green, fontWeight: 900, fontSize: 40, margin: 0, marginTop: 12 }}>-${txSuccess.saved}</p>
            <p style={{ color: T.muted, fontSize: 13, margin: 0, marginTop: 2 }}>ahorrado · {txSuccess.descEfectivo}% de descuento</p>
            <button style={{ ...styles.btn, marginTop: 20 }} onClick={resetScan}>Nuevo escaneo</button>
          </div>
        )}

        {!scannedUser && !txSuccess && (
          <div>
            <div style={{ ...styles.card, textAlign: 'center', padding: 20 }}>
              <div id="qr-reader" style={{ width: '100%', marginBottom: 12 }} />
              {!scanning ? (
                <>
                  <p style={{ fontSize: 32, margin: 0, marginBottom: 8 }}>📷</p>
                  <p style={{ color: T.muted, fontSize: 13, margin: 0, marginBottom: 16 }}>Escaneá el QR del cliente</p>
                  <button style={styles.btn} onClick={startScanner}>📷 Abrir cámara</button>
                </>
              ) : (
                <button style={styles.btnGhost} onClick={stopScanner}>✕ Cancelar escaneo</button>
              )}
            </div>
            <div style={{ ...styles.card }}>
              <p style={{ color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, margin: 0, marginBottom: 8 }}>
                O ingresá el ID manualmente
              </p>
              <input style={styles.input} placeholder='ID del cliente'
                value={qrInput} onChange={e => setQrInput(e.target.value)} />
              {scanError && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{scanError}</p>}
              <button style={styles.btn} onClick={buscarUsuario} disabled={scanLoading}>
                {scanLoading ? 'Buscando...' : '🔍 Buscar cliente'}
              </button>
            </div>
          </div>
        )}

        {scannedUser && !txSuccess && (
          <div>
            <div style={{ ...styles.card, border: `1px solid ${PLAN_CONFIG[scannedUser.plan]?.color}44` }}>
              <p style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, margin: 0, marginBottom: 8 }}>
                Cliente detectado
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff' }}>
                  {scannedUser.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{scannedUser.displayName}</p>
                  <span style={{ fontSize: 10, fontWeight: 700, color: PLAN_CONFIG[scannedUser.plan]?.color }}>
                    {PLAN_CONFIG[scannedUser.plan]?.label}
                  </span>
                </div>
                <button onClick={resetScan} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
            </div>

            <input style={styles.input} placeholder='Monto de la compra ($)'
              value={amount} onChange={e => setAmount(e.target.value)}
              type='text' inputMode='numeric' />
            <input style={styles.input} placeholder='Descuento (%)'
              value={discount} onChange={e => setDiscount(e.target.value)}
              type='text' inputMode='numeric' />

            {savedPreview && (
              <div style={{ backgroundColor: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 14, padding: 16, textAlign: 'center', marginBottom: 16 }}>
                <p style={{ color: T.green, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, margin: 0, marginBottom: 4 }}>El cliente ahorra</p>
                <p style={{ color: T.green, fontWeight: 900, fontSize: 40, margin: 0 }}>${savedPreview}</p>
              </div>
            )}

            <button style={styles.btn} onClick={registrarTransaccion}
              disabled={txLoading || !amountNum || !discountNum}>
              {txLoading ? 'Registrando...' : 'Registrar operación'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const HistoryTab = () => {
    const total = transactions.reduce((s, t) => s + t.saved, 0);
    return (
      <div style={{ padding: 20, paddingBottom: 100 }}>
        <p style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 4 }}>Historial</p>
        <p style={{ color: T.muted, fontSize: 12, margin: 0, marginBottom: 16 }}>{transactions.length} operaciones</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Operaciones', value: transactions.length, color: T.text },
            { label: 'Ahorro generado', value: `$${total.toLocaleString('es-AR')}`, color: T.primary },
          ].map((s, i) => (
            <div key={i} style={{ ...styles.card, flex: 1, textAlign: 'center', padding: 14 }}>
              <p style={{ color: T.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, margin: 0, marginBottom: 4 }}>{s.label}</p>
              <p style={{ color: s.color, fontWeight: 900, fontSize: 20, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>
        {transactions.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ fontSize: 32 }}>📋</p>
            <p style={{ color: T.muted, fontSize: 14 }}>Sin operaciones aún</p>
          </div>
        ) : transactions.map(tx => (
          <div key={tx.id} style={styles.row}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{tx.userId?.slice(0, 12)}...</p>
              <p style={{ color: T.muted, fontSize: 11, margin: 0, marginTop: 2 }}>
                ${tx.amount?.toLocaleString('es-AR')} · {tx.discount}% descuento
              </p>
            </div>
            <p style={{ color: T.green, fontWeight: 900, fontSize: 15, margin: 0 }}>-${tx.saved}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={styles.root}>
      <div>
        {tab === 'scan' && <ScanTab />}
        {tab === 'history' && <HistoryTab />}
      </div>
      <div style={styles.tabBar}>
        {[
          { id: 'scan', icon: '📷', label: 'Scanner' },
          { id: 'history', icon: '📋', label: 'Historial' },
        ].map(t => (
          <button key={t.id} style={{ ...styles.tabItem, color: tab === t.id ? T.primary : T.muted }}
            onClick={() => setTab(t.id)}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ ...styles.tabLabel, color: tab === t.id ? T.primary : T.muted }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}