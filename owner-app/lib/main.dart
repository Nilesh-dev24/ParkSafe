import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'api.dart';

void main() => runApp(const ParkSafeApp());

class ParkSafeApp extends StatelessWidget {
  const ParkSafeApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'ParkSafe', debugShowCheckedModeBanner: false,
    theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff07577b)), useMaterial3: true),
    home: const AuthPage(),
  );
}

class AuthPage extends StatefulWidget { const AuthPage({super.key}); @override State<AuthPage> createState() => _AuthPageState(); }
class _AuthPageState extends State<AuthPage> {
  final name = TextEditingController(), email = TextEditingController(), password = TextEditingController();
  bool registering = true, busy = false; String error = '';
  Future<void> submit() async {
    setState(() { busy = true; error = ''; });
    try {
      final data = await Api.request('/api/auth/${registering ? 'register' : 'login'}', method: 'POST', body: {'name': name.text.trim(), 'email': email.text.trim(), 'password': password.text});
      if (!mounted) return;
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => VehiclesPage(token: data['token'] as String, ownerName: (data['user']['name'] ?? '') as String)));
    } catch (e) { setState(() => error = e.toString().replaceFirst('Exception: ', '')); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override Widget build(BuildContext context) => Scaffold(body: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    const Icon(Icons.shield_moon_outlined, size: 60, color: Color(0xff07577b)), const SizedBox(height: 10), const Text('ParkSafe', textAlign: TextAlign.center, style: TextStyle(fontSize: 30, fontWeight: FontWeight.bold)), const Text('Secure & anonymous parking contact', textAlign: TextAlign.center), const SizedBox(height: 28),
    if (registering) TextField(controller: name, decoration: const InputDecoration(labelText: 'Full name', border: OutlineInputBorder())), if (registering) const SizedBox(height: 12),
    TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder())), const SizedBox(height: 12), TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password (min 8 characters)', border: OutlineInputBorder())), const SizedBox(height: 16),
    if (error.isNotEmpty) Text(error, style: const TextStyle(color: Colors.red)), FilledButton(onPressed: busy ? null : submit, child: Text(busy ? 'Please wait…' : registering ? 'Create account' : 'Login')), TextButton(onPressed: () => setState(() { registering = !registering; error = ''; }), child: Text(registering ? 'Already registered? Login' : 'New here? Create account')),
    const SizedBox(height: 12), const Text('Demo foundation: use a strong password. Add email verification and account recovery before public launch.', style: TextStyle(fontSize: 12, color: Colors.black54))
  ])))));
}

class VehiclesPage extends StatefulWidget { final String token, ownerName; const VehiclesPage({super.key, required this.token, required this.ownerName}); @override State<VehiclesPage> createState() => _VehiclesPageState(); }
class _VehiclesPageState extends State<VehiclesPage> {
  List<dynamic> vehicles = []; bool busy = true; String error = '';
  final make = TextEditingController(), model = TextEditingController(), color = TextEditingController(), registration = TextEditingController();
  @override void initState() { super.initState(); load(); }
  Future<void> load() async { try { final r = await Api.getList('/api/vehicles/mine', token: widget.token); setState(() { vehicles = r; error = ''; }); } catch(e) { setState(() => error = e.toString()); } finally { setState(() => busy = false); } }
  Future<void> addVehicle() async { try { await Api.request('/api/vehicles', method:'POST', token:widget.token, body:{'make':make.text,'model':model.text,'color':color.text,'registration':registration.text}); make.clear(); model.clear(); color.clear(); registration.clear(); if(mounted) Navigator.pop(context); await load(); } catch(e) { setState(()=>error=e.toString()); } }
  void addDialog() => showDialog(context: context, builder: (_) => AlertDialog(title: const Text('Add vehicle'), content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [TextField(controller:make,decoration:const InputDecoration(labelText:'Make (e.g. Maruti)')),TextField(controller:model,decoration:const InputDecoration(labelText:'Model')),TextField(controller:color,decoration:const InputDecoration(labelText:'Colour')),TextField(controller:registration,decoration:const InputDecoration(labelText:'Registration'))])), actions:[TextButton(onPressed:()=>Navigator.pop(context),child:const Text('Cancel')),FilledButton(onPressed:addVehicle,child:const Text('Save'))]));
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('My vehicles'), actions:[IconButton(onPressed:load,icon:const Icon(Icons.refresh))]), floatingActionButton: FloatingActionButton.extended(onPressed:addDialog,icon:const Icon(Icons.add),label:const Text('Add vehicle')), body: busy ? const Center(child:CircularProgressIndicator()) : RefreshIndicator(onRefresh:load, child: ListView(padding:const EdgeInsets.all(16), children:[Text('Welcome, ${widget.ownerName}',style:Theme.of(context).textTheme.titleLarge),const SizedBox(height:12),if(error.isNotEmpty) Text(error,style:const TextStyle(color:Colors.red)),if(vehicles.isEmpty) const Padding(padding:EdgeInsets.all(24),child:Text('No vehicles yet. Tap Add vehicle to create your first QR code.')), ...vehicles.map((v) => Card(child:ListTile(leading:const Icon(Icons.directions_car),title:Text('${v['make']} ${v['model']}'),subtitle:Text('${v['registration']} · ${v['color']}'),trailing:IconButton(icon:const Icon(Icons.qr_code_2),onPressed:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>QrPage(vehicle:v)))))))])));
}

class QrPage extends StatelessWidget { final dynamic vehicle; const QrPage({super.key,required this.vehicle});
  @override Widget build(BuildContext context) { final id=vehicle['id']; final url='https://YOUR-VISITOR-SITE.example/car/$id'; return Scaffold(appBar:AppBar(title:const Text('Vehicle QR Code')),body:Center(child:Padding(padding:const EdgeInsets.all(24),child:Column(mainAxisAlignment:MainAxisAlignment.center,children:[Text('${vehicle['make']} ${vehicle['model']}',style:Theme.of(context).textTheme.titleLarge),const SizedBox(height:8),QrImageView(data:url,size:240,backgroundColor:Colors.white),const SizedBox(height:12),const Text('Replace YOUR-VISITOR-SITE.example with your deployed website domain before printing.'),const SizedBox(height:8),SelectableText(url,textAlign:TextAlign.center),const SizedBox(height:16),const Text('Do not print this placeholder QR for real use.',style:TextStyle(color:Colors.red,fontWeight:FontWeight.bold))])))); }
}

