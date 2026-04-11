import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/settings_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _companyController = TextEditingController();
  final _thresholdController = TextEditingController();
  final _apiKeyController = TextEditingController();
  
  bool _isSaving = false;
  
  // Additional settings state
  String? _selectedModel;
  String _aiMode = 'balanced';
  String _analysisLanguage = 'BH';
  bool _maskPii = true;

  @override
  void dispose() {
    _companyController.dispose();
    _thresholdController.dispose();
    _apiKeyController.dispose();
    super.dispose();
  }

  Future<void> _saveSettings() async {
    setState(() => _isSaving = true);
    try {
      final updates = {
        'company_name': _companyController.text,
        'exceptional_threshold': _thresholdController.text,
        'gemini_api_key': _apiKeyController.text,
        'gemini_model': _selectedModel ?? '',
        'ai_mode': _aiMode,
        'analysis_language': _analysisLanguage,
        'mask_pii': _maskPii.toString(),
      };
      
      await ref.read(settingsActionsProvider).updateSettings(updates);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Settings saved successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(settingsProvider);
    final modelsAsync = ref.watch(modelsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text('Settings'),
        actions: [
          if (_isSaving)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.check),
              onPressed: _saveSettings,
            ),
        ],
      ),
      body: settingsAsync.when(
        data: (settings) {
          // Initialize local state if not set
          if (_companyController.text.isEmpty && settings['company_name'] != null) {
            _companyController.text = settings['company_name']!;
          }
          if (_thresholdController.text.isEmpty && settings['exceptional_threshold'] != null) {
            _thresholdController.text = settings['exceptional_threshold']!;
          }
          if (_apiKeyController.text.isEmpty && settings['gemini_api_key'] != null) {
            _apiKeyController.text = settings['gemini_api_key']!;
          }
          _selectedModel ??= settings['gemini_model'];
          _aiMode = settings['ai_mode'] ?? 'balanced';
          _analysisLanguage = settings['analysis_language'] ?? 'BH';
          _maskPii = settings['mask_pii'] != 'false';

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSectionHeader(Icons.business, 'Company Profile'),
                const SizedBox(height: 16),
                _buildTextField(
                  controller: _companyController,
                  label: 'Company Name',
                  hint: 'e.g. SILA Technologies',
                ),
                const SizedBox(height: 32),
                
                _buildSectionHeader(Icons.notifications_active, 'AI Thresholds'),
                const SizedBox(height: 16),
                _buildTextField(
                  controller: _thresholdController,
                  label: 'Exceptional Candidate Threshold (%)',
                  hint: '90',
                  keyboardType: TextInputType.number,
                ),
                
                const SizedBox(height: 32),
                _buildSectionHeader(Icons.smart_toy, 'AI Engine'),
                const SizedBox(height: 16),
                _buildTextField(
                  controller: _apiKeyController,
                  label: 'Gemini API Key',
                  hint: 'AIzaSy...',
                  obscureText: true,
                ),
                const SizedBox(height: 16),
                
                // Model Dropdown
                modelsAsync.when(
                  data: (models) => _buildDropdownField(
                    label: 'Model Selection',
                    value: _selectedModel,
                    items: models.map((m) => DropdownMenuItem(value: m['model_id'] as String, child: Text(m['display_name'] as String))).toList(),
                    onChanged: (val) => setState(() => _selectedModel = val),
                  ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),

                const SizedBox(height: 32),
                _buildSectionHeader(Icons.security, 'Privacy & Preferences'),
                const SizedBox(height: 16),
                SwitchListTile(
                  title: const Text('Mask PII (Personal Info)', style: TextStyle(color: Colors.white)),
                  value: _maskPii,
                  onChanged: (val) => setState(() => _maskPii = val),
                  activeThumbColor: const Color(0xFF0EA5E9),
                  trackColor: MaterialStateProperty.resolveWith((states) => states.contains(MaterialState.selected) ? const Color(0xFF0369A1) : const Color(0xFF1E293B)),
                  contentPadding: EdgeInsets.zero,
                ),

                const SizedBox(height: 48),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _saveSettings,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0EA5E9),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Save Settings', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 48),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, stack) => Center(child: Text('Error: $e', style: const TextStyle(color: Colors.red))),
      ),
    );
  }

  Widget _buildSectionHeader(IconData icon, String title) {
    return Row(
      children: [
        Icon(icon, size: 20, color: const Color(0xFF0EA5E9)),
        const SizedBox(width: 12),
        Text(
          title,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    TextInputType keyboardType = TextInputType.text,
    bool obscureText = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8)),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscureText,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF334155)),
            filled: true,
            fillColor: const Color(0xFF1E293B),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ],
    );
  }

  Widget _buildDropdownField({
    required String label,
    required String? value,
    required List<DropdownMenuItem<String>> items,
    required Function(String?) onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8)),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: value,
          items: items,
          onChanged: onChanged,
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFF1E293B),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          ),
          dropdownColor: const Color(0xFF0F172A),
          style: const TextStyle(color: Colors.white, fontSize: 14),
        ),
      ],
    );
  }
}
