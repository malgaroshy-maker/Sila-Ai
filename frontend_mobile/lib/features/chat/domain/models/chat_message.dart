class ChatSuggestion {
  final String label;
  final String prompt;
  final String? action;

  ChatSuggestion({required this.label, required this.prompt, this.action});

  factory ChatSuggestion.fromJson(Map<String, dynamic> json) {
    return ChatSuggestion(
      label: json['label'] as String,
      prompt: json['prompt'] as String,
      action: json['action'] as String?,
    );
  }
}

class ChatMessage {
  final String role; // 'user' or 'model' (or 'assistant')
  final String text;
  final List<ChatSuggestion>? suggestions;

  ChatMessage({required this.role, required this.text, this.suggestions});

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    List<ChatSuggestion>? parsedSuggestions;
    if (json['metadata'] != null && json['metadata']['suggestions'] != null) {
      final suggestionsList = json['metadata']['suggestions'] as List;
      parsedSuggestions = suggestionsList
          .map((s) => ChatSuggestion.fromJson(s as Map<String, dynamic>))
          .toList();
    } else if (json['suggestions'] != null) {
      // In case the API returns suggestions directly
      final suggestionsList = json['suggestions'] as List;
      parsedSuggestions = suggestionsList
          .map((s) => ChatSuggestion.fromJson(s as Map<String, dynamic>))
          .toList();
    }

    return ChatMessage(
      role: json['role'] as String,
      text: json['content'] ?? json['response'] ?? json['text'] ?? '',
      suggestions: parsedSuggestions,
    );
  }

  Map<String, dynamic> toJson() {
    return {'role': role == 'user' ? 'user' : 'model', 'text': text};
  }
}
