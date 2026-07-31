import 'package:flutter/foundation.dart';

/// What answered — the keyword pass or the model.
///
/// Carried through from the API and kept because "the suggestion was wrong" is
/// not diagnosable without knowing who suggested it.
enum DraftSource {
  keyword('keyword'),
  model('model');

  const DraftSource(this.wire);

  final String wire;

  static DraftSource fromWire(String? value) => DraftSource.values.firstWhere(
        (source) => source.wire == value,
        orElse: () => DraftSource.keyword,
      );
}

/// The reply from `POST /ai/draft`: form values plus what is still missing.
///
/// A draft, never a listing. The API writes nothing — the seller reviews these
/// values in the ordinary form and publishes through the ordinary endpoint,
/// with the same validation a hand-typed listing gets. A model that can post
/// unattended is a model that can misprice somebody's harvest in public.
@immutable
class AiDraft {
  const AiDraft({
    this.title = '',
    this.description = '',
    this.categorySlug,
    this.quantity,
    this.quantityUnit,
    this.price,
    this.priceUnit,
    this.harvestDate,
    this.attributes = const {},
    this.missingUz = const [],
    this.source = DraftSource.keyword,
  });

  final String title;
  final String description;

  /// A slug, not an id. The model is never trusted with an id — a hallucinated
  /// one would surface as a foreign-key error at publish time.
  final String? categorySlug;

  final num? quantity;
  final String? quantityUnit;
  final num? price;
  final String? priceUnit;
  final DateTime? harvestDate;

  final Map<String, Object> attributes;

  /// Uzbek notes on what the seller still has to supply by hand. This is where
  /// "I don't know" goes, so the model never has to invent a price.
  final List<String> missingUz;

  final DraftSource source;

  /// True when no fact came back and the form should be left alone.
  ///
  /// A title does not count. It is derived from the sentence rather than
  /// understood from it, so "assalomu alaykum" yields a perfectly good title
  /// and nothing else — and telling the seller the form was filled when only
  /// their greeting was echoed back is worse than admitting nothing was found.
  bool get isEmpty =>
      categorySlug == null && quantity == null && price == null;
}
