import '../../../core/network/api_client.dart';
import '../../listings/data/api/listing_mapper.dart';
import '../domain/entities/ai_draft.dart';
import '../domain/repositories/ai_repository.dart';
import 'mock_ai_repository.dart';

/// `POST /ai/draft`, with the on-device lexicon underneath it.
///
/// The fallback is the same shape the backend uses: its `anthropic` provider
/// falls back to `local` when a model call fails. Here it also covers being
/// offline, which is the case that matters most — the composer has to work in
/// a field, and a request that cannot leave the phone is not a reason to make
/// the seller type the whole form.
class ApiAiRepository implements AiRepository {
  ApiAiRepository(this._client, {MockAiRepository? fallback})
      : _fallback = fallback ?? MockAiRepository(latency: Duration.zero);

  final ApiClient _client;
  final MockAiRepository _fallback;

  @override
  Future<AiDraft> draftListing(String text) async {
    try {
      return await _client.post('/ai/draft', body: {'text': text}, decode: _draft);
    } on ApiException catch (error) {
      if (error.isRateLimited) {
        // Not falled back on. The seller has hit a real limit and telling
        // them so is more honest than quietly serving a weaker answer.
        throw AiRateLimitException(error.messageUz);
      }
      return _fallback.draftListing(text);
    }
  }

  static AiDraft _draft(dynamic body) {
    final map = body is Map ? body : const {};

    return AiDraft(
      title: map['title'] as String? ?? '',
      description: map['description'] as String? ?? '',
      categorySlug: ListingMapper.text(map['categorySlug']),
      quantity: ListingMapper.number(map['quantity']),
      quantityUnit: ListingMapper.text(map['quantityUnit']),
      price: ListingMapper.number(map['price']),
      priceUnit: ListingMapper.text(map['priceUnit']),
      harvestDate: ListingMapper.date(map['harvestDate']),
      attributes: {
        for (final entry in (map['attributes'] as Map? ?? const {}).entries)
          if (entry.value != null) entry.key.toString(): entry.value as Object,
      },
      missingUz: [
        for (final note in (map['missingUz'] as List? ?? const []))
          note.toString(),
      ],
      source: DraftSource.fromWire(map['source'] as String?),
    );
  }
}
