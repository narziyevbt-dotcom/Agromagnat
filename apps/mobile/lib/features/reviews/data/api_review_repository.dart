import '../../../core/network/api_client.dart';
import '../../listings/data/api/listing_mapper.dart';
import '../domain/entities/review.dart';
import '../domain/repositories/review_repository.dart';

/// JSON → entities, total the way [ListingMapper] is.
abstract final class ReviewMapper {
  static Review? review(dynamic json) {
    if (json is! Map) {
      return null;
    }
    final id = json['id'];
    final createdAt = ListingMapper.date(json['createdAt']);
    final rating = ListingMapper.number(json['rating'])?.toInt();

    if (id is! String || createdAt == null || rating == null) {
      return null;
    }

    final author = json['author'];
    final listing = json['listing'];

    return Review(
      id: id,
      listingId: json['listingId'] as String? ?? '',
      rating: rating.clamp(1, 5),
      comment: ListingMapper.text(json['comment']),
      createdAt: createdAt,
      authorName: author is Map ? ListingMapper.text(author['name']) : null,
      listingTitle: listing is Map ? ListingMapper.text(listing['title']) : null,
    );
  }

  static SellerReviews sellerReviews(dynamic json) {
    if (json is! Map) {
      return const SellerReviews();
    }

    final raw = json['breakdown'];
    return SellerReviews(
      items: [
        for (final row in (json['items'] as List? ?? const [])) ?review(row),
      ],
      total: ListingMapper.intOr(json['total'], 0),
      // The average arrives as a string — "4.70" — like every other numeric.
      average: ListingMapper.number(json['average']) ?? 0,
      breakdown: {
        for (var star = 1; star <= 5; star++)
          star: raw is Map ? ListingMapper.intOr(raw['$star'], 0) : 0,
      },
    );
  }
}

class ApiReviewRepository implements ReviewRepository {
  ApiReviewRepository(this._client);

  final ApiClient _client;

  @override
  Future<SellerReviews> forSeller(String sellerId, {int page = 1}) {
    return _client.get(
      '/sellers/$sellerId/reviews',
      query: {'page': page},
      decode: ReviewMapper.sellerReviews,
    );
  }

  @override
  Future<Review> rate(
    String listingId, {
    required int rating,
    String? comment,
  }) async {
    try {
      final review = await _client.post(
        '/listings/$listingId/review',
        body: {
          'rating': rating,
          if (comment != null && comment.trim().isNotEmpty)
            'comment': comment.trim(),
        },
        decode: ReviewMapper.review,
      );
      if (review == null) {
        throw const ApiException(0, "Baho saqlandi, lekin javob o'qilmadi");
      }
      return review;
    } on ApiException catch (error) {
      // 400 — not sold, or your own listing. 409 — already rated. All three
      // are answers, not faults, and the message is already in Uzbek.
      if (error.status == 400 || error.status == 409) {
        throw ReviewRefusedException(error.messageUz);
      }
      rethrow;
    }
  }

  @override
  Future<Review?> mine(String listingId) {
    // The endpoint answers `null` for "not rated yet", which the mapper turns
    // into null too — one path, not a 404 to catch.
    return _client.get(
      '/listings/$listingId/review',
      decode: ReviewMapper.review,
    );
  }
}
