import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { CarFront, PhoneCall, MessageCircle, ShieldCheck, LoaderCircle } from 'lucide-react';
import './style.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const SIGNAL = import.meta.env.VITE_SIGNAL_URL || API;
function App() {
  const vehicleId = window.location.pathname.split('/').filter(Boolean).at(-1);
  const [vehicle, setVehicle] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [status, setStatus] = useState('');
  const [calling, setCalling] = useState(false);
  const socketRef = useRef(null), pcRef = useRef(null), streamRef = useRef(null), sessionRef = useRef(crypto.randomUUID());
  useEffect(() => { fetch(`${API}/api/vehicles/${vehicleId}/public`).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not load vehicle'); setVehicle(d); }).catch(e => setError(e.message)); }, [vehicleId]);
  useEffect(() => () => { socketRef.current?.disconnect(); pcRef.current?.close(); streamRef.current?.getTracks().forEach(t => t.stop()); }, []);
  async function sendMessage(e) {
    e.preventDefault(); setStatus('');
    try { const r = await fetch(`${API}/api/vehicles/${vehicleId}/messages`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message}) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setStatus(d.message); setMessage(''); }
    catch(e) { setStatus(e.message || 'Message could not be sent.'); }
  }
  async function startCall() {
    setCalling(true); setStatus('Requesting microphone permission…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true, video:false}); streamRef.current = stream;
      const pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]}); pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = e => { const audio = new Audio(); audio.srcObject = e.streams[0]; audio.play().catch(()=>{}); };
      const socket = io(SIGNAL); socketRef.current = socket;
      socket.on('connect', async () => {
        socket.emit('call:visitor-join', {sessionId:sessionRef.current});
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
        socket.emit('call:request', {vehicleId, offer:pc.localDescription, sessionId:sessionRef.current});
        setStatus('Calling owner… Keep this page open. The owner app must be online to answer.');
      });
      socket.on('call:unavailable', () => setStatus('Owner is unavailable. Please try messaging instead.'));
      socket.on('call:answer', async ({answer}) => { try { await pc.setRemoteDescription(answer); setStatus('Connected. You can speak now.'); } catch { setStatus('Could not connect the call.'); } });
      socket.on('call:ice', async ({candidate}) => { try { await pc.addIceCandidate(candidate); } catch {} });
      pc.onicecandidate = e => { if(e.candidate) socket.emit('call:ice',{targetRoom:`visitor:${sessionRef.current}`,candidate:e.candidate}); };
      pc.onconnectionstatechange = () => { if(['failed','disconnected','closed'].includes(pc.connectionState)) setStatus('Call disconnected.'); };
    } catch(e) { setStatus(e.name === 'NotAllowedError' ? 'Microphone permission was denied.' : 'Calling needs HTTPS (or localhost), a microphone and an available owner app.'); setCalling(false); }
  }
  function endCall(){ socketRef.current?.disconnect(); pcRef.current?.close(); streamRef.current?.getTracks().forEach(t=>t.stop()); setCalling(false); setStatus('Call ended.'); }
  if (error) return <main className="shell"><section className="card"><h1>ParkSafe</h1><p>{error}</p><small>Check the QR link or ask the car owner to activate it.</small></section></main>;
  if (!vehicle) return <main className="shell"><section className="card"><LoaderCircle className="spin"/><p>Loading vehicle details…</p></section></main>;
  return <main className="shell"><header><div className="logo"><ShieldCheck/><span>ParkSafe</span></div><p>Safe parking. Private communication.</p></header><section className="card"><div className="vehicle-icon"><CarFront size={34}/></div><span className="eyebrow">PARKED VEHICLE</span><h1>{vehicle.ownerName}</h1><p className="sub">Car owner</p><div className="details"><div><small>Vehicle</small><strong>{vehicle.make} {vehicle.model}</strong></div><div><small>Colour</small><strong>{vehicle.color || 'Not specified'}</strong></div><div><small>Registration</small><strong>{vehicle.registration}</strong></div></div><div className="privacy"><ShieldCheck size={18}/><span>Owner contact details are hidden. Your phone number is not shown on this page.</span></div><button className="call" onClick={calling?endCall:startCall}><PhoneCall size={19}/>{calling?'End call':'Call owner privately'}</button><p className="hint">Internet voice call · Microphone permission required</p><form onSubmit={sendMessage}><label htmlFor="message">Send a message</label><textarea id="message" maxLength="500" required minLength="2" value={message} onChange={e=>setMessage(e.target.value)} placeholder="e.g. Your car is blocking the driveway…"/><button className="secondary" type="submit"><MessageCircle size={18}/>Send message</button></form>{status && <p className="status" role="status">{status}</p>}</section><footer>ParkSafe · Scan. Connect. Help.</footer></main>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
