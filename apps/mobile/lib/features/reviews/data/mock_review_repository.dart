import '../domain/entities/review.dart';
import '../domain/repositories/review_repository.dart';

/// In-memory reviews over the listing fixtures' sellers.
///
/// Enforces the same three refusals the API does, so the screens are built
/// against the rules rather than against the happy path.
class MockReviewRepository implements ReviewRepository {
  MockReviewRepository({
    DateTime? now,
    this.latency = const Duration(milliseconds: 350),
    this.viewerId = 'sel-1',
  }) : _now = now ?? DateTime.now() {
    _seed();
  }

  final Duration latency;
  final String viewerId;
  final DateTime _now;

  final Map<String, List<Review>> _bySeller = {};

  /// Listings the viewer is allowed to rate — sold, and not their own.
  final Set<String> ratable = {'lst-02'};

  void _seed() {
    _bySeller['sel-2'] = [
      Review(
        id: 'rev-1',
        listingId: 'lst-03',
        rating: 5,
        comment: "Hammasi kelishilganidek. Pomidor sifatli, vaqtida yetkazdi.",
        createdAt: _now.subtract(const Duration(days: 3)),
        authorName: 'Anvar aka',
      ),
      Review(
        id: 'rev-2',
        listingId: 'lst-05',
        rating: 4,
        comment: 'Yaxshi, lekin bir soat kechikdi.',
        createdAt: _now.subtract(const Duration(days: 11)),
        authorName: 'Dilshod',
      ),
      Review(
        id: 'rev-3',
        listingId: 'lst-08',
        rating: 5,
        createdAt: _now.subtract(const Duration(days: 20)),
        authorName: 'Nodira Karimova',
      ),
    ];
  }

  @override
  Future<SellerReviews> forSeller(String sellerId, {int page = 1}) async {
    await Future<void>.delayed(latency);

    final items = _bySeller[sellerId] ?? const <Review>[];
    if (items.isEmpty) {
      return const SellerReviews();
    }

    final breakdown = <int, int>{for (var star = 1; star <= 5; star++) star: 0};
    var sum = 0;
    for (final review in items) {
      breakdown[review.rating] = (breakdown[review.rating] ?? 0) + 1;
      sum += review.rating;
    }

    return SellerReviews(
      items: items,
      total: items.length,
      average: sum / items.length,
      breakdown: breakdown,
    );
  }

  @override
  Future<Review> rate(
    String listingId, {
    required int rating,
    String? comment,
  }) async {
    await Future<void>.delayed(latency);

    if (!ratable.contains(listingId)) {
      throw const ReviewRefusedException(
        "Baho faqat sotilgan e'lon uchun qo'yiladi",
      );
    }
    if (_mine.containsKey(listingId)) {
      throw const ReviewRefusedException(
        "Siz bu e'lon uchun allaqachon baho qo'ygansiz",
      );
    }

    final review = Review(
      id: 'rev-${_mine.length + 100}',
      listingId: listingId,
      rating: rating,
      comment: comment?.trim().isEmpty ?? true ? null : comment!.trim(),
      createdAt: _now,
      authorName: 'Siz',
    );
    _mine[listingId] = review;
    return review;
  }

  final Map<String, Review> _mine = {};

  @override
  Future<Review?> mine(String listingId) async {
    await Future<void>.delayed(latency);
    return _mine[listingId];
  }
}
