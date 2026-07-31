import '../domain/entities/ai_draft.dart';
import '../domain/repositories/ai_repository.dart';
import 'uz_lexicon.dart';

/// The keyword pass, on the device.
///
/// Mirrors what the backend's `local` provider does, which is also what the
/// `anthropic` provider falls back to. Two consequences worth stating: the
/// composer works with no backend at all, and `source` on a draft is honest —
/// it says `keyword` because a keyword pass is what produced it.
class MockAiRepository implements AiRepository {
  MockAiRepository({this.latency = const Duration(milliseconds: 600)});

  /// Slower than the other mocks on purpose. The seller watches this one
  /// happen, and a spinner that never appears hides the state the real call
  /// will spend most of its time in.
  final Duration latency;

  @override
  Future<AiDraft> draftListing(String text) async {
    await Future<void>.delayed(latency);

    final facts = parseFacts(text);
    final missing = <String>[];

    if (facts.categorySlug == null) {
      missing.add('Kategoriyani tanlang');
    }
    if (facts.quantity == null) {
      missing.add('Hajmni kiriting');
    }
    if (facts.price == null) {
      // Never guessed. A model that fills in a plausible price is worse than
      // one that leaves the field empty.
      missing.add('Narxni kiriting');
    }
    missing.add('Viloyat va tumanni tanlang');

    return AiDraft(
      title: facts.title ?? '',
      description: text.trim(),
      categorySlug: facts.categorySlug,
      quantity: facts.quantity,
      quantityUnit: facts.quantityUnit,
      price: facts.price,
      priceUnit: facts.priceUnit,
      missingUz: missing,
    );
  }
}
