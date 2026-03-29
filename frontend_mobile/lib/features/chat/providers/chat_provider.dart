import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../domain/models/chat_message.dart';

class ChatState {
  final List<ChatMessage> messages;
  final bool isLoading;
  final String? sessionId;
  final String? errorMessage;

  ChatState({
    required this.messages,
    required this.isLoading,
    this.sessionId,
    this.errorMessage,
  });

  ChatState copyWith({
    List<ChatMessage>? messages,
    bool? isLoading,
    String? sessionId,
    String? errorMessage,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      sessionId: sessionId ?? this.sessionId,
      errorMessage: errorMessage, // We allow setting it to null to clear it
    );
  }
}

class ChatNotifier extends Notifier<ChatState> {
  @override
  ChatState build() {
    return ChatState(messages: [], isLoading: false);
  }

  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    // Add user message to UI immediately
    final userMessage = ChatMessage(role: 'user', text: text);
    final history = state.messages.map((m) => m.toJson()).toList();

    state = state.copyWith(
      messages: [...state.messages, userMessage],
      isLoading: true,
      errorMessage: null,
    );

    final String baseUrl =
        dotenv.env['BACKEND_API_URL'] ?? 'http://10.0.2.2:5000';
    final userEmail = Supabase.instance.client.auth.currentUser?.email;

    if (userEmail == null) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'User not authenticated',
      );
      return;
    }

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/chat'),
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        body: jsonEncode({
          'message': text,
          'history': history,
          'sessionId': state.sessionId,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);

        final aiMessage = ChatMessage(
          role: 'model',
          text: data['response'] ?? 'No response',
          suggestions: data['suggestions'] != null
              ? (data['suggestions'] as List)
                    .map(
                      (s) => ChatSuggestion.fromJson(s as Map<String, dynamic>),
                    )
                    .toList()
              : null,
        );

        state = state.copyWith(
          messages: [...state.messages, aiMessage],
          sessionId: data['sessionId'] ?? state.sessionId,
          isLoading: false,
        );
      } else {
        state = state.copyWith(
          isLoading: false,
          errorMessage: 'Failed to send message: HTTP ${response.statusCode}',
        );
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Connection error: $e',
      );
    }
  }

  void clearChat() {
    state = ChatState(messages: [], isLoading: false, sessionId: null);
  }

  void clearError() {
    state = state.copyWith(errorMessage: null);
  }
}

final chatProvider = NotifierProvider<ChatNotifier, ChatState>(ChatNotifier.new);
