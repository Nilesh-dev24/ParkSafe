# ParkSafe — मराठी Step-by-Step Development Plan

## Phase 0 — Software install
1. VS Code install करा.
2. Node.js LTS install करा; terminal मध्ये `node -v` आणि `npm -v` तपासा.
3. Git install करा.
4. Android Studio install करा आणि Android SDK + Emulator तयार करा.
5. Flutter SDK install करून PATH मध्ये जोडा; `flutter doctor` चालवा.
6. MongoDB Atlas account तयार करा किंवा local MongoDB वापरा.

## Phase 1 — Backend चालू करणे
1. `backend/.env.example` ची copy `.env` नावाने करा.
2. `MONGODB_URI` मध्ये Atlas connection string ठेवा.
3. `JWT_SECRET` मध्ये किमान 32 characters चा random secret ठेवा.
4. `CLIENT_ORIGIN=http://localhost:5173` ठेवा.
5. Terminal:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
6. Browser मध्ये `http://localhost:4000/api/health` उघडा. `{"ok":true,...}` दिसले पाहिजे.

## Phase 2 — Visitor Website
1. नवीन terminal:
   ```bash
   cd visitor-web
   npm install
   npm run dev
   ```
2. Vite ने दिलेली URL उघडा.
3. Visitor URL ची रचना `/car/VEHICLE_ID` अशी आहे. Vehicle ID मिळण्यासाठी आधी Owner App/API मधून vehicle create करा.
4. Production deploy करण्यापूर्वी `.env.example` copy करून `VITE_API_URL` आणि `VITE_SIGNAL_URL` सेट करा.

## Phase 3 — Flutter Owner App
1. `owner-app` folder मध्ये:
   ```bash
   flutter pub get
   flutter run
   ```
2. Android Emulator वापरत असल्यास `10.0.2.2` हा host computer साठीचा special address आहे.
3. Physical phone असल्यास `lib/api.dart` मधील `baseUrl` ला computer चा LAN IP द्या; phone आणि computer एकाच Wi-Fi वर असावेत.
4. Vehicle add करून QR screen उघडा. त्या screen मधील `YOUR-VISITOR-SITE.example` हा placeholder आहे; वास्तविक website deploy झाल्यावर तो domain बदला.

## Phase 4 — Anonymous WebRTC calling पूर्ण करणे
- सध्याच्या scaffold मध्ये backend signaling events आणि visitor-side WebRTC offer तयार करण्याचा आरंभ आहे.
- पुढील code phase मध्ये Flutter owner app ला Socket.IO presence, incoming call UI, accept/reject, SDP answer, ICE candidate exchange, speaker/mute आणि call cleanup जोडायचे आहे.
- WebRTC signaling म्हणजे audio वाहून नेणारा server नाही; तो call setup messages पोहोचवतो. अनेक mobile/network combinations वर reliable connection साठी TURN server लागू शकतो.
- HTTPS आवश्यक आहे (localhost हा development exception आहे). Production वर microphone access आणि socket connections HTTPS/WSS वरच ठेवा.
- एकदा पूर्ण call flow real Android phones वर तपासल्याशिवाय calling feature complete असल्याचा दावा करू नका.

## Phase 5 — Push notifications
- Firebase Console मध्ये project आणि Android app तयार करा.
- Flutter app च्या package name शी Firebase Android app ID जुळवा.
- `google-services.json` app च्या `android/app/` मध्ये ठेवा; FlutterFire setup guide वापरून dependencies initialize करा.
- Token backend ला authenticated API ने register करा. FCM server credentials कधीही website किंवा Android app मध्ये ठेवू नका; server-side only.
- Background incoming calls साठी Android restrictions, notification permissions आणि foreground-service requirements तपासा.

## Phase 6 — Privacy & production hardening
- Owner consent, privacy policy, abuse/report flow, account deletion आणि vehicle QR disable सुविधा जोडा.
- सार्वजनिक API response मध्ये phone/email/password/token कधीही परत करू नका.
- Visitor message ला rate limit, length limit आणि moderation लागू करा.
- Production secrets environment variables मध्येच ठेवा; GitHub वर `.env` upload करू नका.
- QR code मध्ये random vehicle ID/URL ठेवा; फोन नंबर थेट QR मध्ये encode करू नका.
- HTTPS, dependency updates, logs मध्ये secrets न ठेवणे, database backups आणि real-device tests आवश्यक.

## सध्याच्या starter ची मर्यादा
हा आरंभिक runnable scaffold आहे. Backend आणि visitor website चा basic flow व Flutter login/vehicle/QR foundation दिला आहे. Owner app मधील पूर्ण incoming WebRTC call UI, persistent inbox, FCM background call notifications, email verification/password reset आणि production deployment configuration पुढील phases मध्ये पूर्ण करायचे आहेत. त्यामुळे हा अजून final production app नाही.
